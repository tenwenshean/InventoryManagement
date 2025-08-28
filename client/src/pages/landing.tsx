import { Package, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
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
                Sign In
              </Button>
            </div>

            <div className="pt-6 border-t border-border">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Real-time Tracking</h3>
                  <p className="text-sm text-muted-foreground">Monitor inventory levels instantly</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">QR Integration</h3>
                  <p className="text-sm text-muted-foreground">Mobile scanning & tracking</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Smart Analytics</h3>
                  <p className="text-sm text-muted-foreground">AI-powered insights</p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Accounting</h3>
                  <p className="text-sm text-muted-foreground">Integrated financial tracking</p>
                </div>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Don't have an account? 
                <span className="text-primary font-medium ml-1">Contact Administrator</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
