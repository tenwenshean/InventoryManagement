// apiClient.ts
import { auth } from "./firebaseClient"; // adjust the path if needed

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await auth.currentUser?.getIdToken?.(); // get Firebase ID token if logged in

  const res = await fetch(`http://localhost:5000${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }

  return res.json();
}
