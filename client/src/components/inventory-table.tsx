import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, QrCode, Trash2, Package, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product } from "@shared/schema";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest } from "@/lib/queryClient";
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

interface InventoryTableProps {
  showAll?: boolean;
}

export default function InventoryTable({ showAll = false }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: ["/api/products", searchTerm],
  });

  useEffect(() => {
    if (error && isUnauthorizedError(error as Error)) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [error, toast]);

  const displayProducts = showAll ? products : products?.slice(0, 5);

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await apiRequest("DELETE", `/api/products/${productId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
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
      toast({
        title: "Error",
        description: "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  // Generate QR code mutation
  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`, {});
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
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive",
      });
    },
  });

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-foreground">
            {showAll ? "All Inventory" : "Recent Inventory Activity"}
          </CardTitle>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-64"
                data-testid="input-inventory-search"
              />
            </div>
            {!showAll && (
              <Button
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-view-all-inventory"
              >
                <Eye className="mr-2" size={16} />
                View All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-muted-foreground">Loading inventory...</div>
          </div>
        ) : displayProducts && displayProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Product</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">SKU</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Category</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Stock</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Value</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayProducts.map((product) => {
                  const stockStatus = getStockStatus(product.quantity || 0, product.minStockLevel || 0);
                  return (
                    <tr
                      key={product.id}
                      className="border-t border-border hover:bg-muted/50 transition-colors"
                      data-testid={`row-inventory-${product.id}`}
                    >
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <Package className="text-muted-foreground" size={20} />
                          </div>
                          <div>
                            <p className="font-medium text-foreground" data-testid={`text-product-name-${product.id}`}>
                              {product.name}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-product-description-${product.id}`}>
                              {product.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-foreground font-mono text-sm" data-testid={`text-product-sku-${product.id}`}>
                        {product.sku}
                      </td>
                      <td className="p-4 text-foreground" data-testid={`text-product-category-${product.id}`}>
                        {product.categoryId || "Uncategorized"}
                      </td>
                      <td className="p-4">
                        <span className="text-foreground font-medium" data-testid={`text-product-stock-${product.id}`}>
                          {product.quantity || 0}
                        </span>
                        <span className="text-muted-foreground"> units</span>
                      </td>
                      <td className="p-4 text-foreground font-medium" data-testid={`text-product-value-${product.id}`}>
                        ${((product.quantity || 0) * parseFloat(product.price)).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <Badge variant={stockStatus.variant} data-testid={`badge-stock-status-${product.id}`}>
                          {stockStatus.label}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => setEditingProductId(product.id)}
                            data-testid={`button-edit-${product.id}`}
                          >
                            <Edit size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-1 text-muted-foreground hover:text-primary transition-colors"
                            onClick={() => generateQRMutation.mutate(product.id)}
                            disabled={generateQRMutation.isPending}
                            data-testid={`button-qr-${product.id}`}
                          >
                            <QrCode size={16} />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                                data-testid={`button-delete-${product.id}`}
                              >
                                <Trash2 size={16} />
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Package className="mx-auto text-muted-foreground mb-4" size={48} />
            <h3 className="text-lg font-semibold text-foreground mb-2">No inventory found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "No products match your search criteria." : "Get started by adding your first product."}
            </p>
          </div>
        )}

        {displayProducts && displayProducts.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-inventory-pagination">
                Showing {displayProducts.length} of {products?.length || 0} products
              </p>
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" disabled data-testid="button-pagination-prev">
                  Previous
                </Button>
                <Button variant="default" size="sm" className="bg-primary text-primary-foreground" data-testid="button-pagination-1">
                  1
                </Button>
                <Button variant="outline" size="sm" data-testid="button-pagination-2">
                  2
                </Button>
                <Button variant="outline" size="sm" data-testid="button-pagination-3">
                  3
                </Button>
                <Button variant="outline" size="sm" data-testid="button-pagination-next">
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      {editingProductId && (
        <EditProductModal
          isOpen={true}
          onClose={() => setEditingProductId(null)}
          productId={editingProductId}
        />
      )}
    </Card>
  );
}
