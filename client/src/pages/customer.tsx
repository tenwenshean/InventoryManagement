import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useCustomerCurrency } from "@/hooks/useCustomerCurrency";
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
  Eye,
  Menu,
  X
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Product } from "@/types";
import CustomerLoginModal from "@/components/customer-login-modal";
import ProductDetailModal from "@/components/product-detail-modal";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import SearchShops from "@/components/search-shops";

export default function CustomerPortal() {
  const { formatPrice } = useCustomerCurrency();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<(Product & { companyName?: string }) | null>(null);
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [pendingProduct, setPendingProduct] = useState<(Product & { companyName?: string }) | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartValidated, setCartValidated] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();
  const { addToCart, cartCount, validateAndCleanCart, isValidating } = useCart();
  const queryClient = useQueryClient();

  // Debounce search input for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Invalidate and refetch products when customer page loads to ensure fresh data
  useEffect(() => {
    console.log("Customer portal mounted - invalidating products cache");
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
  }, [queryClient]);

  // Validate cart when user logs in - remove products that no longer exist
  useEffect(() => {
    const validateCart = async () => {
      if (cartValidated || isValidating || !customerUser) return;
      
      const { removedProducts } = await validateAndCleanCart();
      setCartValidated(true);
      
      if (removedProducts.length > 0) {
        toast({
          title: "Cart Updated",
          description: `Removed ${removedProducts.length} unavailable item(s): ${removedProducts.join(", ")}`,
          variant: "destructive",
        });
      }
    };
    
    if (customerUser && cartCount > 0) {
      validateCart();
    }
  }, [customerUser, cartCount, cartValidated, isValidating, validateAndCleanCart, toast]);

  // Helper function to get display name
  const getDisplayName = (user: any): string => {
    if (!user) return "Guest";
    
    // Try display name first
    if (user.displayName && user.displayName.trim() !== "") {
      return user.displayName;
    }
    
    // Try email
    if (user.email && user.email.trim() !== "") {
      return user.email;
    }
    
    // Try to extract from provider data
    if (user.providerData && user.providerData.length > 0) {
      const providerData = user.providerData[0];
      if (providerData.displayName && providerData.displayName.trim() !== "") {
        return providerData.displayName;
      }
      if (providerData.email && providerData.email.trim() !== "") {
        return providerData.email;
      }
    }
    
    // Fallback
    return "User";
  };

  // Listen to auth state changes - allow any authenticated user
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("Customer logged in - Full user object:", user);
        console.log("Customer logged in - Details:", {
          email: user.email,
          displayName: user.displayName,
          uid: user.uid,
          photoURL: user.photoURL,
          emailVerified: user.emailVerified,
          providerId: user.providerId,
          providerData: user.providerData
        });
        setCustomerUser(user);
      } else {
        console.log("No customer user logged in");
        setCustomerUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('loginContext');
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
  // Server now filters out inactive products automatically
  const { data: products, isLoading } = useQuery<(Product & { companyName?: string; sellerEmail?: string; sellerName?: string })[]>({
    queryKey: queryKeys.publicProducts.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
    staleTime: 30 * 1000, // Cache for 30 seconds to reflect enterprise updates faster
    refetchOnWindowFocus: true,
  });

  // Filter products based on search
  const filteredProducts = products?.filter((product) => {
    if (!debouncedSearch) return true;
    
    const query = debouncedSearch.toLowerCase();
    const name = (product.name || '').toLowerCase();
    const description = (product.description || '').toLowerCase();
    const sku = (product.sku || '').toLowerCase();
    const companyName = (product.companyName || '').toLowerCase();
    
    // Fuzzy search: match if query appears anywhere in the fields
    return name.includes(query) || 
           description.includes(query) || 
           sku.includes(query) ||
           companyName.includes(query);
  }).sort((a, b) => {
    // Sort by relevance when searching
    if (!debouncedSearch) return 0;
    
    const query = debouncedSearch.toLowerCase();
    const aName = (a.name || '').toLowerCase();
    const bName = (b.name || '').toLowerCase();
    
    // Exact matches at the start of the name come first
    const aStartsWith = aName.startsWith(query);
    const bStartsWith = bName.startsWith(query);
    
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    
    // Then sort by name contains query
    const aIncludes = aName.includes(query);
    const bIncludes = bName.includes(query);
    
    if (aIncludes && !bIncludes) return -1;
    if (!aIncludes && bIncludes) return 1;
    
    // Finally alphabetically
    return aName.localeCompare(bName);
  });

  // Get recently added products (last 6)
  const recentProducts = products?.slice(0, 6) || [];

  // Add toast notification when adding to cart
  const handleAddToCart = (product: Product & { companyName?: string }) => {
    // Check if user is logged in
    if (!customerUser) {
      setPendingProduct(product); // Store product to add after login
      setShowLoginModal(true);
      toast({
        title: "Login Required",
        description: "Please log in to add items to your cart",
        variant: "destructive",
      });
      return;
    }

    addToCart(product);
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart`,
    });
  };

  // Handle successful login - add pending product if any
  const handleLoginSuccess = (user: any) => {
    setCustomerUser(user);
    setShowLoginModal(false);
    
    // Add pending product to cart after login
    if (pendingProduct) {
      addToCart(pendingProduct);
      toast({
        title: "Added to cart",
        description: `${pendingProduct.name} has been added to your cart`,
      });
      setPendingProduct(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-white text-red-600 p-2 rounded-lg shadow-lg hover:bg-red-50"
      >
        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Sidebar */}
      <div
        className={`md:hidden fixed top-0 left-0 h-full w-64 bg-white shadow-xl z-40 transform transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6 pt-16">
          <div className="space-y-4">
            {customerUser && (
              <>
                <div className="pb-4 border-b">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-5 h-5 text-red-600" />
                    <span className="text-sm text-gray-600">Logged in as</span>
                  </div>
                  <p className="font-medium text-gray-900 truncate">
                    {getDisplayName(customerUser)}
                  </p>
                </div>
                <Link href="/customer-profile">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4 mr-2" />
                    My Profile
                  </Button>
                </Link>
              </>
            )}
            <Link href="/shop">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <Store className="w-4 h-4 mr-2" />
                Shop All Products
              </Button>
            </Link>
            {customerUser ? (
              <Button
                variant="outline"
                className="w-full justify-start text-red-600 border-red-600 hover:bg-red-50"
                onClick={() => {
                  handleLogout();
                  setIsMobileMenuOpen(false);
                }}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            ) : (
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setShowLoginModal(true);
                  setIsMobileMenuOpen(false);
                }}
              >
                <User className="w-4 h-4 mr-2" />
                Login
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Header/Navigation */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white sticky top-0 z-20 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 ml-12 md:ml-0">
              <Store className="w-8 h-8 md:w-10 md:h-10" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold">InventoryPro Store</h1>
                <p className="text-xs md:text-sm text-red-100 hidden sm:block">Quality Products, Delivered Fast</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 md:space-x-3">
              {customerUser ? (
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
                          {getDisplayName(customerUser)}
                        </div>
                      </div>
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    className="hidden md:flex bg-white/10 border-white/20 hover:bg-white/20 text-white"
                    onClick={handleLogout}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </>
              ) : (
                <Button
                  className="hidden md:flex bg-white text-red-600 hover:bg-red-50"
                  onClick={() => setShowLoginModal(true)}
                >
                  <User className="w-4 h-4 mr-2" />
                  Login
                </Button>
              )}
              <Link href="/cart">
                <Button className="relative bg-white text-red-600 hover:bg-red-50 px-3 md:px-4">
                  <ShoppingCart className="w-5 h-5 md:mr-2" />
                  <span className="hidden md:inline">Cart</span>
                  {cartCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white">
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>
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
                placeholder="Search for products or shops..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 pr-4 py-7 text-lg border-2 border-gray-300 focus:border-red-500 rounded-full shadow-lg"
              />
            </div>

            {/* Search Results - Shops */}
            {debouncedSearch && (
              <SearchShops searchQuery={debouncedSearch} />
            )}

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

      {/* Search Results Section */}
      {debouncedSearch && filteredProducts && (
        <section className="py-8 bg-gray-50 border-b">
          <div className="container mx-auto px-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Search Results for "{debouncedSearch}"
            </h3>
            <p className="text-gray-600 mb-6">
              Found {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'}
            </p>
            
            {filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {filteredProducts.slice(0, 8).map((product) => (
                  <Card
                    key={product.id}
                    className="hover:shadow-xl transition-all duration-300 border-2 hover:border-red-500 cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <CardHeader className="p-4">
                      {product.imageUrl && (
                        <div className="mb-3 w-full h-40 rounded-lg overflow-hidden bg-gray-100">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <CardTitle className="text-lg line-clamp-1">{product.name}</CardTitle>
                      {product.companyName && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-gray-600">
                          <Store className="w-3 h-3" />
                          <span className="line-clamp-1">{product.companyName}</span>
                        </div>
                      )}
                    </CardHeader>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                        <p className="text-lg font-bold text-red-600">
                        {formatPrice(product.price, (product as any).sellerCurrency)}
                        </p>
                        {product.quantity > 0 ? (
                          <Badge className="bg-green-500">In Stock</Badge>
                        ) : (
                          <Badge variant="destructive">Out</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(product);
                        }}
                        disabled={product.quantity === 0}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
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
                  <p className="text-gray-600">
                    Try searching with different keywords or browse all products below.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      )}

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
                            {formatPrice(product.price, (product as any).sellerCurrency)}
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
                          onClick={() => handleAddToCart(product)}
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
                        {formatPrice(product.price, (product as any).sellerCurrency)}
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
                          onClick={() => handleAddToCart(product)}
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

      {/* Product Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          product={selectedProduct}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Customer Login Modal */}
      <CustomerLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCustomerUser(user);
          toast({
            title: "Welcome!",
            description: `Logged in as ${getDisplayName(user)}`,
          });
        }}
      />
    </div>
  );
}
