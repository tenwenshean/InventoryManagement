import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingCart, 
  Search, 
  Store,
  ArrowLeft,
  Filter,
  Grid3x3,
  List,
  Star,
  Package,
  User,
  LogOut
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import type { Product } from "@/types";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import CustomerLoginModal from "@/components/customer-login-modal";

export default function ShopPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const { toast } = useToast();

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

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log("User logged in on shop page - Full object:", user);
        console.log("User logged in on shop page - Details:", {
          email: user.email,
          displayName: user.displayName,
          uid: user.uid,
          providerData: user.providerData
        });
        setCurrentUser(user);
      } else {
        console.log("No user logged in on shop page");
        setCurrentUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('loginContext');
      setCurrentUser(null);
      toast({
        title: "Logged Out",
        description: "You have been logged out successfully",
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Fetch all products
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/products");
      if (!response.ok) throw new Error("Failed to fetch products");
      return response.json();
    },
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/public/categories");
      if (!response.ok) throw new Error("Failed to fetch categories");
      return response.json();
    },
  });

  // Filter and sort products
  let filteredProducts = products?.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === "all" || product.categoryId === selectedCategory;
    
    return matchesSearch && matchesCategory;
  }) || [];

  // Sort products
  if (sortBy === "price-low") {
    filteredProducts.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
  } else if (sortBy === "price-high") {
    filteredProducts.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
  } else if (sortBy === "name") {
    filteredProducts.sort((a, b) => a.name.localeCompare(b.name));
  }
  // Default is newest (already ordered by createdAt desc from API)

  // Add to cart
  const addToCart = (product: Product) => {
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
  };

  // Calculate cart total
  const cartTotal = cart.reduce(
    (total, item) => total + parseFloat(item.product.price) * item.quantity,
    0
  );

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
                  Back
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <Store className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">All Products</h1>
                  <p className="text-xs text-red-100">Browse our entire catalog</p>
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
              <Button className="relative bg-white text-red-600 hover:bg-red-50">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Cart
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-orange-500 text-white">
                    {cart.length}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Filters Section */}
      <section className="bg-white border-b sticky top-16 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map((category: any) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
              </SelectContent>
            </Select>

            {/* View Toggle */}
            <div className="flex gap-2">
              <Button
                variant={viewMode === "grid" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={viewMode === "grid" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                <Grid3x3 className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="icon"
                onClick={() => setViewMode("list")}
                className={viewMode === "list" ? "bg-red-600 hover:bg-red-700" : ""}
              >
                <List className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold">{filteredProducts.length}</span> product
              {filteredProducts.length !== 1 ? "s" : ""}
            </p>
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="text-red-600"
              >
                Clear search
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Products Grid/List */}
      <section className="container mx-auto px-6 py-8">
        {isLoading ? (
          <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "space-y-4"}>
            {[...Array(8)].map((_, i) => (
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
        ) : filteredProducts.length > 0 ? (
          viewMode === "grid" ? (
            // Grid View
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="hover:shadow-xl transition-all duration-300 border-2 hover:border-red-500"
                >
                  <CardHeader className="p-4">
                    {product.imageUrl ? (
                      <div className="mb-3 w-full h-48 rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="mb-3 w-full h-48 rounded-lg bg-gray-100 flex items-center justify-center">
                        <Package className="w-16 h-16 text-gray-300" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base line-clamp-2">
                          {product.name}
                        </CardTitle>
                        {product.quantity > 0 ? (
                          <Badge className="bg-green-500 shrink-0">In Stock</Badge>
                        ) : (
                          <Badge variant="destructive" className="shrink-0">Out</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {product.description || "No description"}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">4.5</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {product.quantity} available
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-red-600">
                          ${parseFloat(product.price).toFixed(2)}
                        </p>
                      </div>
                      <Button
                        className="w-full bg-red-600 hover:bg-red-700"
                        onClick={() => addToCart(product)}
                        disabled={product.quantity === 0}
                        size="sm"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            // List View
            <div className="space-y-4">
              {filteredProducts.map((product) => (
                <Card
                  key={product.id}
                  className="hover:shadow-lg transition-all duration-300 border-2 hover:border-red-500"
                >
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      {product.imageUrl ? (
                        <div className="w-32 h-32 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                          <Package className="w-12 h-12 text-gray-300" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex-1">
                            <h3 className="text-xl font-bold text-gray-900 mb-1">
                              {product.name}
                            </h3>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {product.description || "No description available"}
                            </p>
                          </div>
                          {product.quantity > 0 ? (
                            <Badge className="bg-green-500">In Stock</Badge>
                          ) : (
                            <Badge variant="destructive">Out of Stock</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="flex items-center gap-1">
                            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                            <span className="text-sm font-medium">4.5</span>
                            <span className="text-xs text-gray-500">(120 reviews)</span>
                          </div>
                          <span className="text-sm text-gray-600">
                            SKU: {product.sku}
                          </span>
                          <span className="text-sm text-gray-600">
                            Available: {product.quantity} units
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end justify-between shrink-0">
                        <p className="text-3xl font-bold text-red-600">
                          ${parseFloat(product.price).toFixed(2)}
                        </p>
                        <Button
                          className="bg-red-600 hover:bg-red-700 w-40"
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
          )
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                No Products Found
              </h3>
              <p className="text-gray-600 mb-4">
                {searchQuery
                  ? `No products match "${searchQuery}"`
                  : "No products available at the moment"}
              </p>
              {searchQuery && (
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="text-red-600 border-red-600"
                >
                  Clear search
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* Cart Summary (Fixed Bottom) */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-red-600 shadow-2xl p-4 z-50">
          <div className="container mx-auto flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                {cart.length} item(s) in cart
              </p>
              <p className="text-2xl font-bold text-gray-900">
                Total: ${cartTotal.toFixed(2)}
              </p>
            </div>
            <Button size="lg" className="bg-red-600 hover:bg-red-700 text-lg px-8">
              Proceed to Checkout
            </Button>
          </div>
        </div>
      )}

      {/* Login Modal */}
      <CustomerLoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setShowLoginModal(false);
        }}
      />
    </div>
  );
}
