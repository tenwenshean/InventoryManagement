import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, RefreshCw, Package, Printer, ArrowRightLeft, PackageCheck, History, User, Building2, Trash2, Search, X, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Product } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type defs may not be installed in this environment
import QRCode from "qrcode";

interface TransferRecord {
  id: string;
  type: 'transfer' | 'receive' | 'admin-update';
  staffName: string;
  fromBranch: string;
  toBranch: string;
  timestamp: string;
  productId: string;
}

export default function QRCodes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const DISPLAY_LIMIT = 9;

  // Load transfer history from localStorage
  useEffect(() => {
    try {
      const history = JSON.parse(localStorage.getItem('product_transfers') || '[]');
      setTransferHistory(history);
    } catch (e) {
      console.error('Failed to load transfer history:', e);
    }
  }, []);

  const {
    data: products,
    isLoading: productsLoading,
    error,
  } = useQuery<Product[]>({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // Consider data stale after 2 minutes
    refetchOnMount: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const productsWithQR = useMemo(
    () => (products || []).filter((product) => product.qrCode),
    [products]
  );
  const productsWithoutQR = useMemo(
    () => (products || []).filter((product) => !product.qrCode),
    [products]
  );

  // Filter products based on search query (name, SKU/ID, or category-like matching)
  const filteredProductsWithQR = useMemo(() => {
    if (!searchQuery.trim()) return productsWithQR;
    
    const query = searchQuery.toLowerCase().trim();
    return productsWithQR.filter((product) => {
      const nameMatch = product.name?.toLowerCase().includes(query);
      const skuMatch = product.sku?.toLowerCase().includes(query);
      const idMatch = product.id?.toLowerCase().includes(query);
      const qrMatch = product.qrCode?.toLowerCase().includes(query);
      return nameMatch || skuMatch || idMatch || qrMatch;
    });
  }, [productsWithQR, searchQuery]);

  // Display limited or all products
  const displayedProducts = useMemo(() => {
    if (showAll || searchQuery.trim()) return filteredProductsWithQR;
    return filteredProductsWithQR.slice(0, DISPLAY_LIMIT);
  }, [filteredProductsWithQR, showAll, searchQuery]);

  // Get transfer history for a specific product
  const getProductTransferHistory = (productId: string) => {
    return transferHistory.filter(t => t.productId === productId);
  };

  useEffect(() => {
    let cancelled = false;
    const genAll = async () => {
      const map: Record<string, string> = {};
      for (const p of productsWithQR) {
        if (!p.qrCode) continue;
        try {
          map[p.id] = await QRCode.toDataURL(
            `${window.location.origin}/scan/${encodeURIComponent(p.qrCode)}`,
            { width: 240, margin: 1 }
          );
        } catch {}
        if (cancelled) return;
      }
      if (!cancelled) setQrUrls(map);
    };
    genAll();
    return () => {
      cancelled = true;
    };
  }, [productsWithQR]);

  const handleDownload = (product: Product) => {
    const url = qrUrls[product.id];
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${product.name}-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = (product: Product) => {
    const imgUrl = qrUrls[product.id];
    if (!imgUrl) return;

    // Create a print window with proper styling
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast({
        title: "Error",
        description: "Please allow popups to print QR codes",
        variant: "destructive",
      });
      return;
    }

    // Build the HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print QR Code - ${product.name}</title>
          <style>
            @page {
              size: A4;
              margin: 20mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: white;
            }
            .container {
              text-align: center;
              max-width: 600px;
              padding: 40px;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .product-info {
              margin-bottom: 30px;
            }
            h1 {
              font-size: 28px;
              color: #1f2937;
              margin-bottom: 8px;
              font-weight: 700;
            }
            .sku {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 4px;
            }
            .category {
              font-size: 14px;
              color: #9ca3af;
            }
            .qr-container {
              background: white;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .qr-code {
              width: 300px;
              height: 300px;
              margin: 0 auto;
              display: block;
            }
            .qr-text {
              font-family: 'Courier New', monospace;
              font-size: 14px;
              color: #4b5563;
              margin-top: 16px;
              letter-spacing: 1px;
              word-break: break-all;
            }
            .scan-instruction {
              margin-top: 24px;
              font-size: 14px;
              color: #6b7280;
            }
            @media print {
              body {
                background: white;
              }
              .container {
                border: none;
                box-shadow: none;
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="product-info">
              <h1>${product.name}</h1>
              <p class="sku">SKU: ${product.sku}</p>
              ${product.category ? `<p class="category">Category: ${product.category}</p>` : ''}
              ${product.location ? `<p class="category">Location: ${product.location}</p>` : ''}
            </div>
            <div class="qr-container">
              <img src="${imgUrl}" alt="QR Code" class="qr-code" id="qrImage" />
              <p class="qr-text">${product.qrCode}</p>
            </div>
            <p class="scan-instruction">Scan this QR code to view product details</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();

    // Wait for image to load before printing
    const img = printWindow.document.getElementById('qrImage') as HTMLImageElement;
    if (img) {
      img.onload = () => {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      };
      // If image is already loaded (cached)
      if (img.complete) {
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 250);
      }
    } else {
      // Fallback if image element not found
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
    }
  };

  // QR code generation mutation
  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to generate QR code" }));
        throw new Error(errorData.message || "Failed to generate QR code");
      }
      const data = await response.json();
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      
      // Immediately update the QR URL in local state
      try {
        const qrUrl = await QRCode.toDataURL(
          `${window.location.origin}/scan/${encodeURIComponent(data.qrCode)}`,
          { width: 240, margin: 1 }
        );
        
        setQrUrls(prev => ({
          ...prev,
          [data.productId]: qrUrl
        }));
        
        toast({
          title: "Success",
          description: "QR code generated successfully",
        });
      } catch (error) {
        console.error("Error generating QR image:", error);
        toast({
          title: "Warning",
          description: "QR code generated but failed to display image. Please refresh.",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR code. Please try again.",
        variant: "destructive",
      });
      console.error("Generate QR error:", error);
    },
  });

  // Generate all QR codes mutation
  const generateAllQRMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      const results = [];
      let successCount = 0;
      let failCount = 0;

      for (const productId of productIds) {
        try {
          const response = await apiRequest("POST", `/api/products/${productId}/qr`);
          if (!response.ok) {
            failCount++;
            continue;
          }
          const data = await response.json();
          results.push(data);
          successCount++;
        } catch (error) {
          failCount++;
          console.error(`Failed to generate QR for product ${productId}:`, error);
        }
      }

      return { results, successCount, failCount, total: productIds.length };
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      
      // Update QR URLs for all generated codes
      const newQrUrls: Record<string, string> = {};
      for (const result of data.results) {
        try {
          const qrUrl = await QRCode.toDataURL(
            `${window.location.origin}/scan/${encodeURIComponent(result.qrCode)}`,
            { width: 240, margin: 1 }
          );
          newQrUrls[result.productId] = qrUrl;
        } catch (error) {
          console.error("Error generating QR image:", error);
        }
      }
      
      setQrUrls(prev => ({ ...prev, ...newQrUrls }));
      
      toast({
        title: "QR Generation Complete",
        description: `Successfully generated ${data.successCount} QR code(s)${data.failCount > 0 ? `. Failed: ${data.failCount}` : ''}`,
        variant: data.failCount > 0 ? "default" : "default",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate QR codes. Please try again.",
        variant: "destructive",
      });
      console.error("Generate all QR error:", error);
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
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
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <CardTitle>Products with QR Codes</CardTitle>
          {/* Search Bar */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by name, SKU, or ID... (e.g. kagle-262)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowAll(false); // Reset to limited view when searching
              }}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                Found <strong>{filteredProductsWithQR.length}</strong> product(s) matching "<strong>{searchQuery}</strong>"
              </p>
            </div>
          )}
          
          {productsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading products...</div>
            </div>
          ) : filteredProductsWithQR.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedProducts.map((product) => (
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

                    <button className="bg-muted p-4 rounded-lg mb-3 text-center w-full hover:bg-muted/70" onClick={() => setPreviewProduct(product)}>
                      {qrUrls[product.id] ? (
                        <img src={qrUrls[product.id]} alt={product.name} className="mx-auto mb-2 w-40 h-40 object-contain" />
                      ) : (
                        <QrCode className="mx-auto text-muted-foreground mb-2" size={48} />
                      )}
                      <p className="text-xs text-muted-foreground font-mono" data-testid={`text-qr-code-${product.id}`}>
                        {product.qrCode}
                      </p>
                    </button>

                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handleDownload(product)} data-testid={`button-download-qr-${product.id}`}>
                        <Download size={14} className="mr-1" />
                        Download
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1" onClick={() => handlePrint(product)}>
                        <Printer size={14} className="mr-1" />
                        Print
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
              
              {/* Show More / Show Less Button */}
              {!searchQuery && filteredProductsWithQR.length > DISPLAY_LIMIT && (
                <div className="mt-6 text-center">
                  <Button
                    variant="outline"
                    onClick={() => setShowAll(!showAll)}
                    className="min-w-[200px]"
                  >
                    {showAll ? (
                      <>Show Less (Display {DISPLAY_LIMIT})</>
                    ) : (
                      <>Show All ({filteredProductsWithQR.length} products)</>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground mt-2">
                    Showing {displayedProducts.length} of {filteredProductsWithQR.length} products
                  </p>
                </div>
              )}
            </>
          ) : searchQuery ? (
            <div className="text-center py-8">
              <Search className="mx-auto text-muted-foreground mb-4" size={48} />
              <h3 className="text-lg font-semibold text-foreground mb-2">No products found</h3>
              <p className="text-muted-foreground">No products match your search "<strong>{searchQuery}</strong>".</p>
              <Button variant="outline" className="mt-4" onClick={() => setSearchQuery("")}>
                Clear Search
              </Button>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Products Needing QR Codes</CardTitle>
            </div>
            <Button
              onClick={() => generateAllQRMutation.mutate(productsWithoutQR.map(p => p.id))}
              disabled={generateAllQRMutation.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-generate-all-qr"
            >
              {generateAllQRMutation.isPending ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <QrCode className="mr-2" size={16} />
                  Generate All ({productsWithoutQR.length})
                </>
              )}
            </Button>
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

      {/* Transfer History Section */}
      <Card className="mt-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Product Transfer History
          </CardTitle>
          {transferHistory.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all transfer history? This cannot be undone.')) {
                  localStorage.removeItem('product_transfers');
                  setTransferHistory([]);
                  toast({
                    title: "History Cleared",
                    description: "All transfer history has been removed.",
                  });
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear History
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {transferHistory.length === 0 ? (
            <div className="text-center py-8">
              <ArrowRightLeft className="w-12 h-12 mx-auto text-muted-foreground mb-3 opacity-50" />
              <p className="text-muted-foreground">No transfer history yet</p>
              <p className="text-sm text-muted-foreground mt-1">Transfer records will appear here when products are transferred between branches.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transferHistory.slice().reverse().map((record) => {
                const product = products?.find(p => p.id === record.productId);
                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-4 border rounded-lg ${
                      record.type === 'admin-update' 
                        ? 'bg-blue-50 border-blue-200' 
                        : record.type === 'transfer' 
                          ? 'bg-orange-50 border-orange-200' 
                          : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        record.type === 'admin-update'
                          ? 'bg-blue-200'
                          : record.type === 'transfer' 
                            ? 'bg-orange-200' 
                            : 'bg-green-200'
                      }`}>
                        {record.type === 'admin-update' ? (
                          <Settings className={`w-5 h-5 text-blue-700`} />
                        ) : record.type === 'transfer' ? (
                          <ArrowRightLeft className={`w-5 h-5 text-orange-700`} />
                        ) : (
                          <PackageCheck className={`w-5 h-5 text-green-700`} />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant={record.type === 'transfer' ? 'default' : 'secondary'} 
                                 className={
                                   record.type === 'admin-update'
                                     ? 'bg-blue-500'
                                     : record.type === 'transfer' 
                                       ? 'bg-orange-500' 
                                       : 'bg-green-500'
                                 }>
                            {record.type === 'admin-update' ? 'Admin Updated' : record.type === 'transfer' ? 'Transfer' : 'Received'}
                          </Badge>
                          <span className="font-medium">{product?.name || 'Unknown Product'}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {record.staffName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {record.fromBranch} → {record.toBranch}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {new Date(record.timestamp).toLocaleDateString()}<br/>
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {previewProduct && qrUrls[previewProduct.id] && (
              <img src={qrUrls[previewProduct.id]} alt={previewProduct.name} className="w-72 h-72" />
            )}
            <div className="flex gap-2 w-full">
              <Button className="flex-1" variant="outline" onClick={() => previewProduct && handleDownload(previewProduct)}>
                <Download size={16} className="mr-2" /> Download
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => previewProduct && handlePrint(previewProduct)}>
                <Printer size={16} className="mr-2" /> Print
              </Button>
            </div>
          </div>
          
          {/* Transfer History for this product */}
          {previewProduct && getProductTransferHistory(previewProduct.id).length > 0 && (
            <>
              <Separator className="my-4" />
              <div>
                <h4 className="font-medium flex items-center gap-2 mb-3">
                  <History className="w-4 h-4" />
                  Transfer History
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getProductTransferHistory(previewProduct.id).slice().reverse().map((record) => (
                    <div
                      key={record.id}
                      className={`p-3 rounded-lg text-sm ${
                        record.type === 'transfer' ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {record.type === 'transfer' ? (
                            <ArrowRightLeft className="w-4 h-4 text-orange-600" />
                          ) : (
                            <PackageCheck className="w-4 h-4 text-green-600" />
                          )}
                          <span className="font-medium">
                            {record.type === 'transfer' ? 'Transferred' : 'Received'}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(record.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" /> {record.staffName}
                        </span>
                        <span className="flex items-center gap-1 mt-0.5">
                          <Building2 className="w-3 h-3" /> {record.fromBranch} → {record.toBranch}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}