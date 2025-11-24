// pages/landing.tsx
import { useState } from "react";
import { loginWithGoogle } from "@/lib/firebaseClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LogIn, Package, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export default function Landing() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      await loginWithGoogle();

      // Mark this as an enterprise login session
      localStorage.setItem('loginContext', 'enterprise');
      console.log("✅ Set loginContext to 'enterprise'");

      toast({
        title: "Success",
        description: "Logged in successfully!",
      });

      // Navigate to dashboard after successful login
      navigate("/dashboard");
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

  const handleCustomerPortalClick = () => {
    // Invalidate products cache to ensure fresh data when entering customer portal
    console.log("Navigating to customer portal - invalidating products cache");
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    navigate("/customer");
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

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>

              <Button
                onClick={handleCustomerPortalClick}
                variant="outline"
                className="w-full"
                data-testid="button-customer-portal"
              >
                <Store className="mr-2" size={18} />
                Browse Products (Customer Portal)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
