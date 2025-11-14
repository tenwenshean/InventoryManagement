import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  ShoppingCart, 
  Search, 
  Package, 
  Store,
  Shield,
  Truck,
  Award,
  Star,
  Clock,
  CheckCircle2,
  User,
  LogOut,
  Eye
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Product } from "@/types";
import CustomerLoginModal from "@/components/customer-login-modal";
import ProductDetailModal from "@/components/product-detail-modal";
import CartModal from "@/components/cart-modal";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";

export default function CustomerPortal() {
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<{ product: Product & { companyName?: string }; quantity: number }[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showCartModal, setShowCartModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<(Product & { companyName?: string }) | null>(null);
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Force logout enterprise users when accessing customer portal
  useEffect(() => {
    const checkAndLogoutEnterpriseUser = async () => {
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        // Check if user logged in with Google (enterprise account)
        const isGoogleUser = currentUser.providerData.some(
          provider => provider.providerId === 'google.com'
        );
        
        const isEmailUser = currentUser.email && !currentUser.phoneNumber;
        
        // If user is logged in with Google or Email (enterprise), force logout
        if (isGoogleUser || isEmailUser) {
          console.log("Enterprise user detected on customer portal - logging out");
          try {
            await signOut(auth);
            toast({
              title: "Logged Out",
              description: "Customer portal requires phone number login. Please login with your phone number.",
              variant: "default",
            });
          } catch (error) {
            console.error("Error logging out enterprise user:", error);
          }
        }
      }
      
      setIsCheckingAuth(false);
    };

    checkAndLogoutEnterpriseUser();
  }, [toast]);

  // Listen to auth state changes - only allow phone number users
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Only allow phone number authentication for customer portal
        const isPhoneUser = user.phoneNumber && user.providerData.some(
          provider => provider.providerId === 'phone'
        );
        
        if (isPhoneUser) {
          setCustomerUser(user);
          console.log("Customer logged in with phone:", user.phoneNumber);
        } else {
          // If not a phone user, sign them out
          console.log("Non-phone user detected, signing out");
          signOut(auth).catch(console.error);
          setCustomerUser(null);
        }
      } else {
        setCustomerUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setCustomerUser(null);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Fetch all products (public access - no auth required) - only from users with company names
  const { data: products, isLoading } = useQuery<(Product & { companyName?: string; sellerEmail?: string; sellerName?: string })[]>({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  // Filter products based on search
  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get recently added products (last 6)
  const recentProducts = products?.slice(0, 6) || [];

  // Add to cart
  const addToCart = (product: Product & { companyName?: string }) => {
    const existingItem = cart.find((item) => item.product.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { product, quantity: 1 }]);
    }
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart`,
    });
  };

  // Update cart quantity
  const updateCartQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(cart.map(item => 
      item.product.id === productId 
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
    toast({
      title: "Removed from cart",
      description: "Item has been removed from your cart",
    });
  };

  // Handle checkout
  const handleCheckout = () => {
    if (!customerUser) {
      setShowCartModal(false);
      setShowLoginModal(true);
      toast({
        title: "Login Required",
        description: "Please login to proceed with checkout",
        variant: "default",
      });
      return;
    }
    
    toast({
      title: "Checkout",
      description: "Proceeding to checkout...",
    });
    // Implement actual checkout logic here
  };

  // Calculate cart total
  const cartTotal = cart.reduce(
    (total, item) => total + parseFloat(item.product.price) * item.quantity,
    0
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header/Navigation */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Store className="w-10 h-10" />
              <div>
                <h1 className="text-2xl font-bold">InventoryPro Store</h1>
                <p className="text-sm text-red-100">Quality Products, Delivered Fast</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {customerUser ? (
                <>
                  <div className="hidden md:flex items-center space-x-2 bg-white/10 px-4 py-2 rounded-lg">
                    <User className="w-4 h-4" />
                    <span className="text-sm">{customerUser.phoneNumber}</span>
                  </div>
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
              <Button className="relative bg-white text-red-600 hover:bg-red-50" onClick={() => setShowCartModal(true)}>
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cart
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white">
                    {cart.reduce((total, item) => total + item.quantity, 0)}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section with Search */}
      <section className="bg-gradient-to-br from-red-50 via-white to-orange-50 py-16">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h2 className="text-5xl font-bold text-gray-900 mb-4">
              Find Your Perfect Product
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Browse our extensive catalog of quality products at competitive prices
            </p>
            
            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-6 h-6" />
              <Input
                type="text"
                placeholder="Search for products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 pr-4 py-7 text-lg border-2 border-gray-300 focus:border-red-500 rounded-full shadow-lg"
              />
            </div>

            {/* Shop All Products Button */}
            <Link href="/shop">
              <Button 
                size="lg" 
                className="bg-gradient-to-r from-red-600 to-orange-500 hover:from-red-700 hover:to-orange-600 text-white px-8 py-6 text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
              >
                <Store className="w-6 h-6 mr-2" />
                Shop All Products
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Why Buy From Us Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Why Buy From Us?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-red-500 transition-all hover:shadow-xl">
              <CardContent className="p-8 text-center">
                <div className="bg-red-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-10 h-10 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Quality Guaranteed</h3>
                <p className="text-gray-600">
                  All our products undergo rigorous quality checks to ensure you receive only the best. 100% satisfaction guaranteed or your money back.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-red-500 transition-all hover:shadow-xl">
              <CardContent className="p-8 text-center">
                <div className="bg-orange-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Truck className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Fast Delivery</h3>
                <p className="text-gray-600">
                  Free shipping on orders over $50. Express delivery available. Track your order in real-time from warehouse to your doorstep.
                </p>
              </CardContent>
            </Card>

            <Card className="border-2 hover:border-red-500 transition-all hover:shadow-xl">
              <CardContent className="p-8 text-center">
                <div className="bg-green-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Award className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Best Prices</h3>
                <p className="text-gray-600">
                  Competitive pricing with regular discounts and promotions. Price match guarantee - we'll beat any competitor's price.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recently Added Products */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-4xl font-bold text-gray-900 mb-2">Recently Added</h2>
              <p className="text-gray-600">Check out our latest products</p>
            </div>
            <Badge className="bg-red-600 text-white px-4 py-2 text-sm">
              <Clock className="w-4 h-4 mr-2 inline" />
              New Arrivals
            </Badge>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-4">
                      <div className="h-48 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : recentProducts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recentProducts.map((product) => (
                <Card
                  key={product.id}
                  className="hover:shadow-xl transition-all duration-300 border-2 hover:border-red-500"
                >
                  <CardHeader>
                    {product.imageUrl && (
                      <div className="mb-4 w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-xl">{product.name}</CardTitle>
                        {product.companyName && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-gray-600">
                            <Store className="w-4 h-4" />
                            <span>{product.companyName}</span>
                          </div>
                        )}
                        <CardDescription className="mt-2 line-clamp-2">
                          {product.description || "No description available"}
                        </CardDescription>
                      </div>
                      {product.quantity > 0 ? (
                        <Badge className="bg-green-500">In Stock</Badge>
                      ) : (
                        <Badge variant="destructive">Out of Stock</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">SKU: {product.sku}</p>
                          <p className="text-sm text-gray-600">
                            Available: {product.quantity} units
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-3xl font-bold text-red-600">
                            ${parseFloat(product.price).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          onClick={() => addToCart(product)}
                          disabled={product.quantity === 0}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-12 text-center">
                <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No Products Available
                </h3>
                <p className="text-gray-600">Check back soon for new arrivals!</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Customer Reviews Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            What Our Customers Say
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "Small Business Owner",
                review: "Amazing quality and fast shipping! I've been ordering from InventoryPro for 6 months now and never been disappointed. Highly recommended!",
                rating: 5,
              },
              {
                name: "Michael Chen",
                role: "Retail Manager",
                review: "The best prices I've found anywhere. Customer service is top-notch and they always go the extra mile to ensure satisfaction.",
                rating: 5,
              },
              {
                name: "Emily Rodriguez",
                role: "E-commerce Entrepreneur",
                review: "Reliable supplier with consistent quality. Their inventory is always up-to-date and delivery is lightning fast. A+ service!",
                rating: 5,
              },
            ].map((review, index) => (
              <Card key={index} className="border-2 hover:shadow-lg transition-all">
                <CardContent className="p-6">
                  <div className="flex mb-4">
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-4 italic">"{review.review}"</p>
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg mr-3">
                      {review.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{review.name}</p>
                      <p className="text-sm text-gray-600">{review.role}</p>
                    </div>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-green-500 mt-4" />
                  <p className="text-xs text-green-600 mt-1">Verified Purchase</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* All Products Section (Search Results) */}
      {searchQuery && (
        <section className="py-16 bg-gray-50">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">
              Search Results for "{searchQuery}"
            </h2>
            {filteredProducts && filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="hover:shadow-xl transition-all duration-300"
                  >
                    <CardHeader>
                      {product.imageUrl && (
                        <div className="mb-4 w-full h-32 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      {product.companyName && (
                        <div className="flex items-center gap-1 text-xs text-gray-600">
                          <Store className="w-3 h-3" />
                          <span>{product.companyName}</span>
                        </div>
                      )}
                      {product.quantity > 0 ? (
                        <Badge className="bg-green-500 w-fit">In Stock</Badge>
                      ) : (
                        <Badge variant="destructive" className="w-fit">Out of Stock</Badge>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold text-red-600 mb-4">
                        ${parseFloat(product.price).toFixed(2)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setSelectedProduct(product)}
                          size="sm"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Button
                          className="flex-1 bg-red-600 hover:bg-red-700"
                          onClick={() => addToCart(product)}
                          disabled={product.quantity === 0}
                          size="sm"
                        >
                          <ShoppingCart className="w-4 h-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    No Products Found
                  </h3>
                  <p className="text-gray-600">Try adjusting your search terms</p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Store className="w-8 h-8" />
                <h3 className="text-xl font-bold">InventoryPro</h3>
              </div>
              <p className="text-gray-400">
                Your trusted source for quality products at competitive prices.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-gray-400">
                <li>About Us</li>
                <li>Contact</li>
                <li>FAQ</li>
                <li>Shipping Info</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Customer Service</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Track Order</li>
                <li>Returns</li>
                <li>Privacy Policy</li>
                <li>Terms & Conditions</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contact Us</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Email: support@inventorypro.com</li>
                <li>Phone: 1-800-INVENTORY</li>
                <li>Hours: Mon-Fri 9AM-6PM</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 InventoryPro. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Cart Summary (Fixed Bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-red-600 shadow-2xl p-4 z-50">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {cart.reduce((total, item) => total + item.quantity, 0)} item(s) in cart
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Total: ${cartTotal.toFixed(2)}
              </p>
            </div>
            <Button 
              size="lg" 
              className="bg-red-600 hover:bg-red-700 text-lg px-8"
              onClick={() => setShowCartModal(true)}
            >
              View Cart & Checkout
            </Button>
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          onAddToCart={addToCart}
        />
      )}

      {/* Cart Modal */}
      <CartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        onUpdateQuantity={updateCartQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
      />

      {/* Customer Login Modal */}
      <CustomerLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCustomerUser(user);
          toast({
            title: "Welcome!",
            description: `Logged in as ${user.phoneNumber}`,
          });
        }}
      />
    </div>
  );
}
