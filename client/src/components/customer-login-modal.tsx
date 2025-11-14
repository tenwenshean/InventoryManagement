import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingBag, Chrome } from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";

interface CustomerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any) => void;
}

export default function CustomerLoginModal({
  isOpen,
  onClose,
  onLoginSuccess,
}: CustomerLoginModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const provider = new GoogleAuthProvider();
    
    // Request additional user profile information
    provider.addScope('profile');
    provider.addScope('email');
    
    // Force account selection to ensure fresh login
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      const result = await signInWithPopup(auth, provider);
      
      console.log("Google Login Result:", {
        displayName: result.user.displayName,
        email: result.user.email,
        photoURL: result.user.photoURL,
        uid: result.user.uid,
        metadata: result.user.metadata
      });
      
      // Mark this as a customer login session
      localStorage.setItem('loginContext', 'customer');
      console.log("✅ Set loginContext to 'customer'");
      
      toast({
        title: "Login Successful!",
        description: `Welcome ${result.user.displayName || result.user.email || "to InventoryPro"}!`,
      });

      onLoginSuccess(result.user);
      onClose();
    } catch (error: any) {
      console.error("Error logging in with Google:", error);
      
      let errorMessage = "Failed to login. Please try again.";
      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Login cancelled. Please try again.";
      } else if (error.code === "auth/popup-blocked") {
        errorMessage = "Popup blocked. Please allow popups for this site.";
      }
      
      toast({
        title: "Login Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <ShoppingBag className="w-6 h-6 text-red-600" />
            Customer Login
          </DialogTitle>
          <DialogDescription>
            Sign in with your Google account to start shopping
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-6">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-100 to-orange-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-10 h-10 text-red-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Shop from Multiple Stores</h3>
              <p className="text-sm text-gray-600 mt-1">
                Browse products from various sellers and add them to your cart
              </p>
            </div>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300 py-6 text-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <Chrome className="w-5 h-5 mr-2" />
                Continue with Google
              </>
            )}
          </Button>

          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>Use the same Google account for both:</p>
            <div className="flex items-center justify-center gap-2 text-gray-600">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">🏢 Seller Dashboard</span>
              <span>+</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">🛒 Customer Shopping</span>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-gray-500 space-y-2 border-t pt-4">
          <p>By logging in, you agree to our Terms & Conditions</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
