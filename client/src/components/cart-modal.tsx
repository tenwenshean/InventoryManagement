import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, Plus, Minus, Trash2, Package, ArrowRight } from "lucide-react";
import { useCustomerCurrency } from "@/hooks/useCustomerCurrency";
import type { Product } from "@/types";

interface CartItem {
  product: Product & { companyName?: string };
  quantity: number;
}

interface CartModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (productId: string, newQuantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onCheckout: () => void;
}

export default function CartModal({ isOpen, onClose, cart, onUpdateQuantity, onRemoveItem, onCheckout }: CartModalProps) {
  const { formatPrice } = useCustomerCurrency();
  
  const cartTotal = cart.reduce(
    (total, item) => total + parseFloat(item.product.price) * item.quantity,
    0
  );

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <ShoppingCart className="w-6 h-6" />
            Shopping Cart
            {cart.length > 0 && (
              <Badge className="bg-red-600">{totalItems} {totalItems === 1 ? 'item' : 'items'}</Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {cart.length === 0 ? (
          <div className="py-12 text-center">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h3>
            <p className="text-gray-600 mb-6">Add some products to get started!</p>
            <Button onClick={onClose} className="bg-red-600 hover:bg-red-700">
              Continue Shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Cart Items */}
            <div className="space-y-4">
              {cart.map((item) => (
                <div key={item.product.id} className="flex gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow">
                  {/* Product Image */}
                  <div className="w-20 h-20 flex-shrink-0">
                    {item.product.imageUrl ? (
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 rounded flex items-center justify-center">
                        <Package className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{item.product.name}</h4>
                    {item.product.companyName && (
                      <p className="text-sm text-gray-500">by {item.product.companyName}</p>
                    )}
                    <p className="text-lg font-bold text-red-600 mt-1">
                      {formatPrice(parseFloat(item.product.price))}
                    </p>
                    
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="w-12 text-center font-semibold">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                        disabled={item.quantity >= (item.product.quantity || 0)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      
                      {/* Remove Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => onRemoveItem(item.product.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Item Subtotal */}
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Subtotal</p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatPrice(parseFloat(item.product.price) * item.quantity)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Separator />

            {/* Cart Summary */}
            <div className="space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">Shipping</span>
                <span className="font-semibold text-green-600">
                  {cartTotal >= 50 ? 'FREE' : '$5.00'}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-2xl font-bold">
                <span>Total</span>
                <span className="text-red-600">
                  {formatPrice(cartTotal + (cartTotal >= 50 ? 0 : 5))}
                </span>
              </div>
              {cartTotal < 50 && (
                <p className="text-sm text-gray-600 text-center">
                  Add {formatPrice(50 - cartTotal)} more for FREE shipping!
                </p>
              )}
            </div>

            {/* Checkout Button */}
            <Button
              className="w-full bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white py-6 text-lg"
              onClick={onCheckout}
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
