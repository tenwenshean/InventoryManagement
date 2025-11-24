import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ShoppingCart,
  Store,
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Package,
  User,
  LogOut,
  CreditCard
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import CustomerLoginModal from "@/components/customer-login-modal";
import { useCart } from "@/contexts/CartContext";
import { useQueryClient } from "@tanstack/react-query";

export default function CartPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { cart, updateCartQuantity, removeFromCart, clearCart, cartTotal, cartCount } = useCart();
  const queryClient = useQueryClient();

  // Helper function to get display name
  const getDisplayName = (user: any): string => {
    if (!user) return "Guest";
    
    if (user.displayName && user.displayName.trim() !== "") {
      return user.displayName;
    }
    
    if (user.email && user.email.trim() !== "") {
      return user.email;
    }
    
    if (user.providerData && user.providerData.length > 0) {
      const providerData = user.providerData[0];
      if (providerData.displayName && providerData.displayName.trim() !== "") {
        return providerData.displayName;
      }
      if (providerData.email && providerData.email.trim() !== "") {
        return providerData.email;
      }
    }
    
    return "User";
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthChecked(true);
      
      // Only show login modal if user is not logged in after auth check completes
      if (!user) {
        setShowLoginModal(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('loginContext');
      // Clear cache to ensure fresh data after logout
      queryClient.clear();
      setCurrentUser(null);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
      setLocation("/customer");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Handle checkout
  const handleCheckout = () => {
    if (!currentUser) {
      setShowLoginModal(true);
      toast({
        title: "Login Required",
        description: "Please login to proceed with checkout",
        variant: "default",
      });
      return;
    }
    
    if (cartCount === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty",
        variant: "destructive",
      });
      return;
    }
    
    // Navigate to checkout page
    setLocation("/checkout");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/customer">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Shop
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <ShoppingCart className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">Shopping Cart</h1>
                  <p className="text-xs text-red-100">{cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {currentUser ? (
                <>
                  <Link href="/customer-profile">
                    <Button
                      variant="ghost"
                      className="hidden md:flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white"
                    >
                      <User className="w-4 h-4" />
                      <div className="text-left">
                        <div className="text-xs text-red-100">Logged in as</div>
                        <div className="text-sm font-medium">
                          {getDisplayName(currentUser)}
                        </div>
                      </div>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="bg-white/10 border-white/20 hover:bg-white/20 text-white"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  className="bg-white text-red-600 hover:bg-red-50"
                  onClick={() => setShowLoginModal(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Cart Content */}
      <section className="container mx-auto px-6 py-8">
        {cart.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Your cart is empty
              </h3>
              <p className="text-gray-600 mb-6">
                Start shopping to add items to your cart
              </p>
              <Link href="/shop">
                <Button className="bg-red-600 hover:bg-red-700">
                  <Store className="w-4 h-4 mr-2" />
                  Browse Products
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">Cart Items</h2>
                <Button
                  variant="outline"
                  onClick={clearCart}
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Cart
                </Button>
              </div>

              {cart.map((item) => (
                <Card key={item.product.id} className="hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {/* Product Image */}
                      {item.product.imageUrl ? (
                        <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package className="w-12 h-12 text-gray-300" />
                        </div>
                      )}

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">
                          {item.product.name}
                        </h3>
                        {item.product.companyName && (
                          <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                            <Store className="w-4 h-4" />
                            <span>{item.product.companyName}</span>
                          </div>
                        )}
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {item.product.description || "No description available"}
                        </p>
                        <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
                        
                        {/* Stock Badge */}
                        {item.product.quantity > 0 ? (
                          <Badge className="bg-green-500 mt-2">
                            {item.product.quantity} in stock
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="mt-2">Out of Stock</Badge>
                        )}
                      </div>

                      {/* Price and Quantity Controls */}
                      <div className="flex flex-col items-end justify-between shrink-0">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-red-600">
                            ${parseFloat(item.product.price).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">per item</p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              updateCartQuantity(item.product.id, Math.max(1, Math.min(val, item.product.quantity)));
                            }}
                            className="w-16 text-center"
                            min="1"
                            max={item.product.quantity}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                            disabled={item.quantity >= item.product.quantity}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Remove Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-red-600 hover:bg-red-50 mt-2"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>

                        {/* Subtotal */}
                        <div className="text-right mt-2">
                          <p className="text-xs text-gray-500">Subtotal:</p>
                          <p className="text-lg font-bold text-gray-900">
                            ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal ({cartCount} items)</span>
                      <span className="font-medium">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Shipping</span>
                      <span className="font-medium">$10.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tax (estimated)</span>
                      <span className="font-medium">${(cartTotal * 0.1).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-baseline mb-6">
                      <span className="text-lg font-semibold">Total</span>
                      <span className="text-3xl font-bold text-red-600">
                        ${(cartTotal * 1.1 + 10).toFixed(2)}
                      </span>
                    </div>

                    <Button
                      className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg"
                      onClick={handleCheckout}
                      disabled={!currentUser}
                    >
                      <CreditCard className="w-5 h-5 mr-2" />
                      Proceed to Checkout
                    </Button>

                    {!currentUser && (
                      <p className="text-xs text-center text-gray-500 mt-2">
                        Please login to checkout
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-4 space-y-2 text-xs text-gray-600">
                    <div className="flex items-start gap-2">
                      <Package className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Standard shipping: $10.00</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <CreditCard className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>Secure payment processing</span>
                    </div>
                  </div>

                  <Link href="/shop">
                    <Button variant="outline" className="w-full">
                      <Store className="w-4 h-4 mr-2" />
                      Continue Shopping
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* Login Modal */}
      <CustomerLoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          if (!currentUser) {
            setLocation("/customer");
          }
        }}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          toast({
            title: "Welcome!",
            description: `Logged in as ${getDisplayName(user)}`,
          });
        }}
      />
    </div>
  );
}
