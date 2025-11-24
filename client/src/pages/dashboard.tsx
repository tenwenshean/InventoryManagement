// pages/dashboard.tsx
import { useEffect, useState } from "react";
import DashboardStats from "@/components/dashboard-stats";
import InventoryTable from "@/components/inventory-table";
import Chatbot from "@/components/chatbot";
import AddProductModal from "@/components/add-product-modal";
import BulkUploadModal from "@/components/bulk-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Upload, Download, Bell, Bot, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@/types";

export default function Dashboard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const { toast } = useToast();

  // Load timezone from settings
  useEffect(() => {
    const savedSettings = localStorage.getItem(`settings_${user?.uid}`);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setTimezone(settings.timezone || "UTC");
    }
  }, [user]);

  // Update current time based on timezone
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeString = now.toLocaleTimeString("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      const dateString = now.toLocaleDateString("en-US", {
        timeZone: timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      setCurrentTime(`${dateString}, ${timeString}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Fetch products for CSV export
  const { data: products } = useQuery<Product[]>({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!products || products.length === 0) {
      toast({
        title: "No Data",
        description: "No products available to export",
        variant: "destructive",
      });
      return;
    }

    // CSV Headers
    const headers = [
      "name",
      "sku",
      "description",
      "categoryId",
      "price",
      "costPrice",
      "quantity",
      "minStockLevel",
      "maxStockLevel",
      "barcode",
    ];

    // Convert products to CSV rows
    const csvRows = [
      headers.join(","), // Header row
      ...products.map((product) =>
        headers
          .map((header) => {
            const value = product[header as keyof Product] || "";
            // Escape commas and quotes in values
            const stringValue = String(value).replace(/"/g, '""');
            return stringValue.includes(",") ? `"${stringValue}"` : stringValue;
          })
          .join(",")
      ),
    ];

    // Create CSV content
    const csvContent = csvRows.join("\n");
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Success",
      description: `Exported ${products.length} products to CSV`,
    });
  };

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
          {currentTime && (
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Clock size={14} />
              <span>{currentTime}</span>
            </div>
          )}
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
              onClick={() => setShowBulkUpload(true)}
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
              onClick={handleExportCSV}
              data-testid="button-export-csv"
            >
              <div className="bg-chart-3/10 p-2 rounded-lg">
                <Download className="text-chart-3" size={20} />
              </div>
              <div className="text-left">
                <p className="font-medium text-foreground">Export to CSV</p>
                <p className="text-sm text-muted-foreground">Download all products</p>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      <InventoryTable />

      {/* Modals */}
      {showAddProduct && (
        <AddProductModal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} />
      )}
      {showBulkUpload && (
        <BulkUploadModal isOpen={showBulkUpload} onClose={() => setShowBulkUpload(false)} />
      )}
      {showChatbot && (
        <Chatbot isOpen={showChatbot} onClose={() => setShowChatbot(false)} />
      )}
    </>
  );
}