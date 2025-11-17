import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Package, 
  ShoppingCart, 
  Calendar,
  DollarSign,
  User,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  Loader2,
  Store
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Orders() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundAction, setRefundAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Fetch orders for this seller
  const { data: orders, isLoading } = useQuery({
    queryKey: ['seller-orders', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const response = await apiRequest('GET', `/api/seller/orders?sellerId=${user.uid}`);
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!user?.uid
  });

  // Handle refund approval/rejection
  const refundMutation = useMutation({
    mutationFn: async ({ orderId, action, reason }: { orderId: string, action: 'approve' | 'reject', reason?: string }) => {
      const response = await apiRequest(
        'POST',
        `/api/orders/${orderId}/refund/${action}`,
        { reason }
      );
      if (!response.ok) throw new Error(`Failed to ${action} refund`);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      toast({
        title: variables.action === 'approve' ? 'Refund Approved' : 'Refund Rejected',
        description: `The refund request has been ${variables.action}d successfully.`,
      });
      setRefundDialogOpen(false);
      setSelectedOrder(null);
      setRejectionReason("");
      setRefundAction(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to process refund request. Please try again.`,
        variant: "destructive",
      });
    }
  });

  const handleRefundAction = (order: any, action: 'approve' | 'reject') => {
    setSelectedOrder(order);
    setRefundAction(action);
    setRejectionReason("");
    setRefundDialogOpen(true);
  };

  const handleSubmitRefundAction = () => {
    if (!selectedOrder || !refundAction) return;
    
    if (refundAction === 'reject' && !rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    refundMutation.mutate({
      orderId: selectedOrder.id,
      action: refundAction,
      reason: refundAction === 'reject' ? rejectionReason : undefined
    });
  };

  // Filter orders
  const filteredOrders = orders?.filter((order: any) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "refund-requested") return order.refundRequested && !order.refundApproved && !order.refundRejected;
    if (statusFilter === "refunded") return order.refundApproved;
    return order.status === statusFilter;
  }) || [];

  // Calculate stats
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter((o: any) => o.status === 'pending').length || 0,
    refundRequests: orders?.filter((o: any) => o.refundRequested && !o.refundApproved && !o.refundRejected).length || 0,
    totalRevenue: orders?.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0) || 0
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-red-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
          <p className="text-gray-600 mt-1">Manage customer orders and refund requests</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-2xl font-bold">{stats.pending}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Refund Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <RotateCcw className="w-5 h-5 text-orange-600" />
              <span className="text-2xl font-bold">{stats.refundRequests}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Orders</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refund-requested">Refund Requested</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-600 font-medium">No orders found</p>
              <p className="text-sm text-gray-500 mt-1">Orders from customers will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order: any) => (
                <Card key={order.id} className="border-2">
                  <CardContent className="p-4">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <h3 className="font-semibold text-lg">Order #{order.orderNumber}</h3>
                          <Badge 
                            variant={order.status === 'pending' ? 'secondary' : 'default'}
                            className={
                              order.status === 'pending' 
                                ? 'bg-yellow-100 text-yellow-800' 
                                : order.refundApproved
                                ? 'bg-green-100 text-green-800'
                                : ''
                            }
                          >
                            {order.refundApproved ? 'Refunded' : order.status}
                          </Badge>
                          {order.refundRequested && !order.refundApproved && !order.refundRejected && (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Refund Requested
                            </Badge>
                          )}
                          {order.refundRejected && (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              <XCircle className="w-3 h-3 mr-1" />
                              Refund Rejected
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1 text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3 rounded">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2 text-sm">
                            <User className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Customer:</span>
                            <span>{order.customerName}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Email:</span>
                            <span>{order.customerEmail}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">Phone:</span>
                            <span>{order.customerPhone}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start space-x-2 text-sm">
                            <MapPin className="w-4 h-4 text-gray-500 mt-0.5" />
                            <div>
                              <span className="font-medium">Shipping Address:</span>
                              <p className="text-gray-700">{order.shippingAddress}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Order Items */}
                      <div>
                        <p className="text-sm font-medium text-gray-700 mb-2">Items:</p>
                        <div className="space-y-2">
                          {order.items?.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded border">
                              <div className="flex items-center space-x-2">
                                <Package className="w-4 h-4 text-gray-400" />
                                <span className="font-medium">{item.productName}</span>
                                <span className="text-gray-500">× {item.quantity}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                <span className="text-gray-600">${item.unitPrice} each</span>
                                <span className="font-semibold text-red-600">
                                  ${item.totalPrice?.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t">
                          <span className="font-semibold">Total Amount:</span>
                          <span className="text-xl font-bold text-red-600">
                            ${order.totalAmount?.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Refund Request Details */}
                      {order.refundRequested && (
                        <div className="bg-orange-50 border border-orange-200 p-3 rounded">
                          <p className="text-sm font-medium text-orange-900 mb-1">
                            Refund Request Reason:
                          </p>
                          <p className="text-sm text-orange-800">{order.refundReason}</p>
                          <p className="text-xs text-orange-600 mt-2">
                            Requested on: {new Date(order.refundRequestedAt || order.updatedAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}

                      {/* Rejection Reason */}
                      {order.refundRejected && order.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 p-3 rounded">
                          <p className="text-sm font-medium text-red-900 mb-1">
                            Rejection Reason:
                          </p>
                          <p className="text-sm text-red-800">{order.rejectionReason}</p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      {order.refundRequested && !order.refundApproved && !order.refundRejected && (
                        <div className="flex items-center space-x-3 pt-3 border-t">
                          <Button
                            onClick={() => handleRefundAction(order, 'approve')}
                            className="bg-green-600 hover:bg-green-700"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Approve Refund
                          </Button>
                          <Button
                            onClick={() => handleRefundAction(order, 'reject')}
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            size="sm"
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Reject Request
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refund Action Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {refundAction === 'approve' ? 'Approve Refund' : 'Reject Refund Request'}
            </DialogTitle>
            <DialogDescription>
              {refundAction === 'approve' 
                ? `Approve refund for Order #${selectedOrder?.orderNumber}`
                : `Reject refund request for Order #${selectedOrder?.orderNumber}`
              }
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
                  <span className="text-gray-600">Customer:</span>
                  <span className="font-medium">{selectedOrder?.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-medium text-red-600">
                    ${selectedOrder?.totalAmount?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer's Reason */}
            <div className="bg-orange-50 border border-orange-200 p-3 rounded">
              <p className="text-sm font-medium text-orange-900 mb-1">Customer's Reason:</p>
              <p className="text-sm text-orange-800">{selectedOrder?.refundReason}</p>
            </div>

            {/* Rejection Reason Input */}
            {refundAction === 'reject' && (
              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Reason for Rejection *</Label>
                <Textarea
                  id="rejectionReason"
                  placeholder="Please explain why you are rejecting this refund request..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  This will be sent to the customer.
                </p>
              </div>
            )}

            {refundAction === 'approve' && (
              <div className="bg-green-50 border border-green-200 p-3 rounded">
                <p className="text-sm text-green-800">
                  ⚠️ Once approved, the refund will be processed and the order status will be updated to "Refunded".
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundDialogOpen(false)}
              disabled={refundMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRefundAction}
              disabled={refundMutation.isPending || (refundAction === 'reject' && !rejectionReason.trim())}
              className={refundAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {refundMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  {refundAction === 'approve' ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve Refund
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject Request
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
