import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Save,
  Loader2,
  Package,
  ShoppingBag,
  Calendar,
  DollarSign,
  Store,
  RotateCcw
} from "lucide-react";
import { auth } from "@/lib/firebaseClient";
import { onAuthStateChanged, updateProfile } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

export default function CustomerProfile() {
  const [customerUser, setCustomerUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [location, setLocation] = useLocation();

  // Refund request state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [refundReason, setRefundReason] = useState("");
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  // Profile form state
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phoneNumber: "",
    address: "",
    city: "",
    postalCode: "",
    country: ""
  });

  // Listen to auth state
  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCustomerUser(user);
        // Load user data into form
        setFormData({
          displayName: user.displayName || "",
          email: user.email || "",
          phoneNumber: user.phoneNumber || "",
          address: localStorage.getItem("customer_address") || "",
          city: localStorage.getItem("customer_city") || "",
          postalCode: localStorage.getItem("customer_postalCode") || "",
          country: localStorage.getItem("customer_country") || ""
        });
      } else {
        // Redirect to customer portal if not logged in
        setLocation("/customer");
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [setLocation]);

  // Fetch customer orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['customer-orders', customerUser?.uid],
    queryFn: async () => {
      if (!customerUser?.uid) return [];
      const response = await apiRequest('GET', `/api/customer/orders?customerId=${customerUser.uid}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!customerUser?.uid
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    if (!customerUser) return;

    setIsSaving(true);
    try {
      // Update Firebase Auth display name if changed
      if (formData.displayName !== customerUser.displayName) {
        await updateProfile(customerUser, {
          displayName: formData.displayName
        });
      }

      // Save other fields to localStorage (you can also save to Firestore)
      localStorage.setItem("customer_address", formData.address);
      localStorage.setItem("customer_city", formData.city);
      localStorage.setItem("customer_postalCode", formData.postalCode);
      localStorage.setItem("customer_country", formData.country);

      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });

      // Reload auth state to get updated displayName
      await customerUser.reload();
      
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save profile.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestRefund = (order: any) => {
    setSelectedOrder(order);
    setRefundReason("");
    setRefundDialogOpen(true);
  };

  const handleSubmitRefund = async () => {
    if (!selectedOrder || !refundReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the refund request",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingRefund(true);
    try {
      await apiRequest(
        "POST",
        `/api/orders/${selectedOrder.id}/refund`,
        {
          reason: refundReason,
          orderId: selectedOrder.id,
          orderNumber: selectedOrder.orderNumber,
        }
      );

      toast({
        title: "Refund requested",
        description: "Your refund request has been submitted successfully. The seller will review it shortly.",
      });

      // Refresh orders
      window.location.reload();
      
      setRefundDialogOpen(false);
      setRefundReason("");
      setSelectedOrder(null);
    } catch (error) {
      console.error("Error requesting refund:", error);
      toast({
        title: "Error",
        description: "Failed to submit refund request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/customer">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Store
                </Button>
              </Link>
              <div className="flex items-center space-x-3">
                <User className="w-8 h-8" />
                <div>
                  <h1 className="text-xl font-bold">My Profile</h1>
                  <p className="text-xs text-red-100">Manage your account information</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Form */}
      <section className="container mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Update your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Display Name */}
              <div className="space-y-2">
                <Label htmlFor="displayName" className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Display Name</span>
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  placeholder="Enter your name"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>Email Address</span>
                </Label>
                <Input
                  id="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="bg-gray-100 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500">
                  Email cannot be changed. This is your login email.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center space-x-2">
                  <Phone className="w-4 h-4" />
                  <span>Phone Number</span>
                </Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  placeholder="+1 234 567 8900"
                />
              </div>

              {/* Shipping Address Section */}
              <div className="border-t pt-6 mt-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Shipping Address</span>
                </h3>

                {/* Address */}
                <div className="space-y-2 mb-4">
                  <Label htmlFor="address">Street Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    placeholder="Enter your street address"
                    rows={3}
                  />
                </div>

                {/* City and Postal Code */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postalCode">Postal Code</Label>
                    <Input
                      id="postalCode"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleInputChange}
                      placeholder="12345"
                    />
                  </div>
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    placeholder="Country"
                  />
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Link href="/customer">
                  <Button variant="outline">
                    Cancel
                  </Button>
                </Link>
                <Button
                  onClick={handleSaveProfile}
                  disabled={isSaving}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">User ID</span>
                <span className="text-sm font-mono">{customerUser?.uid}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-sm text-gray-600">Account Created</span>
                <span className="text-sm">
                  {customerUser?.metadata?.creationTime 
                    ? new Date(customerUser.metadata.creationTime).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-600">Last Sign In</span>
                <span className="text-sm">
                  {customerUser?.metadata?.lastSignInTime 
                    ? new Date(customerUser.metadata.lastSignInTime).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* My Orders Section */}
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-5 h-5" />
                  <CardTitle>My Orders</CardTitle>
                </div>
                <Badge variant="secondary">{orders?.length || 0} Orders</Badge>
              </div>
              <CardDescription>
                View your order history and track purchases
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                </div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order: any) => (
                    <Card key={order.id} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-lg">Order #{order.orderNumber}</h3>
                              <Badge 
                                variant={order.status === 'pending' ? 'secondary' : 'default'}
                                className={order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''}
                              >
                                {order.status}
                              </Badge>
                            </div>
                            
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <div className="flex items-center space-x-1">
                                <Calendar className="w-4 h-4" />
                                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Package className="w-4 h-4" />
                                <span>{order.items?.length || 0} items</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <DollarSign className="w-4 h-4" />
                                <span className="font-semibold text-red-600">
                                  ${order.totalAmount?.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {/* Order Items */}
                            <div className="mt-3 space-y-2">
                              <p className="text-sm font-medium text-gray-700">Items:</p>
                              {order.items?.map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                                  <div className="flex items-center space-x-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <span className="font-medium">{item.productName}</span>
                                    <span className="text-gray-500">× {item.quantity}</span>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    {item.sellerName && (
                                      <div className="flex items-center space-x-1 text-gray-600">
                                        <Store className="w-3 h-3" />
                                        <span className="text-xs">{item.sellerName}</span>
                                      </div>
                                    )}
                                    <span className="font-semibold">
                                      ${item.totalPrice?.toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Shipping Address */}
                            {order.shippingAddress && (
                              <div className="mt-2 text-sm">
                                <p className="font-medium text-gray-700">Shipping to:</p>
                                <p className="text-gray-600">{order.shippingAddress}</p>
                              </div>
                            )}

                            {/* Refund Status */}
                            {order.refundRequested && (
                              <div className="mt-3">
                                <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Refund Requested
                                </Badge>
                                {order.refundReason && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    Reason: {order.refundReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center space-x-2">
                            {!order.refundRequested && order.status !== 'refunded' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRequestRefund(order)}
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Request Refund
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 font-medium">No orders yet</p>
                  <p className="text-sm text-gray-500 mt-1">Start shopping to see your orders here</p>
                  <Link href="/shop">
                    <Button className="mt-4 bg-red-600 hover:bg-red-700">
                      Browse Products
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Refund Request Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Refund</DialogTitle>
            <DialogDescription>
              Submit a refund request for Order #{selectedOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Order Summary */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">Order Details</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Order Number:</span>
                  <span className="font-medium">{selectedOrder?.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-medium text-red-600">
                    ${selectedOrder?.totalAmount?.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Items:</span>
                  <span className="font-medium">{selectedOrder?.items?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Refund Reason */}
            <div className="space-y-2">
              <Label htmlFor="refundReason">Reason for Refund *</Label>
              <Textarea
                id="refundReason"
                placeholder="Please explain why you are requesting a refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <p className="text-xs text-gray-500">
                Please provide a detailed explanation to help us process your request.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={isSubmittingRefund}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRefund}
              disabled={isSubmittingRefund || !refundReason.trim()}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isSubmittingRefund ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
