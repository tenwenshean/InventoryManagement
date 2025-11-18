import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ShoppingCart,
  ArrowLeft,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  DollarSign,
  Truck,
  Ticket,
  Tag,
  X
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { apiRequest } from "@/lib/queryClient";
import CustomerLoginModal from "@/components/customer-login-modal";
import type { Coupon } from "@/types";

export default function CheckoutPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});
  
  // Coupon state
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState("");
  
  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [notes, setNotes] = useState("");
  
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { cart, clearCart, cartTotal, cartCount } = useCart();

  // Calculate discount and final total
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;

    // Check if coupon applies to cart products
    let applicableTotal = cartTotal;
    
    if (appliedCoupon.applicableProducts) {
      const applicableProductIds = JSON.parse(appliedCoupon.applicableProducts);
      applicableTotal = cart
        .filter(item => applicableProductIds.includes(item.product.id))
        .reduce((sum, item) => sum + parseFloat(item.product.price) * item.quantity, 0);
    }

    if (appliedCoupon.discountType === 'percentage') {
      return (applicableTotal * parseFloat(appliedCoupon.discountValue)) / 100;
    } else {
      return parseFloat(appliedCoupon.discountValue);
    }
  };

  const discount = calculateDiscount();
  const finalTotal = Math.max(0, cartTotal - discount);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Pre-fill customer info from auth
        setCustomerName(user.displayName || "");
        setCustomerEmail(user.email || "");
        setCustomerPhone(user.phoneNumber || "");
      } else {
        setShowLoginModal(true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Apply coupon
  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError("Please enter a coupon code");
      return;
    }

    setIsValidatingCoupon(true);
    setCouponError("");

    try {
      const response = await apiRequest('POST', '/api/coupons/validate', {
        code: couponCode.toUpperCase(),
        cartTotal,
        productIds: cart.map(item => item.product.id)
      });

      if (!response.ok) {
        const error = await response.json();
        setCouponError(error.message || "Invalid coupon code");
        setAppliedCoupon(null);
        return;
      }

      const coupon = await response.json();
      setAppliedCoupon(coupon);
      toast({
        title: "Coupon Applied!",
        description: `You saved ${coupon.discountType === 'percentage' ? coupon.discountValue + '%' : '$' + coupon.discountValue}!`,
      });
    } catch (error) {
      setCouponError("Failed to validate coupon");
      setAppliedCoupon(null);
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  // Remove coupon
  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError("");
  };

  // Check stock availability
  const checkStockAvailability = async () => {
    const errors: Record<string, string> = {};
    
    for (const item of cart) {
      try {
        const response = await apiRequest('GET', `/api/products/${item.product.id}`);
        const product = await response.json();
        
        const availableStock = product.quantity || 0;
        
        if (availableStock <= 0) {
          errors[item.product.id] = `${item.product.name} is out of stock`;
        } else if (item.quantity > availableStock) {
          errors[item.product.id] = `Only ${availableStock} units available for ${item.product.name}`;
        }
      } catch (error) {
        console.error(`Error checking stock for ${item.product.id}:`, error);
        errors[item.product.id] = `Unable to verify stock for ${item.product.name}`;
      }
    }
    
    setStockErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate form
  const validateForm = () => {
    if (!customerName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your name",
        variant: "destructive"
      });
      return false;
    }
    
    if (!customerPhone.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your phone number",
        variant: "destructive"
      });
      return false;
    }
    
    if (!shippingAddress.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter your shipping address",
        variant: "destructive"
      });
      return false;
    }
    
    return true;
  };

  // Handle checkout
  const handlePlaceOrder = async () => {
    if (!currentUser) {
      setShowLoginModal(true);
      toast({
        title: "Login Required",
        description: "Please login to place an order",
        variant: "destructive"
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Your cart is empty",
        variant: "destructive"
      });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);

    try {
      // Check stock availability first
      const stockAvailable = await checkStockAvailability();
      
      if (!stockAvailable) {
        toast({
          title: "Stock Issue",
          description: "Some items in your cart are out of stock or have insufficient quantity",
          variant: "destructive"
        });
        setIsProcessing(false);
        return;
      }

      // Process checkout
      const orderData = {
        customerId: currentUser.uid,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        notes,
        items: cart.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: parseFloat(item.product.price),
          totalPrice: parseFloat(item.product.price) * item.quantity,
          userId: (item.product as any).userId, // Owner of the product
          sellerName: (item.product as any).companyName || 'Unknown Seller'
        })),
        subtotal: cartTotal,
        discount,
        couponCode: appliedCoupon?.code,
        totalAmount: finalTotal
      };

      console.log('Submitting order:', orderData);

      const response = await apiRequest('POST', '/api/checkout', orderData);
      const result = await response.json();

      console.log('Order result:', result);

      setOrderNumber(result.orderNumber);
      setOrderComplete(true);
      clearCart();
      setAppliedCoupon(null);
      setCouponCode("");

      toast({
        title: "Order Placed Successfully!",
        description: `Order #${result.orderNumber} has been confirmed`,
      });

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: "Checkout Failed",
        description: error.message || "Unable to process your order. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // If order is complete, show success page
  if (orderComplete) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-2xl w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-3xl text-green-600">Order Confirmed!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <p className="text-lg font-semibold text-gray-800">Order Number</p>
              <p className="text-3xl font-bold text-green-600 mt-2">#{orderNumber}</p>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Package className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Order Processing</p>
                  <p className="text-sm text-gray-600">Your order is being prepared</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Delivery Information</p>
                  <p className="text-sm text-gray-600">{shippingAddress}</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <DollarSign className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-semibold">Total Amount</p>
                  <p className="text-sm text-gray-600">${cartTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/customer" className="flex-1">
                <Button className="w-full bg-red-600 hover:bg-red-700">
                  Continue Shopping
                </Button>
              </Link>
              <Link href="/customer-profile" className="flex-1">
                <Button variant="outline" className="w-full">
                  View Orders
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/cart">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Cart
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <CreditCard className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">Checkout</h1>
                  <p className="text-xs text-red-100">Complete your purchase</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Order Summary */}
          <div className="md:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Customer Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input
                      id="name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+1234567890"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email (Optional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Shipping Address *</Label>
                  <Textarea
                    id="address"
                    value={shippingAddress}
                    onChange={(e) => setShippingAddress(e.target.value)}
                    placeholder="123 Main St, City, State, ZIP"
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Order Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special instructions..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle>Order Items ({cartCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center space-x-4 flex-1">
                        {item.product.imageUrl ? (
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="font-semibold">{item.product.name}</h3>
                          <p className="text-sm text-gray-600">
                            ${parseFloat(item.product.price).toFixed(2)} × {item.quantity}
                          </p>
                          {item.product.companyName && (
                            <p className="text-xs text-gray-500">by {item.product.companyName}</p>
                          )}
                          {stockErrors[item.product.id] && (
                            <div className="flex items-center space-x-1 mt-1 text-red-600 text-xs">
                              <AlertCircle className="w-3 h-3" />
                              <span>{stockErrors[item.product.id]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          ${(parseFloat(item.product.price) * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="md:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coupon Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="coupon">Coupon Code</Label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="font-mono font-semibold text-sm text-green-800">
                            {appliedCoupon.code}
                          </p>
                          <p className="text-xs text-green-600">
                            {appliedCoupon.discountType === 'percentage' 
                              ? `${appliedCoupon.discountValue}% off` 
                              : `$${parseFloat(appliedCoupon.discountValue).toFixed(2)} off`}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCoupon}
                        className="h-8 w-8 p-0 text-green-700 hover:text-green-900"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        placeholder="Enter code"
                        value={couponCode}
                        onChange={(e) => {
                          setCouponCode(e.target.value.toUpperCase());
                          setCouponError("");
                        }}
                        className="font-mono uppercase"
                      />
                      <Button
                        onClick={handleApplyCoupon}
                        disabled={isValidatingCoupon || !couponCode.trim()}
                        variant="outline"
                      >
                        {isValidatingCoupon ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Apply"
                        )}
                      </Button>
                    </div>
                  )}
                  {couponError && (
                    <p className="text-sm text-red-600">{couponError}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold">${cartTotal.toFixed(2)}</span>
                  </div>
                  {appliedCoupon && discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        Discount
                      </span>
                      <span className="font-semibold text-green-600">
                        -${discount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Shipping</span>
                    <span className="font-semibold text-green-600">FREE</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-semibold">$0.00</span>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-bold text-lg">Total</span>
                      <span className="font-bold text-lg text-red-600">
                        ${finalTotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={isProcessing || cart.length === 0 || Object.keys(stockErrors).length > 0}
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Place Order
                    </>
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  By placing your order, you agree to our terms and conditions
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

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
