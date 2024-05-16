const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
//middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// jwt verify middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized access" });
  if (token) {
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      console.log(decoded);
      req.user = decoded;
      next();
    });
  }
};

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.cnltwph.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    //jwt generate
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    //clear token
    app.get("/logout", (req, res) => {
      res
        .clearCookie("token", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          maxAge: 0,
        })
        .send({ success: true });
    });

    const roomsCollection = client.db("staySphereDB").collection("rooms");
    const bookingsCollection = client.db("staySphereDB").collection("bookings");
    const reviewsCollection = client.db("staySphereDB").collection("reviews");

    // get all rooms data from database
    app.get("/rooms", async (req, res) => {
      const filter = req.query.filter;
      let query = {};
      if (filter) {
        const [lowerBound, upperBound] = filter.split("-").map(Number);
        if (!isNaN(lowerBound) && !isNaN(upperBound)) {
          // Adjust the query to filter rooms based on price range
          query = { price_per_night: { $gte: lowerBound, $lte: upperBound } };
        }
      }
      const result = await roomsCollection.find(query).toArray();
      res.send(result);
    });

    //get a single room from database
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      res.send(result);
    });
    //patch a single room from database
    app.patch("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const { availability } = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: { availability } };
      const result = await roomsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //save a booking in the database
    app.post("/booking", async (req, res) => {
      const roomData = req.body;
      const result = await bookingsCollection.insertOne(roomData);
      res.send(result);
    });
    //delete a booking in the database
    app.delete("/booking/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    //update booking date
    app.patch("/booking-update/:id", async (req, res) => {
      const id = req.params.id;
      const bookingDate = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = { $set: bookingDate };
      const result = await bookingsCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //get all bookings by a user
    app.get("/bookings/:email", verifyToken, async (req, res) => {
      const tokenEmail = req.user.email;
      const email = req.params.email;
      if (tokenEmail!== email) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      const query = { email: email };
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
    });

    //save a review in the database
    app.post("/reviews", async (req, res) => {
      const reviewsData = req.body;
      const result = await reviewsCollection.insertOne(reviewsData);
      res.send(result);
    });

    //get revies from database
    app.get("/reviews/:id", async (req, res) => {
      const id = req.params.id;
      const query = { id: id };
      const result = await reviewsCollection.find(query).toArray();
      res.send(result);
    });

    //get all reviews from database
    app.get("/reviews", async (req, res) => {
      const result = await reviewsCollection
        .find()
        .sort({ timestamp: -1 })
        .toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Stay Sphere site server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
