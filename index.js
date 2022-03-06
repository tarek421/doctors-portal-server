const express = require("express");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const admin = require("firebase-admin");

const cors = require("cors");
const bodyParser = require("body-parser");
const { json } = require("express/lib/response");
const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.g7gsq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors());
app.use(bodyParser.json());

const serviceAccount = require("./doctor-portal-420-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const verifyToken = async (req, res, next) => {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
    } catch {}
  }

  next();
};

async function run() {
  try {
    await client.connect();
    const database = client.db("doctorsPortalDB");
    const appointmentsCollection = database.collection("services");
    const userCollection = database.collection("user");

    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      // console.log(result);
      res.json(result);
    });

    app.get("/appointments", async (req, res) => {
      const email = req.query.email;
      const date = new Date(req.query.date).toLocaleDateString();
      const query = { email: email, date: date };
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.json(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      // console.log(user);
      const filter = { email: user.email };
      const options = { upsert: true };
      const update = { $set: user };
      const result = await userCollection.updateOne(filter, update, options);
      res.json(result);
    });

    app.put("/users/admin", verifyToken, async (req, res) => {
      const token = req.headers.authorization;
      const user = req.body;
      const requester = req.decodedEmail;
      console.log(requester);
      if (requester) {
        const requesterAccount = await userCollection.findOne({
          email: requester,
        });
        console.log(requesterAccount.email)
        if (requesterAccount.role === 'admin') {
          const user = req.body;
          const filter = { email: user.email };
          const update = { $set: { role: "admin" } };
          const result = await userCollection.updateOne(filter, update);
          res.json(result);
        }
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log("connected");
});
