import express from "express";
import admin from "firebase-admin";
import fs from "fs";

const app = express();
app.use(express.json());

// Initialize Firebase using your key file
const serviceAccount = JSON.parse(
  fs.readFileSync("./firebase-key.json", "utf8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Test route
app.get("/test", async (req, res) => {
  const docRef = db.collection("demo").doc("example");
  await docRef.set({ message: "Hello from local server!" });
  const snap = await docRef.get();
  res.json(snap.data());
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
