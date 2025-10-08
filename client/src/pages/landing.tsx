// pages/landing.tsx
import { useState } from "react";
import { loginWithGoogle } from "../../../firebaseClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, Package } from "lucide-react";

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();

      toast({
        title: "Success",
        description: "Logged in successfully!",
      });

      // Navigate to dashboard after successful login
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="bg-primary rounded-lg p-3">
                <Package className="text-primary-foreground text-2xl" size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2" data-testid="text-app-title">
              InventoryPro
            </h1>
            <p className="text-muted-foreground" data-testid="text-app-subtitle">
              Enterprise Inventory Management
            </p>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <p className="text-muted-foreground mb-6">
                Comprehensive inventory management with integrated accounting and AI-powered insights.
              </p>

              <Button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2 focus:ring-primary"
                data-testid="button-login"
              >
                <LogIn className="mr-2" size={18} />
                {isLoading ? "Signing In..." : "Sign In with Google"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
