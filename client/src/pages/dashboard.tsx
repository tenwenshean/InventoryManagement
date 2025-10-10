// pages/dashboard.tsx
import { useEffect, useState } from "react";
import DashboardStats from "@/components/dashboard-stats";
import InventoryTable from "@/components/inventory-table";
import Chatbot from "@/components/chatbot";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, QrCode, Bell, Bot } from "lucide-react";
import AddProductModal from "@/components/add-product-modal";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // App.tsx handles authentication redirects, so we don't need to check here
  // This component will only render when authenticated

  return (
    <>
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
          <Button variant="outline" size="sm" className="relative" data-testid="button-notifications">
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

      <DashboardStats />

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

      <InventoryTable />

      {showAddProduct && (
        <AddProductModal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} />
      )}
      {showChatbot && (
        <Chatbot isOpen={showChatbot} onClose={() => setShowChatbot(false)} />
      )}
    </>
  );
}