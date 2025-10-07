import { useEffect, useState } from "react";
import { apiFetch } from "../../../apiClient";
import { auth } from "../../../firebaseClient";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const data = await apiFetch("/api/auth/user");
          setUser(data);
          setIsAuthenticated(true);
        } catch (e) {
          console.error(e);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, isAuthenticated, isLoading };
}
