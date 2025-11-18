import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type InsertCoupon, type Coupon, type Product } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus,
  Ticket,
  Percent,
  DollarSign,
  Calendar,
  Copy,
  Edit,
  Trash2,
  Loader2,
  Send,
  Package,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function CouponManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [notifySubscribers, setNotifySubscribers] = useState(true);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  const [showSubscribersDialog, setShowSubscribersDialog] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");

  // Coupon form state
  const [couponCode, setCouponCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [minPurchase, setMinPurchase] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Fetch coupons
  const { data: coupons = [], isLoading: couponsLoading } = useQuery<Coupon[]>({
    queryKey: ['coupons', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const response = await apiRequest('GET', `/api/coupons?sellerId=${user.uid}`);
      if (!response.ok) throw new Error('Failed to fetch coupons');
      return response.json();
    },
    enabled: !!user?.uid
  });

  // Fetch products for product selection
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const response = await apiRequest('GET', '/api/products');
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json();
    },
    enabled: !!user?.uid
  });

  // Fetch subscriber count
  const { data: subscriberCount = 0 } = useQuery<number>({
    queryKey: ['subscriber-count', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return 0;
      const response = await apiRequest('GET', `/api/subscriptions/count?sellerId=${user.uid}`);
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!user?.uid
  });

  // Fetch subscriber list
  const { data: subscribers = [] } = useQuery<any[]>({
    queryKey: ['subscriber-list', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const response = await apiRequest('GET', `/api/subscriptions/list?sellerId=${user.uid}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.uid
  });

  // Create coupon mutation
  const createCouponMutation = useMutation({
    mutationFn: async (data: InsertCoupon & { notifySubscribers: boolean }) => {
      const response = await apiRequest('POST', '/api/coupons', data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create coupon');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast({
        title: "Coupon Created",
        description: notifySubscribers 
          ? "Coupon created successfully and subscribers have been notified!"
          : "Coupon created successfully!",
      });
      setIsCreateDialogOpen(false);
      // Reset form
      setCouponCode("");
      setDiscountType("percentage");
      setDiscountValue(10);
      setMinPurchase("");
      setMaxUses("");
      setExpiresAt("");
      setIsActive(true);
      setSelectedProducts([]);
      setNotifySubscribers(true);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create coupon",
        variant: "destructive",
      });
    }
  });

  // Delete coupon mutation
  const deleteCouponMutation = useMutation({
    mutationFn: async (couponId: string) => {
      const response = await apiRequest('DELETE', `/api/coupons/${couponId}`);
      if (!response.ok) throw new Error('Failed to delete coupon');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast({
        title: "Coupon Deleted",
        description: "Coupon has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete coupon",
        variant: "destructive",
      });
    }
  });

  // Toggle coupon active status
  const toggleCouponMutation = useMutation({
    mutationFn: async ({ couponId, isActive }: { couponId: string, isActive: boolean }) => {
      const response = await apiRequest('PATCH', `/api/coupons/${couponId}`, { isActive });
      if (!response.ok) throw new Error('Failed to update coupon');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coupons'] });
      toast({
        title: "Coupon Updated",
        description: "Coupon status has been updated.",
      });
    },
  });

  // Broadcast message mutation
  const broadcastMutation = useMutation({
    mutationFn: async ({ title, message }: { title: string, message: string }) => {
      const response = await apiRequest('POST', '/api/notifications/broadcast', {
        sellerId: user?.uid,
        title,
        message
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Message Sent!",
        description: data.message || `Message sent to ${data.count} subscribers`,
      });
      setShowBroadcastDialog(false);
      setBroadcastTitle("");
      setBroadcastMessage("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!couponCode) {
      toast({
        title: "Error",
        description: "Coupon code is required",
        variant: "destructive",
      });
      return;
    }

    // Convert selected products to JSON string
    const applicableProducts = selectedProducts.length > 0 
      ? JSON.stringify(selectedProducts) 
      : undefined;

    const data: InsertCoupon & { notifySubscribers: boolean } = {
      code: couponCode.toUpperCase(),
      sellerId: user?.uid || "",
      discountType,
      discountValue: discountValue.toString(),
      minPurchase: minPurchase ? parseFloat(minPurchase).toString() : undefined,
      applicableProducts,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
      expiresAt: expiresAt || undefined,
      isActive,
      notifySubscribers,
    };

    createCouponMutation.mutate(data);
  };

  const generateRandomCode = () => {
    const code = `${Math.random().toString(36).substring(2, 8).toUpperCase()}${Math.random().toString(10).substring(2, 5)}`;
    setCouponCode(code);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: "Coupon code copied to clipboard",
    });
  };

  const isExpired = (expiresAt: any) => {
    if (!expiresAt) return false;
    const expiry = expiresAt?.toDate ? expiresAt.toDate() : new Date(expiresAt);
    return expiry < new Date();
  };

  const activeCoupons = coupons.filter(c => c.isActive && !isExpired(c.expiresAt));
  const inactiveCoupons = coupons.filter(c => !c.isActive || isExpired(c.expiresAt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Coupon Management</h2>
          <p className="text-gray-600">Create and manage discount coupons for your customers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSubscribersDialog(true)}>
            <Users className="w-4 h-4 mr-2" />
            Subscribers ({subscriberCount})
          </Button>
          <Button variant="outline" onClick={() => setShowBroadcastDialog(true)}>
            <Send className="w-4 h-4 mr-2" />
            Send Message
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Coupon
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Active Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{activeCoupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Coupons</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Subscribers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{subscriberCount}</div>
            <p className="text-xs text-gray-500 mt-1">Will receive notifications</p>
          </CardContent>
        </Card>
      </div>

      {/* Coupons Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Coupons</CardTitle>
          <CardDescription>Manage your discount coupons</CardDescription>
        </CardHeader>
        <CardContent>
          {couponsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No coupons yet. Create your first coupon!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Min. Purchase</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => {
                    const expired = isExpired(coupon.expiresAt);
                    const applicableProductIds = coupon.applicableProducts 
                      ? JSON.parse(coupon.applicableProducts) 
                      : [];
                    
                    return (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="font-mono font-bold text-sm bg-gray-100 px-2 py-1 rounded">
                              {coupon.code}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyCode(coupon.code)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {coupon.discountType === 'percentage' ? (
                              <><Percent className="w-3 h-3 mr-1" /> Percentage</>
                            ) : (
                              <><DollarSign className="w-3 h-3 mr-1" /> Fixed</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">
                          {coupon.discountType === 'percentage' 
                            ? `${coupon.discountValue}%` 
                            : `$${parseFloat(coupon.discountValue).toFixed(2)}`}
                        </TableCell>
                        <TableCell>
                          {coupon.minPurchase ? `$${parseFloat(coupon.minPurchase).toFixed(2)}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="font-medium">{coupon.usedCount}</span>
                            {coupon.maxUses && <span className="text-gray-500"> / {coupon.maxUses}</span>}
                            {!coupon.maxUses && <span className="text-gray-500"> / ∞</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {coupon.expiresAt ? (
                            <div className="text-sm">
                              {format(
                                typeof coupon.expiresAt === 'string' 
                                  ? new Date(coupon.expiresAt)
                                  : coupon.expiresAt instanceof Date
                                  ? coupon.expiresAt
                                  : coupon.expiresAt.toDate(),
                                'MMM dd, yyyy'
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-500">No expiry</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {expired ? (
                            <Badge variant="destructive">Expired</Badge>
                          ) : coupon.isActive ? (
                            <Badge className="bg-green-600">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {!expired && (
                              <Switch
                                checked={coupon.isActive}
                                onCheckedChange={(checked) => 
                                  toggleCouponMutation.mutate({ 
                                    couponId: coupon.id, 
                                    isActive: checked 
                                  })
                                }
                              />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteCouponMutation.mutate(coupon.id)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Coupon Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Coupon</DialogTitle>
            <DialogDescription>
              Create a discount coupon for your customers
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
              {/* Coupon Code */}
              <div className="space-y-2">
                <Label htmlFor="code">Coupon Code *</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    placeholder="e.g., SAVE20"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className="font-mono uppercase"
                    required
                  />
                  <Button type="button" variant="outline" onClick={generateRandomCode}>
                    Generate
                  </Button>
                </div>
              </div>

              {/* Discount Type and Value */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discountType">Discount Type *</Label>
                  <Select value={discountType} onValueChange={(value: 'percentage' | 'fixed') => setDiscountType(value)}>
                    <SelectTrigger id="discountType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountValue">Discount Value *</Label>
                  <Input
                    id="discountValue"
                    type="number"
                    step="0.01"
                    placeholder={discountType === 'percentage' ? '10' : '5.00'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(parseFloat(e.target.value))}
                    required
                  />
                </div>
              </div>

              {/* Min Purchase and Max Uses */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minPurchase">Minimum Purchase (Optional)</Label>
                  <Input
                    id="minPurchase"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={minPurchase}
                    onChange={(e) => setMinPurchase(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">Minimum cart value required</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxUses">Max Uses (Optional)</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    placeholder="Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                  />
                  <p className="text-sm text-gray-500">Leave empty for unlimited</p>
                </div>
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Expiry Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="text-sm text-gray-500">Leave empty for no expiry</p>
              </div>

              {/* Applicable Products */}
              <div className="space-y-2">
                <Label>Applicable Products (Optional)</Label>
                <p className="text-sm text-gray-500">
                  Select specific products or leave empty to apply to all products
                </p>
                <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
                  {products.length === 0 ? (
                    <p className="text-sm text-gray-500">No products available</p>
                  ) : (
                    <div className="space-y-2">
                      {products.map((product) => (
                        <div key={product.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`product-${product.id}`}
                            checked={selectedProducts.includes(product.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedProducts([...selectedProducts, product.id]);
                              } else {
                                setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                              }
                            }}
                          />
                          <label
                            htmlFor={`product-${product.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {product.name} - ${parseFloat(product.price).toFixed(2)}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {selectedProducts.length > 0 && (
                  <p className="text-sm text-blue-600">
                    {selectedProducts.length} product(s) selected
                  </p>
                )}
              </div>

              {/* Notify Subscribers */}
              {subscriberCount > 0 && (
                <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Send className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-sm">Notify Subscribers</p>
                      <p className="text-xs text-gray-600">
                        Send notification to {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={notifySubscribers}
                    onCheckedChange={setNotifySubscribers}
                  />
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createCouponMutation.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createCouponMutation.isPending}>
                  {createCouponMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Ticket className="w-4 h-4 mr-2" />
                      Create Coupon
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Broadcast Message Dialog */}
      <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Message to Subscribers</DialogTitle>
            <DialogDescription>
              Broadcast a message to all {subscriberCount} subscriber{subscriberCount !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="broadcast-title">Title</Label>
              <Input
                id="broadcast-title"
                placeholder="Enter message title"
                value={broadcastTitle}
                onChange={(e) => setBroadcastTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="broadcast-message">Message</Label>
              <Textarea
                id="broadcast-message"
                placeholder="Enter your message"
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={5}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowBroadcastDialog(false)}
              disabled={broadcastMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => broadcastMutation.mutate({ title: broadcastTitle, message: broadcastMessage })}
              disabled={!broadcastTitle || !broadcastMessage || broadcastMutation.isPending}
            >
              {broadcastMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Message
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscribers List Dialog */}
      <Dialog open={showSubscribersDialog} onOpenChange={setShowSubscribersDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Subscribers</DialogTitle>
            <DialogDescription>
              {subscriberCount} customer{subscriberCount !== 1 ? 's' : ''} subscribed to your offers
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {subscribers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No subscribers yet</p>
                <p className="text-sm text-gray-400 mt-1">
                  Customers can subscribe from your shop page
                </p>
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Subscribed On</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {subscribers.map((sub) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.customerName}</TableCell>
                        <TableCell>{sub.customerEmail}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {sub.subscribedAt ? format(new Date(sub.subscribedAt), 'MMM dd, yyyy') : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
