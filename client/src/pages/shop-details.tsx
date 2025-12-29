import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryKeys } from "@/lib/queryKeys";
import { auth } from "@/lib/firebaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import ProductDetailModal from "@/components/product-detail-modal";
import CustomerLoginModal from "@/components/customer-login-modal";
import {
  Store,
  Bell,
  BellOff,
  Package,
  ArrowLeft,
  ShoppingCart,
  Plus,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Globe,
  Facebook,
  Instagram,
  Twitter
} from "lucide-react";
import type { Product } from "@/types";
import { useCustomerCurrency } from "@/hooks/useCustomerCurrency";

// Helper function to ensure URL has proper protocol for external links
const ensureExternalUrl = (url: string): string => {
  if (!url) return url;
  // If URL already has a protocol, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // Add https:// prefix for external URLs
  return `https://${url}`;
};

export default function ShopDetailsPage() {
  const { formatPrice } = useCustomerCurrency();
  const [, params] = useRoute("/shop/:shopSlug");
  const shopSlug = params?.shopSlug;
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellerId, setSellerId] = useState<string | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { addToCart } = useCart();

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCustomerUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Fetch seller info by shop slug
  const { data: seller, isLoading: sellerLoading, error: sellerError } = useQuery({
    queryKey: ['seller-by-slug', shopSlug],
    queryFn: async () => {
      console.log('Fetching shop by slug:', shopSlug);
      const response = await apiRequest('GET', `/api/shops/by-slug/${shopSlug}`);
      console.log('Shop API response status:', response.status);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to fetch shop:', errorData);
        throw new Error('Failed to fetch shop');
      }
      const data = await response.json();
      console.log('Shop data:', data);
      setSellerId(data.id);
      return data;
    },
    enabled: !!shopSlug,
    retry: 1,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });

  // Fetch seller's products using dedicated endpoint (more efficient, server-side filtering)
  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: queryKeys.publicProducts.bySeller(sellerId || ''),
    queryFn: async () => {
      if (!sellerId) return [];
      // Use dedicated seller products endpoint for efficient server-side filtering
      const response = await apiRequest('GET', `/api/public/products/seller/${sellerId}`);
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: !!sellerId,
    staleTime: 30 * 1000, // Cache for 30 seconds to show updates faster
    refetchOnWindowFocus: true,
  });

  // Check subscription status
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription-status', customerUser?.uid, sellerId],
    queryFn: async () => {
      if (!customerUser?.uid || !sellerId) return { isSubscribed: false };
      const response = await apiRequest('GET', `/api/subscriptions/check?customerId=${customerUser.uid}&sellerId=${sellerId}`);
      if (!response.ok) return { isSubscribed: false };
      return response.json();
    },
    enabled: !!customerUser?.uid && !!sellerId
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/subscriptions', {
        customerId: customerUser?.uid,
        sellerId
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      toast({
        title: "Subscribed!",
        description: "You'll receive notifications about new coupons and offers",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to subscribe",
        variant: "destructive",
      });
    }
  });

  // Unsubscribe mutation
  const unsubscribeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/subscriptions', {
        customerId: customerUser?.uid,
        sellerId
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      toast({
        title: "Unsubscribed",
        description: "You won't receive notifications from this shop anymore",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unsubscribe",
        variant: "destructive",
      });
    }
  });

  const handleSubscriptionToggle = () => {
    if (!customerUser) {
      setShowLoginModal(true);
      toast({
        title: "Login Required",
        description: "Please login to subscribe to this shop",
        variant: "destructive",
      });
      return;
    }

    if (subscription?.isSubscribed) {
      unsubscribeMutation.mutate();
    } else {
      subscribeMutation.mutate();
    }
  };

  const handleAddToCart = (product: Product) => {
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

    addToCart({ ...product, companyName: seller?.companyName });
    toast({
      title: "Added to Cart",
      description: `${product.name} has been added to your cart`,
    });
  };

  // Handle successful login - add pending product if any
  const handleLoginSuccess = (user: any) => {
    setCustomerUser(user);
    setShowLoginModal(false);
    
    // Add pending product to cart after login
    if (pendingProduct) {
      addToCart({ ...pendingProduct, companyName: seller?.companyName });
      toast({
        title: "Added to Cart",
        description: `${pendingProduct.name} has been added to your cart`,
      });
      setPendingProduct(null);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct({ ...product, companyName: seller?.companyName, userId: sellerId || undefined } as any);
  };

  if (sellerLoading || productsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  // If there's an error or no seller data
  if (sellerError || !seller) {
    console.error('Seller error:', sellerError);
    console.log('Seller data:', seller);
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <Store className="w-16 h-16 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">Shop Not Available</h2>
        <p className="text-gray-500 mb-2">
          {sellerError ? 'Unable to load shop information' : 'This shop hasn\'t been set up yet'}
        </p>
        {shopSlug && (
          <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-100 px-3 py-1 rounded">
            Shop: {shopSlug}
          </p>
        )}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 max-w-md">
          <p className="text-sm text-blue-900 font-medium mb-2">For Shop Owners:</p>
          <p className="text-sm text-blue-700">
            To set up your shop page, please:
          </p>
          <ol className="text-sm text-blue-700 list-decimal list-inside mt-2 space-y-1">
            <li>Login to your enterprise account</li>
            <li>Go to Settings → Shop Profile</li>
            <li>Fill in your shop information</li>
            <li>Click "Save Changes"</li>
          </ol>
        </div>
        <Link href="/customer">
          <Button>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Marketplace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Shop Banner */}
      {seller.shopBannerUrl && (
        <div className="w-full h-64 md:h-80 relative">
          <img
            src={seller.shopBannerUrl}
            alt="Shop banner"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      )}

      {/* Header */}
      <div className={seller.shopBannerUrl ? "bg-white border-b" : "bg-gradient-to-r from-red-600 to-red-700 text-white py-8"}>
        <div className="container mx-auto px-6">
          <Link href="/customer">
            <Button variant="ghost" className={seller.shopBannerUrl ? "mb-4" : "text-white hover:bg-white/20 mb-4"}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {seller.shopLogoUrl ? (
                <img
                  src={seller.shopLogoUrl}
                  alt="Shop logo"
                  className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-lg"
                />
              ) : (
                <div className={`w-20 h-20 ${seller.shopBannerUrl ? 'bg-red-600' : 'bg-white'} rounded-full flex items-center justify-center shadow-lg`}>
                  <Store className={`w-10 h-10 ${seller.shopBannerUrl ? 'text-white' : 'text-red-600'}`} />
                </div>
              )}
              <div>
                <h1 className={`text-3xl font-bold ${seller.shopBannerUrl ? 'text-gray-900' : 'text-white'}`}>
                  {seller.companyName || 'Shop'}
                </h1>
                <p className={seller.shopBannerUrl ? 'text-gray-600' : 'text-red-100'}>
                  {products.length} products available
                </p>
              </div>
            </div>

            {user && (
              <Button
                onClick={handleSubscriptionToggle}
                disabled={subscribeMutation.isPending || unsubscribeMutation.isPending}
                variant={subscription?.isSubscribed ? "outline" : "default"}
                className={subscription?.isSubscribed 
                  ? seller.shopBannerUrl ? "" : "bg-white text-red-600 hover:bg-red-50"
                  : seller.shopBannerUrl ? "" : "bg-white text-red-600 hover:bg-red-50"
                }
              >
                {subscribeMutation.isPending || unsubscribeMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : subscription?.isSubscribed ? (
                  <>
                    <BellOff className="w-4 h-4 mr-2" />
                    Unsubscribe
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Subscribe for Offers
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Shop Info Section */}
      <div className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* About Section */}
          {seller.shopDescription && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>About This Shop</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{seller.shopDescription}</p>
              </CardContent>
            </Card>
          )}

          {/* Contact Info */}
          {(seller.shopEmail || seller.shopPhone || seller.shopAddress || seller.shopWebsite || 
            seller.shopFacebook || seller.shopInstagram || seller.shopTwitter) && (
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {seller.shopEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-gray-500" />
                    <a href={`mailto:${seller.shopEmail}`} className="text-blue-600 hover:underline">
                      {seller.shopEmail}
                    </a>
                  </div>
                )}
                {seller.shopPhone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="w-4 h-4 text-gray-500" />
                    <a href={`tel:${seller.shopPhone}`} className="text-blue-600 hover:underline">
                      {seller.shopPhone}
                    </a>
                  </div>
                )}
                {seller.shopAddress && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-700">{seller.shopAddress}</span>
                  </div>
                )}
                {seller.shopWebsite && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="w-4 h-4 text-gray-500" />
                    <a 
                      href={ensureExternalUrl(seller.shopWebsite)} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:underline"
                    >
                      Visit Website
                    </a>
                  </div>
                )}
                
                {/* Social Media */}
                {(seller.shopFacebook || seller.shopInstagram || seller.shopTwitter) && (
                  <>
                    <div className="border-t pt-3 mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Follow Us</p>
                      <div className="flex gap-3">
                        {seller.shopFacebook && (
                          <a 
                            href={ensureExternalUrl(seller.shopFacebook)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <Facebook className="w-5 h-5" />
                          </a>
                        )}
                        {seller.shopInstagram && (
                          <a 
                            href={ensureExternalUrl(seller.shopInstagram)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-pink-600 hover:text-pink-700"
                          >
                            <Instagram className="w-5 h-5" />
                          </a>
                        )}
                        {seller.shopTwitter && (
                          <a 
                            href={ensureExternalUrl(seller.shopTwitter)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sky-600 hover:text-sky-700"
                          >
                            <Twitter className="w-5 h-5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Products Section */}
        <h2 className="text-2xl font-bold mb-6">Products</h2>
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Products Yet</h3>
            <p className="text-gray-500">This shop hasn't listed any products</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => handleProductClick(product)}>
                <div className="aspect-square bg-gray-200 relative">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                  {product.quantity === 0 && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Badge variant="destructive" className="text-lg">
                        Out of Stock
                      </Badge>
                    </div>
                  )}
                </div>
                
                <CardHeader>
                  <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                  <p className="text-2xl font-bold text-red-600">
                    {formatPrice(product.price, (product as any).sellerCurrency)}
                  </p>
                </CardHeader>

                <CardContent>
                  <Button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.quantity === 0}
                    className="w-full"
                    variant={product.quantity === 0 ? "outline" : "default"}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    {product.quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Login Modal */}
      <CustomerLoginModal
        isOpen={showLoginModal}
        onClose={() => {
          setShowLoginModal(false);
          setPendingProduct(null); // Clear pending product if modal is closed without login
        }}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}
