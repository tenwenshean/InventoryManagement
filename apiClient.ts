// apiClient.ts
import { auth } from "./firebaseClient";

export async function apiFetch(path: string, options: RequestInit = {}) {
  try {
    const token = await auth.currentUser?.getIdToken(true);

    // Use relative URL - Vite proxy will forward to http://localhost:5000
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`API error ${res.status} for ${path}:`, errorText);
      
      if (res.status === 401) {
        throw new Error("Unauthorized - Please log in again");
      }
      
      throw new Error(`API error ${res.status}: ${errorText}`);
    }

    return res.json();
  } catch (error) {
    console.error('apiFetch error:', error);
    throw error;
  }
}