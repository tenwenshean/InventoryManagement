import { Package, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { loginWithGoogle } from "../../../firebaseClient"; // ✅ adjust this path if needed

export default function Landing() {
  const handleLogin = async () => {
    try {
      const { user, idToken } = await loginWithGoogle();
      console.log("✅ Logged in:", user.displayName);
      console.log("🪪 Token:", idToken);
      // Optionally send idToken to backend for verification
      window.location.href = "/dashboard"; // Redirect after login
    } catch (error) {
      console.error("❌ Login failed:", error);
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
                onClick={handleLogin}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-2 focus:ring-primary"
                data-testid="button-login"
              >
                <LogIn className="mr-2" size={18} />
                Sign In with Google
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
