import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, RefreshCw, Package } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Product } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";

export default function QRCodes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();

  // 🔒 Redirect if unauthenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => (window.location.href = "/login"), 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // ✅ Added missing queryFn
  const {
    data: products,
    isLoading: productsLoading,
    error,
  } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: isAuthenticated,
  });

  // 🔒 Handle expired login
  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => (window.location.href = "/login"), 500);
    }
  }, [error, toast]);

  // ✅ QR code generation
  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`);
      if (!response.ok) throw new Error("Failed to generate QR code");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "QR code generated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/login"), 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });

  if (isLoading || !isAuthenticated) {
    return <div>Loading...</div>;
  }

  const productsWithQR = products?.filter((product) => product.qrCode) || [];
  const productsWithoutQR = products?.filter((product) => !product.qrCode) || [];

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <main className="flex-1 ml-64 p-6">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            QR Code Management
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Generate and manage QR codes for inventory tracking
          </p>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Products</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-total-products">
                    {products?.length || 0}
                  </p>
                </div>
                <div className="bg-chart-1/10 p-3 rounded-lg">
                  <Package className="text-chart-1" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">With QR Codes</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-products-with-qr">
                    {productsWithQR.length}
                  </p>
                </div>
                <div className="bg-chart-2/10 p-3 rounded-lg">
                  <QrCode className="text-chart-2" size={24} />
                </div>
              </div>
              <p className="text-sm text-chart-2 mt-2">
                {products?.length ? Math.round((productsWithQR.length / products.length) * 100) : 0}% coverage
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending QR</p>
                  <p className="text-2xl font-bold text-foreground" data-testid="text-products-without-qr">
                    {productsWithoutQR.length}
                  </p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <RefreshCw className="text-primary" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products with QR Codes */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Products with QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading products...</div>
              </div>
            ) : productsWithQR.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {productsWithQR.map((product) => (
                  <Card
                    key={product.id}
                    className="hover:shadow-md transition-shadow"
                    data-testid={`card-qr-product-${product.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-foreground" data-testid={`text-qr-product-name-${product.id}`}>
                            {product.name}
                          </h3>
                          <p className="text-sm text-muted-foreground" data-testid={`text-qr-product-sku-${product.id}`}>
                            {product.sku}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-chart-2 text-white">
                          QR Ready
                        </Badge>
                      </div>

                      <div className="bg-muted p-4 rounded-lg mb-3 text-center">
                        <QrCode className="mx-auto text-muted-foreground mb-2" size={48} />
                        <p className="text-xs text-muted-foreground font-mono" data-testid={`text-qr-code-${product.id}`}>
                          {product.qrCode}
                        </p>
                      </div>

                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" className="flex-1" data-testid={`button-download-qr-${product.id}`}>
                          <Download size={14} className="mr-1" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateQRMutation.mutate(product.id)}
                          disabled={generateQRMutation.isPending}
                          data-testid={`button-regenerate-qr-${product.id}`}
                        >
                          <RefreshCw size={14} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <QrCode className="mx-auto text-muted-foreground mb-4" size={48} />
                <h3 className="text-lg font-semibold text-foreground mb-2">No QR codes yet</h3>
                <p className="text-muted-foreground">Generate QR codes for your products to enable mobile tracking.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Products without QR Codes */}
        {productsWithoutQR.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Products Needing QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {productsWithoutQR.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`row-pending-qr-${product.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="text-muted-foreground" size={20} />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground" data-testid={`text-pending-product-name-${product.id}`}>
                          {product.name}
                        </h4>
                        <p className="text-sm text-muted-foreground" data-testid={`text-pending-product-sku-${product.id}`}>
                          {product.sku}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => generateQRMutation.mutate(product.id)}
                      disabled={generateQRMutation.isPending}
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      data-testid={`button-generate-qr-${product.id}`}
                    >
                      <QrCode className="mr-2" size={16} />
                      Generate QR
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
