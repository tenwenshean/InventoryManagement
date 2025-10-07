// frontend/src/firebaseClient.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDZ4DWzDwa1-8OG9Afovh6_lqpKVbX7Sa4",
  authDomain: "inventorymanagement-3005-b38a3.firebaseapp.com",
  projectId: "inventorymanagement-3005-b38a3",
  storageBucket: "inventorymanagement-3005-b38a3.firebasestorage.app",
  messagingSenderId: "351419116007",
  appId: "1:351419116007:web:46310847e979afc6b37542"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, provider);
  const idToken = await result.user.getIdToken();

  localStorage.setItem("idToken", idToken); 

  return { user: result.user, idToken };
}
