// frontend/src/firebaseClient.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // ✅ Add this

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
const db = getFirestore(app); // ✅ Initialize Firestore

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

/**
 * Initialize reCAPTCHA verifier for phone authentication
 * @param containerId - ID of the HTML element to render reCAPTCHA
 * @param visible - Whether to show visible reCAPTCHA (default: true for better reliability)
 */
export function initRecaptcha(containerId: string, visible: boolean = true): RecaptchaVerifier {
  console.log("🔧 Initializing reCAPTCHA...", { containerId, visible });
  
  // Check if container exists
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`❌ Container element '${containerId}' not found in DOM`);
    throw new Error(`Container element '${containerId}' not found`);
  }
  
  try {
    const recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: visible ? "normal" : "invisible",
      callback: (response: any) => {
        console.log("✅ reCAPTCHA verified successfully");
      },
      "expired-callback": () => {
        console.warn("⚠️ reCAPTCHA expired - please try again");
      },
    });
    
    console.log("✅ reCAPTCHA verifier created successfully");
    return recaptchaVerifier;
  } catch (error: any) {
    console.error("❌ Failed to create reCAPTCHA verifier:", error);
    console.error("Make sure Phone Authentication is enabled in Firebase Console");
    throw new Error(`reCAPTCHA initialization failed: ${error.message}`);
  }
}

/**
 * Send OTP to phone number
 * @param phoneNumber - Phone number with country code (e.g., +1234567890)
 * @param recaptchaVerifier - reCAPTCHA verifier instance
 */
export async function sendOTP(phoneNumber: string, recaptchaVerifier: RecaptchaVerifier) {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    console.log("✅ OTP sent to:", phoneNumber);
    return confirmationResult;
  } catch (error: any) {
    console.error("❌ Error sending OTP:", error);
    throw error;
  }
}

/**
 * Verify OTP code
 * @param confirmationResult - Result from sendOTP
 * @param code - 6-digit OTP code
 */
export async function verifyOTP(confirmationResult: any, code: string) {
  try {
    const result = await confirmationResult.confirm(code);
    console.log("✅ Phone login success:", result.user.phoneNumber);
    return { user: result.user };
  } catch (error: any) {
    console.error("❌ Error verifying OTP:", error);
    throw error;
  }
}

export { auth, provider, db, RecaptchaVerifier }; // ✅ Export db and RecaptchaVerifier