import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Download, RefreshCw, Package, Printer } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Product } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useEffect, useMemo, useState } from "react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type defs may not be installed in this environment
import QRCode from "qrcode";

export default function QRCodes() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({});

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
    staleTime: 1000 * 30, // Consider data stale after 30 seconds
    refetchOnMount: true,
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
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Print QR - ${product.name}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;">`);
    w.document.write(`<div style="text-align:center;font-family:sans-serif;padding:24px;">`);
    w.document.write(`<h3 style="margin:0 0 12px;">${product.name}</h3>`);
    w.document.write(`<img src="${imgUrl}" style="width:300px;height:300px;" />`);
    w.document.write(`<p style="margin-top:8px;font-size:12px;color:#555;">Scan to continue</p>`);
    w.document.write(`</div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  // QR code generation mutation
  const generateQRMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("POST", `/api/products/${productId}/qr`);
      if (!response.ok) throw new Error("Failed to generate QR code");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
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

      <Dialog open={!!previewProduct} onOpenChange={() => setPreviewProduct(null)}>
        <DialogContent>
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
        </DialogContent>
      </Dialog>
    </>
  );
}