// frontend/src/firebaseClient.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

// --- Your Firebase configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDZ4DWzDwa1-8OG9Afovh6_lqpKVbX7Sa4",
  authDomain: "inventorymanagement-3005-b38a3.firebaseapp.com",
  projectId: "inventorymanagement-3005-b38a3",
  storageBucket: "inventorymanagement-3005-b38a3.firebasestorage.app",
  messagingSenderId: "351419116007",
  appId: "1:351419116007:web:46310847e979afc6b37542",
};

// --- Initialize Firebase app ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ✅ Make sure login persists between sessions (even after refresh)
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("❌ Failed to set Firebase auth persistence:", err);
});

// --- Google login provider ---
const provider = new GoogleAuthProvider();

/**
 * Sign in with Google popup
 * Automatically persists session due to `browserLocalPersistence`
 */
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    console.log("✅ Google login success:", result.user.email);

    // Firebase automatically stores the session
    return { user: result.user };
  } catch (error) {
    console.error("❌ Error signing in with Google:", error);
    throw error;
  }
}

export { auth, provider };
