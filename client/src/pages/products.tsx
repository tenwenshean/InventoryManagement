import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCurrency } from "@/hooks/useCurrency";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import EditProductModal from "@/components/edit-product-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AddProductModal from "@/components/add-product-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, QrCode, Trash2, Package } from "lucide-react";
import type { Product } from "@shared/schema";

export default function Products() {
  const { formatCurrency } = useCurrency();
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("DELETE", `/api/products/${productId}`);
      return response;
    },
    onSuccess: () => {
      // Invalidate both enterprise and public product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete product. Please try again.",
        variant: "destructive",
      });
      console.error("Delete product error:", error);
    },
  });

  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`, {});
      return response.json();
    },
    onSuccess: () => {
      // Invalidate both enterprise and public product queries
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicProducts.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      toast({
        title: "Success",
        description: "QR code generated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
      console.error("Generate QR error:", error);
    },
  });

  const { data: products, isLoading: productsLoading, error } = useQuery<Product[]>({
    queryKey: [...queryKeys.products.all, searchTerm],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/products?search=${searchTerm}`);
      return res.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading products...</p>
        </div>
      </div>
    );
  }

  const getStockStatus = (quantity: number, minStockLevel: number) => {
    if (quantity <= minStockLevel) {
      return { label: "Low Stock", variant: "destructive" as const };
    } else if (quantity <= minStockLevel * 2) {
      return { label: "Medium Stock", variant: "secondary" as const };
    } else {
      return { label: "In Stock", variant: "default" as const };
    }
  };

  return (
    <>
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Products
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            Manage your product catalog and information
          </p>
        </div>
        <Button
          onClick={() => setShowAddProduct(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="button-add-product"
        >
          <Plus className="mr-2" size={18} />
          Add Product
        </Button>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Product Catalog</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-product-search"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {productsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading products...</div>
            </div>
          ) : products && products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const stockStatus = getStockStatus(product.quantity || 0, product.minStockLevel || 0);
                return (
                  <Card key={product.id} className="hover:shadow-md transition-shadow" data-testid={`card-product-${product.id}`}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {product.imageUrl ? (
                              <img 
                                src={product.imageUrl} 
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="text-muted-foreground" size={24} />
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </h3>
                            <p className="text-sm text-muted-foreground" data-testid={`text-product-sku-${product.id}`}>
                              {product.sku}
                            </p>
                          </div>
                        </div>
                        <Badge variant={stockStatus.variant} data-testid={`badge-stock-status-${product.id}`}>
                          {stockStatus.label}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Price:</span>
                          <span className="font-medium text-foreground" data-testid={`text-product-price-${product.id}`}>
                            {formatCurrency(parseFloat(product.price))}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Stock:</span>
                          <span className="font-medium text-foreground" data-testid={`text-product-stock-${product.id}`}>
                            {product.quantity} units
                          </span>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mt-2" data-testid={`text-product-description-${product.id}`}>
                            {product.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setEditingProductId(product.id)}
                          data-testid={`button-edit-product-${product.id}`}
                        >
                          <Edit size={14} className="mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateQRMutation.mutate(product.id)}
                          disabled={generateQRMutation.isPending}
                          data-testid={`button-qr-product-${product.id}`}
                        >
                          <QrCode size={14} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-product-${product.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Product</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{product.name}"? This action will mark the product as inactive but preserve all transaction history.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProductMutation.mutate(product.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No products match your search criteria." : "Get started by adding your first product."}
              </p>
              {!searchTerm && (
                <Button
                  onClick={() => setShowAddProduct(true)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Plus className="mr-2" size={18} />
                  Add Your First Product
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddProduct && (
        <AddProductModal isOpen={showAddProduct} onClose={() => setShowAddProduct(false)} />
      )}

      {editingProductId && (
        <EditProductModal isOpen={true} onClose={() => setEditingProductId(null)} productId={editingProductId} />
      )}
    </>
  );
}