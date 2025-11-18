import { useEffect, useMemo, useState } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { QrCode, MapPin, FileText, Package, DollarSign, Hash, Layers } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

export default function ScanPage() {
  const { formatCurrency } = useCurrency();
  const defaultUnitLabel = useMemo(() => {
    try { return localStorage.getItem('app_defaultUnit') || 'units'; } catch { return 'units'; }
  }, []);
  const [, params] = useRoute("/scan/:code");
  const code = params?.code ? decodeURIComponent(params.code) : "";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<any | null>(null);
  const [categoryName, setCategoryName] = useState<string>('N/A');

  const qrImageUrl = (size = 200) => {
    const target = `${window.location.origin}/scan/${encodeURIComponent(code)}`;
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(target)}`;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/qr/${encodeURIComponent(code)}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const js = await res.json();
        if (!mounted) return;
        setProduct(js.product);
        
        // Fetch category name if categoryId exists
        if (js.product?.categoryId) {
          try {
            const catRes = await fetch(`/api/public/categories`);
            if (catRes.ok) {
              const categories = await catRes.json();
              const category = categories.find((c: any) => c.id === js.product.categoryId);
              if (category && mounted) {
                setCategoryName(category.name);
              }
            }
          } catch (e) {
            console.error('Failed to fetch category:', e);
          }
        }
      } catch (e: any) {
        if (!mounted) return;
        setError("QR not found or invalid");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <QrCode size={28} /> Product Information
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading product...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 text-lg font-semibold mb-2">{error}</div>
              <p className="text-gray-500">Please scan a valid QR code</p>
            </div>
          ) : !product ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <div className="text-gray-600">QR code not found</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Image */}
              <div className="flex justify-center">
                {product.imageUrl ? (
                  <img 
                    src={product.imageUrl} 
                    alt={product.name}
                    className="w-full max-w-md h-64 object-cover rounded-lg shadow-md"
                  />
                ) : (
                  <div className="w-full max-w-md h-64 bg-gray-100 rounded-lg shadow-md flex items-center justify-center">
                    <div className="text-center">
                      <Package className="w-16 h-16 mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 font-medium">No Picture Available</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Product Details */}
              <div className="space-y-4">
                {/* Product Name */}
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
                  {product.description && (
                    <p className="text-gray-600 mt-1">{product.description}</p>
                  )}
                </div>

                {/* Key Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SKU */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Hash className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">SKU</p>
                      <p className="font-semibold text-gray-900">{product.sku}</p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Price</p>
                      <p className="font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Layers className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Category</p>
                      <p className="font-semibold text-gray-900">{categoryName}</p>
                    </div>
                  </div>

                  {/* Quantity */}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Package className="w-5 h-5 text-orange-600" />
                    <div>
                      <p className="text-xs text-gray-500 uppercase">In Stock</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{product.quantity ?? 0} {defaultUnitLabel}</p>
                        {product.quantity > 0 ? (
                          <Badge className="bg-green-500">Available</Badge>
                        ) : (
                          <Badge variant="destructive">Out of Stock</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Location */}
                {product.location && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900 uppercase mb-1">Storage Location</p>
                      <p className="text-gray-700">{product.location}</p>
                    </div>
                  </div>
                )}

                {/* Notes/Remarks */}
                {product.notes && (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 uppercase mb-1">Notes / Remarks</p>
                      <p className="text-gray-700 whitespace-pre-wrap">{product.notes}</p>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* QR Code */}
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">QR Code</p>
                <img src={qrImageUrl(140)} alt="QR" className="mx-auto border-2 border-gray-200 rounded-lg" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


