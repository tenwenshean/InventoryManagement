// hooks/useAuth.ts
import { useState, useEffect } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "../../../firebaseClient";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (!isMounted) return;
        console.log(
          "Auth state changed:",
          firebaseUser?.email || "Not logged in"
        );
        setUser(firebaseUser);
        setIsLoading(false);
      },
      (err) => {
        console.error("Auth listener error:", err);
        if (isMounted) {
          setError(err.message);
          setIsLoading(false);
        }
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      setUser(null);
    } catch (err: any) {
      console.error("Error during logout:", err);
      setError(err.message);
    }
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    logout,
  };
}
