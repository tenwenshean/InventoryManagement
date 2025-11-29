import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebaseClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Package, Printer, Truck } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";

interface ShippingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: any;
  sellerPostcode?: string;
}

export function ShippingDialog({ open, onOpenChange, order, sellerPostcode }: ShippingDialogProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const queryClient = useQueryClient();
  
  const [weight, setWeight] = useState("1");
  const [insuranceValue, setInsuranceValue] = useState("");

  // Create shipment mutation
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      console.log('[Shipping Dialog] Creating shipment for order:', order.id, 'with weight:', weight);
      
      const response = await apiRequest('POST', '/api/shipping/create', {
        orderId: order.id,
        weight: parseFloat(weight),
        insuranceValue: insuranceValue ? parseFloat(insuranceValue) : 0
      });
      
      console.log('[Shipping Dialog] Response status:', response.status);
      
      const contentType = response.headers.get('content-type');
      console.log('[Shipping Dialog] Content-Type:', contentType);
      
      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMessage = 'Failed to create shipment';
        
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } else {
          const text = await response.text();
          console.error('[Shipping Dialog] Non-JSON response:', text.substring(0, 200));
          errorMessage = 'Server error - please check console for details';
        }
        
        throw new Error(errorMessage);
      }
      
      // Check if response is actually JSON before parsing
      const responseContentType = response.headers.get('content-type');
      if (!responseContentType?.includes('application/json')) {
        const text = await response.text();
        console.error('[Shipping Dialog] Expected JSON but got:', text.substring(0, 500));
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      console.log('[Shipping Dialog] Shipment created:', data);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-orders'] });
      toast({
        title: "Shipment Created",
        description: `Tracking number: ${data.trackingNo}`,
      });
      
      // Open waybill in new tab if available
      if (data.waybillUrl) {
        window.open(data.waybillUrl, '_blank');
      }
      
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create shipment",
        variant: "destructive",
      });
    }
  });

  const handleCreateShipment = () => {
    if (!weight || parseFloat(weight) <= 0) {
      toast({
        title: "Missing Information",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }
    
    createShipmentMutation.mutate();
  };

  const handlePrintWaybill = async () => {
    try {
      // Get auth token for the request
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Please log in to view the waybill');
      }
      
      // Force token refresh to ensure it's valid
      const token = await user.getIdToken(true);
      
      if (!token) {
        throw new Error('Failed to get authentication token. Please try logging in again.');
      }
      
      console.log('[Waybill] Opening waybill for order:', order.id);
      
      // Open waybill in new window with token as query param
      const waybillUrl = `/api/shipping/waybill/${order.id}?token=${encodeURIComponent(token)}`;
      const newWindow = window.open(waybillUrl, '_blank', 'width=900,height=1200,menubar=yes,toolbar=yes,location=yes');
      
      if (!newWindow) {
        throw new Error('Popup blocked! Please allow popups for this site to view the waybill.');
      }

      toast({
        title: "Waybill Opened",
        description: "Click the 'Print / Save PDF' button in the new window to save or print.",
      });
    } catch (error: any) {
      console.error('[Waybill] Error:', error);
      toast({
        title: "Error Opening Waybill",
        description: error.message || "Failed to open waybill. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setWeight("1");
      setInsuranceValue("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Shipping & Waybill
          </DialogTitle>
          <DialogDescription>
            Create shipment and print waybill for Order #{order?.orderNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Customer:</span>
              <span className="font-medium">{order?.customerName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Phone:</span>
              <span className="font-medium">{order?.customerPhone}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-sm text-gray-600">Address:</span>
              <span className="font-medium text-right flex-1 ml-2">{order?.shippingAddress}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-gray-600">Order Total:</span>
              <span className="font-bold text-red-600">
                {formatCurrency(order?.totalAmount || 0)}
              </span>
            </div>
          </div>

          {/* If shipment already exists */}
          {order?.shipmentId && (
            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-green-900">
                  Shipment Created
                </p>
                <Button
                  size="sm"
                  onClick={handlePrintWaybill}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Printer className="w-4 h-4 mr-1" />
                  Print Waybill
                </Button>
              </div>
              <div className="space-y-1 text-sm text-green-800">
                <div className="flex justify-between">
                  <span>Tracking Number:</span>
                  <span className="font-mono font-semibold">{order.shipmentId}</span>
                </div>
                {order.courier && (
                  <div className="flex justify-between">
                    <span>Courier:</span>
                    <span className="font-medium">{order.courier}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Create shipment form */}
          {!order?.shipmentId && (
            <>
              {/* Weight Input */}
              <div className="space-y-2">
                <Label htmlFor="weight">Package Weight (kg) *</Label>
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="1.0"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Enter the total weight of the package
                </p>
              </div>

              {/* Insurance Value (Optional) */}
              <div className="space-y-2">
                <Label htmlFor="insurance">Insurance Value (Optional)</Label>
                <Input
                  id="insurance"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={insuranceValue}
                  onChange={(e) => setInsuranceValue(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Declare insurance value for high-value items
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <p className="text-sm text-blue-800">
                  <Package className="w-4 h-4 inline mr-1" />
                  A waybill will be generated automatically after creating the shipment. 
                  You can print it immediately or access it later from the order details.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createShipmentMutation.isPending}
          >
            {order?.shipmentId ? 'Close' : 'Cancel'}
          </Button>
          
          {!order?.shipmentId && (
            <Button
              onClick={handleCreateShipment}
              disabled={createShipmentMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {createShipmentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  Create Shipment
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
