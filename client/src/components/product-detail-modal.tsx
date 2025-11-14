import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Package, ShoppingCart, Store, MapPin, FileText, DollarSign, Hash, Layers } from "lucide-react";
import type { Product } from "@/types";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product & { companyName?: string; sellerName?: string };
  onAddToCart: (product: Product) => void;
}

export default function ProductDetailModal({ isOpen, onClose, product, onAddToCart }: ProductDetailModalProps) {
  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">{product.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Image */}
          {product.imageUrl ? (
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-96 object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <Package className="w-20 h-20 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No Image Available</p>
              </div>
            </div>
          )}

          {/* Company Info */}
          {product.companyName && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <Store className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Sold by</p>
                <p className="font-semibold text-gray-900">{product.companyName}</p>
              </div>
            </div>
          )}

          {/* Description */}
          {product.description && (
            <div>
              <h3 className="font-semibold text-lg mb-2">Description</h3>
              <p className="text-gray-700">{product.description}</p>
            </div>
          )}

          <Separator />

          {/* Product Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Price */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-gray-500 uppercase">Price</p>
                <p className="text-2xl font-bold text-green-600">${parseFloat(product.price).toFixed(2)}</p>
              </div>
            </div>

            {/* Stock */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Package className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-gray-500 uppercase">In Stock</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{product.quantity ?? 0} units</p>
                  {product.quantity > 0 ? (
                    <Badge className="bg-green-500">Available</Badge>
                  ) : (
                    <Badge variant="destructive">Out of Stock</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* SKU */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <Hash className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-gray-500 uppercase">SKU</p>
                <p className="font-semibold text-gray-900">{product.sku}</p>
              </div>
            </div>

            {/* Category */}
            {product.categoryId && (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Layers className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-xs text-gray-500 uppercase">Category</p>
                  <p className="font-semibold text-gray-900">{product.categoryId}</p>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          {product.location && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-900 uppercase mb-1">Location</p>
                <p className="text-gray-700">{product.location}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {product.notes && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <FileText className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900 uppercase mb-1">Additional Information</p>
                <p className="text-gray-700 whitespace-pre-wrap">{product.notes}</p>
              </div>
            </div>
          )}

          <Separator />

          {/* Add to Cart Button */}
          <Button
            className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white py-6 text-lg"
            onClick={() => {
              onAddToCart(product);
              onClose();
            }}
            disabled={product.quantity === 0}
          >
            <ShoppingCart className="w-5 h-5 mr-2" />
            {product.quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
