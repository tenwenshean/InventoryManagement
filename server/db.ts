import admin from "firebase-admin";
import fs from "fs";


// 🔹 Load Firebase Service Account Key
const serviceAccount = JSON.parse(
  fs.readFileSync("firebase-key.json", "utf8")
);

// 🔹 Initialize Firebase App
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}


// 🔹 Export Firestore Database Instance
export const db = admin.firestore();
export const auth = admin.auth();


console.log("✅ Connected to Firebase Firestore successfully.");
