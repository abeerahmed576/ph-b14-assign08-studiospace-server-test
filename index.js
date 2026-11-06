import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";
import { createRemoteJWKSet, jwtVerify } from "jose";
const app = express();
const PORT = 8000;

const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
  try {
    await client.connect();
    ("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

app.use(cors());
app.use(express.json());

const mongoClient = await connectToMongoDB();
const db = mongoClient.db("studiospace");
const studiosCollection = db.collection("studios");
const bookingsCollection = db.collection("bookings");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log(authHeader);
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized!" });
  }
  const token = authHeader.split(" ")[1];
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Unauthorized!" });
  }

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(500).send({ message: "Server Error!" });
  }
};

app.get("/", (req, res) => {
  res.send({ message: "Server is running fine!" });
});

app.get("/studios-carousel", async (req, res) => {
  const images = await studiosCollection
    .aggregate([
      {
        $project: {
          image: { $arrayElemAt: ["$images", 1] },
        },
      },
    ])
    .toArray();
  const result = images.map(({ image }) => image).filter((image) => image);
  res.send(result);
});

app.get("/top-rated-studios", async (req, res) => {
  const result = await studiosCollection
    .find({})
    .sort({ rating: -1 })
    .limit(6)
    .toArray();
  res.send(result);
});

app.get("/studios", async (req, res) => {
  const category = req.query.category || "all";
  let result = [];
  if (category === "all") result = await studiosCollection.find().toArray();
  else result = await studiosCollection.find({ category: category }).toArray();
  res.send(result);
});

app.get("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

app.get("/studios/user/:email", verifyToken, async (req, res) => {
  const { email } = req.params;
  console.log(email);
  const result = await studiosCollection
    .find({
      "host.email": email,
    })
    .toArray();
  console.log(result);
  res.send(result);
});

app.patch("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const result = await studiosCollection.updateOne(
    { _id: new ObjectId(id) },
    { $set: data },
  );
  res.json(result);
});

app.delete("/studios/:id", async (req, res) => {
  const { id } = req.params;
  const result = await studiosCollection.deleteOne({
    _id: new ObjectId(id),
  });
  res.json(result);
});

app.post("/dashboard/add-studio", async (req, res) => {
  const data = req.body;
  const result = await studiosCollection.insertOne(data);
  res.send(result);
});

app.post("/bookings", async (req, res) => {
  const data = req.body;
  const prevBookings = await bookingsCollection
    .find({ status: "Confirmed", "studio._id": data.studio._id })
    .toArray();
  const conflict = prevBookings.some(
    (item) => item.bookingDate === data.bookingDate,
  );
  if (conflict)
    return res.status(409).send({
      message: "The requested studio is already booked for the selected date",
    });
  const result = await bookingsCollection.insertOne(data);
  res.send(result);
});

app.get("/bookings/:userId", verifyToken, async (req, res) => {
  const { userId } = req.params;
  const result = await bookingsCollection
    .find({ "renter._id": userId })
    .toArray();
  res.send(result);
});

app.delete("/bookings/:id", async (req, res) => {
  const { id } = req.params;
  const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
  res.send(result);
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});

export default app;
