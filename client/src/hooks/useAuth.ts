// hooks/useAuth.ts
import { useState, useEffect, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (!isMounted) return;
        
        const currentUserId = firebaseUser?.uid || null;
        const previousUserId = previousUserIdRef.current;
        
        console.log(
          "Auth state changed:",
          firebaseUser?.email || "Not logged in"
        );
        
        // Only clear cache if user actually changed (not on token refresh)
        if (previousUserId !== null && currentUserId !== previousUserId) {
          console.log("User changed - clearing cache");
          queryClient.clear(); // Clear all cached queries
        }
        
        previousUserIdRef.current = currentUserId;
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
  }, [queryClient]);

  const logout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out");
      // Clear login context when logging out
      localStorage.removeItem('loginContext');
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
