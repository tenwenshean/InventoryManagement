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
  const authStateStableRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let stabilityTimer: NodeJS.Timeout;

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        if (!isMounted) return;
        
        const currentUserId = firebaseUser?.uid || null;
        const previousUserId = previousUserIdRef.current;
        
        console.log(
          "Auth state changed:",
          firebaseUser?.email || "Not logged in",
          "UID:", currentUserId,
          "Stable:", authStateStableRef.current
        );
        
        // Only clear cache if user actually changed (different user, not just token refresh)
        // Don't clear on initial load or logout->login
        if (previousUserId !== null && currentUserId !== null && currentUserId !== previousUserId) {
          console.log("Different user detected - clearing cache");
          queryClient.clear();
        }
        
        previousUserIdRef.current = currentUserId;
        setUser(firebaseUser);
        
        // Mark auth state as stable after a short delay
        // This prevents rapid state changes during page refresh
        clearTimeout(stabilityTimer);
        stabilityTimer = setTimeout(() => {
          authStateStableRef.current = true;
        }, 500);
        
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
      clearTimeout(stabilityTimer);
      unsubscribe();
    };
  }, [queryClient]);

  const logout = async () => {
    try {
      await signOut(auth);
      console.log("User signed out - clearing all cache");
      // Clear login context when logging out
      localStorage.removeItem('loginContext');
      // Clear all cached queries to ensure fresh data on next login
      queryClient.clear();
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
