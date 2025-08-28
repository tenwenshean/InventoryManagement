import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";
import DashboardStats from "@/components/dashboard-stats";
import InventoryTable from "@/components/inventory-table";
import Chatbot from "@/components/chatbot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, QrCode, Bell, Bot } from "lucide-react";
import { useState } from "react";
import AddProductModal from "@/components/add-product-modal";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading || !isAuthenticated) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-6">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
              Dashboard
            </h1>
            <p className="text-muted-foreground" data-testid="text-page-subtitle">
              Welcome back, overview of your inventory system
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              className="relative"
              data-testid="button-notifications"
            >
              <Bell size={18} />
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                3
              </span>
            </Button>
            <Button
              onClick={() => setShowChatbot(!showChatbot)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-chatbot-toggle"
            >
              <Bot className="mr-2" size={18} />
              AI Assistant
            </Button>
          </div>
        </header>

        {/* Dashboard Stats */}
        <DashboardStats />

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button
                variant="outline"
                className="flex items-center space-x-3 p-4 h-auto justify-start"
                onClick={() => setShowAddProduct(true)}
                data-testid="button-add-product"
              >
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Plus className="text-primary" size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Add Product</p>
                  <p className="text-sm text-muted-foreground">Create new inventory item</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center space-x-3 p-4 h-auto justify-start"
                data-testid="button-bulk-import"
              >
                <div className="bg-chart-2/10 p-2 rounded-lg">
                  <Upload className="text-chart-2" size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Bulk Import</p>
                  <p className="text-sm text-muted-foreground">Upload CSV file</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="flex items-center space-x-3 p-4 h-auto justify-start"
                data-testid="button-generate-qr"
              >
                <div className="bg-chart-3/10 p-2 rounded-lg">
                  <QrCode className="text-chart-3" size={20} />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">Generate QR Codes</p>
                  <p className="text-sm text-muted-foreground">For selected products</p>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recent Inventory Table */}
        <InventoryTable />
      </main>

      {/* Modals and overlays */}
      {showAddProduct && (
        <AddProductModal
          isOpen={showAddProduct}
          onClose={() => setShowAddProduct(false)}
        />
      )}

      {showChatbot && (
        <Chatbot
          isOpen={showChatbot}
          onClose={() => setShowChatbot(false)}
        />
      )}
    </div>
  );
}
