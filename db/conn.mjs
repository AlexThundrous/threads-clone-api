import { MongoClient } from "mongodb";

const connectionString = process.env.ATLAS_URI || "mongodb+srv://alexthundrous2104:Saguet@threads-clone.0xn9a0z.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(connectionString);

let conn;
try {
  conn = await client.connect();
  console.log("Connected to MongoDB Atlas");
} catch(e) {
  console.error("Error connecting to MongoDB Atlas:", e);
}

const db = conn.db("profiles");

export default db;
