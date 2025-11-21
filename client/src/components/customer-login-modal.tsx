import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShoppingBag, Mail, Lock } from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail } from "firebase/auth";

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
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const { toast } = useToast();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      
      if (isSignUp) {
        // Create new account
        result = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update display name if provided
        if (name.trim()) {
          await updateProfile(result.user, {
            displayName: name.trim()
          });
        }
        
        console.log("Customer Sign Up Success:", {
          email: result.user.email,
          uid: result.user.uid
        });
        
        toast({
          title: "Account Created!",
          description: `Welcome ${name || email}! Your account has been created successfully.`,
        });
      } else {
        // Sign in existing user
        result = await signInWithEmailAndPassword(auth, email, password);
        
        console.log("Customer Login Success:", {
          email: result.user.email,
          uid: result.user.uid
        });
        
        toast({
          title: "Login Successful!",
          description: `Welcome back ${result.user.displayName || result.user.email}!`,
        });
      }
      
      // Mark this as a customer login session
      localStorage.setItem('loginContext', 'customer');
      console.log("✅ Set loginContext to 'customer'");
      
      onLoginSuccess(result.user);
      onClose();
      
      // Reset form
      setEmail("");
      setPassword("");
      setName("");
      setIsSignUp(false);
    } catch (error: any) {
      console.error("Error with email authentication:", error);
      
      let errorMessage = "Failed to authenticate. Please try again.";
      
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Invalid email address.";
          break;
        case "auth/user-disabled":
          errorMessage = "This account has been disabled.";
          break;
        case "auth/user-not-found":
          errorMessage = "No account found with this email.";
          break;
        case "auth/wrong-password":
          errorMessage = "Incorrect password.";
          break;
        case "auth/email-already-in-use":
          errorMessage = "An account with this email already exists.";
          break;
        case "auth/weak-password":
          errorMessage = "Password should be at least 6 characters.";
          break;
        case "auth/invalid-credential":
          errorMessage = "Invalid email or password.";
          break;
        default:
          errorMessage = error.message || "Authentication failed.";
      }
      
      toast({
        title: isSignUp ? "Sign Up Error" : "Login Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Configure action code settings for password reset
      const actionCodeSettings = {
        url: `${window.location.origin}/customer`, // Redirect back to customer page after reset
        handleCodeInApp: false, // Use Firebase's default password reset page
      };
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      toast({
        title: "Password Reset Email Sent!",
        description: `Check your email at ${email} for instructions to reset your password. Check spam folder if you don't see it.`,
      });
      
      // Reset form and go back to login
      setEmail("");
      setIsForgotPassword(false);
    } catch (error: any) {
      console.error("Error sending password reset email:", error);
      
      let errorMessage = "Failed to send reset email. Please try again.";
      
      switch (error.code) {
        case "auth/invalid-email":
          errorMessage = "Invalid email address.";
          break;
        case "auth/user-not-found":
          errorMessage = "No account found with this email. Please sign up first.";
          break;
        case "auth/too-many-requests":
          errorMessage = "Too many reset attempts. Please try again later.";
          break;
        default:
          errorMessage = error.message || "Failed to send reset email.";
      }
      
      toast({
        title: "Password Reset Error",
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
            {isForgotPassword ? "Reset Password" : `Customer ${isSignUp ? "Sign Up" : "Login"}`}
          </DialogTitle>
          <DialogDescription>
            {isForgotPassword 
              ? "Enter your email to receive password reset instructions"
              : isSignUp 
              ? "Create an account to start shopping" 
              : "Sign in to your account to continue shopping"}
          </DialogDescription>
        </DialogHeader>

        {isForgotPassword ? (
          <form onSubmit={handlePasswordReset} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              </div>
              <p className="text-xs text-gray-500">
                We'll send you an email with instructions to reset your password
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Reset Link
                </>
              )}
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgotPassword(false);
                  setEmail("");
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Back to login
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleEmailLogin} className="space-y-4 py-4">
              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <Input
                      id="name"
                      type="text"
                      placeholder="Enter your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-10"
                  />
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setPassword("");
                      }}
                      className="text-xs text-red-600 hover:text-red-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="pl-10"
                  />
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                </div>
                {isSignUp && (
                  <p className="text-xs text-gray-500">Password must be at least 6 characters</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-6 text-lg"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isSignUp ? "Creating account..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-5 h-5 mr-2" />
                    {isSignUp ? "Create Account" : "Sign In"}
                  </>
                )}
              </Button>
            </form>

            <div className="text-center space-y-2 border-t pt-4">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setEmail("");
                  setPassword("");
                  setName("");
                }}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                {isSignUp 
                  ? "Already have an account? Sign in" 
                  : "Don't have an account? Sign up"}
              </button>
              <p className="text-xs text-gray-500">
                Customer accounts are separate from enterprise accounts
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
