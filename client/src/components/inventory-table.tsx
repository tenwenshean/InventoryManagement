import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, QrCode, Trash2, Package, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category } from "@/types";
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

interface InventoryTableProps {
  showAll?: boolean;
}

const ITEMS_PER_PAGE = 8;

export default function InventoryTable({ showAll = false }: InventoryTableProps) {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch products via API
  const { data: products, isLoading, error } = useQuery<Product[]>({
    queryKey: [...queryKeys.products.all, searchTerm],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/products?search=${searchTerm}`);
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 1000 * 30, // Consider data stale after 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Fetch categories via API
  const { data: categories } = useQuery<Category[]>({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Categories change less frequently
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories?.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filter products based on search term
  const filteredProducts = products?.filter(product => 
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate pagination
  const totalItems = filteredProducts?.length || 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;

  // Get products for current page
  const displayProducts = showAll 
    ? filteredProducts?.slice(startIndex, endIndex)
    : filteredProducts?.slice(0, 5);

  // Reset to page 1 when search term changes
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Pagination handlers
  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  // Delete product mutation via API
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("DELETE", `/api/products/${productId}`);
      if (!response.ok) throw new Error("Failed to delete product");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product. Please try again.",
        variant: "destructive",
      });
      console.error("Delete product error:", error);
    },
  });

  // Generate QR code mutation via API
  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`);
      if (!response.ok) throw new Error("Failed to generate QR code");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats });
      toast({
        title: "Success",
        description: "QR code generated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
      console.error("Generate QR error:", error);
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
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 w-64"
                data-testid="input-inventory-search"
              />
            </div>
            {!showAll && (
              <Button
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setLocation("/inventory")}
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
        ) : error ? (
          <div className="text-center py-8">
            <Package className="mx-auto text-destructive mb-4" size={48} />
            <h3 className="text-lg font-semibold text-foreground mb-2">Error loading inventory</h3>
            <p className="text-muted-foreground">{error instanceof Error ? error.message : "Failed to load products"}</p>
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
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                            {product.imageUrl ? (
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="text-muted-foreground" size={20} />
                            )}
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
                        {categoryNameById.get(product.categoryId || "") || "Uncategorized"}
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
                                  Are you sure you want to delete "{product.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteProductMutation.mutate(product.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  disabled={deleteProductMutation.isPending}
                                >
                                  {deleteProductMutation.isPending ? "Deleting..." : "Delete"}
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

        {showAll && displayProducts && displayProducts.length > 0 && totalPages > 1 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-inventory-pagination">
                Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} products
              </p>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={currentPage === 1}
                  onClick={goToPreviousPage}
                  data-testid="button-pagination-prev"
                >
                  Previous
                </Button>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">...</span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => goToPage(page as number)}
                      className={currentPage === page ? "bg-primary text-primary-foreground" : ""}
                      data-testid={`button-pagination-${page}`}
                    >
                      {page}
                    </Button>
                  )
                ))}
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={goToNextPage}
                  data-testid="button-pagination-next"
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {!showAll && displayProducts && displayProducts.length > 0 && (
          <div className="p-4 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-inventory-pagination">
                Showing {displayProducts.length} of {filteredProducts?.length || 0} products
              </p>
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