import admin from "firebase-admin";
import fs from "fs";

// Prefer environment variables (used in Vercel) and fall back to a local key file for dev
function loadServiceAccount() {
  if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PROJECT_ID) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // privateKey may have literal \n sequences when set in env; convert them
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    };
  }

  // Fallback to reading local firebase-key.json (for local development)
  try {
    const content = fs.readFileSync("firebase-key.json", "utf8");
    return JSON.parse(content);
  } catch (err) {
    console.error("Failed to load Firebase service account from env or firebase-key.json:", err);
    throw err;
  }
}

const serviceAccount = loadServiceAccount();

// Initialize Firebase App
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  });
}

// Export Firestore Database Instance
export const db = admin.firestore();
export const auth = admin.auth();

console.log("✅ Connected to Firebase Firestore successfully.");
