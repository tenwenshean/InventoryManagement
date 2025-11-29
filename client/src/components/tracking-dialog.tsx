import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, MapPin, Calendar, CheckCircle, Truck } from "lucide-react";

interface TrackingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNo: string;
  orderNumber?: string;
}

export function TrackingDialog({ open, onOpenChange, trackingNo, orderNumber }: TrackingDialogProps) {
  // Fetch tracking information
  const { data: trackingData, isLoading } = useQuery({
    queryKey: ['tracking', trackingNo],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/shipping/track/${trackingNo}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tracking information');
      }
      
      return response.json();
    },
    enabled: open && !!trackingNo,
    refetchInterval: 60000 // Refetch every minute
  });

  const getStatusColor = (status: string) => {
    const lowerStatus = status?.toLowerCase() || '';
    
    if (lowerStatus.includes('delivered')) return 'bg-green-100 text-green-800 border-green-300';
    if (lowerStatus.includes('transit') || lowerStatus.includes('shipping')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (lowerStatus.includes('picked') || lowerStatus.includes('collected')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    if (lowerStatus.includes('failed') || lowerStatus.includes('error')) return 'bg-red-100 text-red-800 border-red-300';
    
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getStatusIcon = (status: string) => {
    const lowerStatus = status?.toLowerCase() || '';
    
    if (lowerStatus.includes('delivered')) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (lowerStatus.includes('transit')) return <Truck className="w-5 h-5 text-blue-600" />;
    if (lowerStatus.includes('picked')) return <Package className="w-5 h-5 text-yellow-600" />;
    
    return <Package className="w-5 h-5 text-gray-600" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Track Your Order
          </DialogTitle>
          {orderNumber && (
            <DialogDescription>
              Order #{orderNumber}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Tracking Number */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Tracking Number</p>
                <p className="font-mono font-semibold text-lg">{trackingNo}</p>
              </div>
              {trackingData?.courier && (
                <div className="text-right">
                  <p className="text-sm text-gray-600 mb-1">Courier</p>
                  <p className="font-semibold">{trackingData.courier}</p>
                </div>
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-red-600" />
              <span className="ml-3 text-gray-600">Loading tracking information...</span>
            </div>
          )}

          {/* Tracking Data */}
          {!isLoading && trackingData && (
            <>
              {/* Current Status */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg border-2 border-red-200">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getStatusIcon(trackingData.status)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">Current Status</p>
                    <Badge className={`${getStatusColor(trackingData.status)} font-semibold`}>
                      {trackingData.status}
                    </Badge>
                  </div>
                </div>
                {trackingData.estimatedDelivery && (
                  <div className="mt-3 pt-3 border-t border-red-200">
                    <p className="text-sm text-gray-600 mb-1">Estimated Delivery</p>
                    <p className="font-semibold text-red-900">
                      {new Date(trackingData.estimatedDelivery).toLocaleDateString('en-MY', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                )}
              </div>

              {/* Tracking Timeline */}
              {trackingData.events && trackingData.events.length > 0 && (
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-red-600" />
                    Tracking History
                  </h3>
                  <div className="space-y-3">
                    {trackingData.events.map((event: any, index: number) => (
                      <div
                        key={index}
                        className={`relative pl-8 pb-4 ${
                          index !== trackingData.events.length - 1 ? 'border-l-2 border-gray-200' : ''
                        }`}
                      >
                        {/* Timeline Dot */}
                        <div className={`absolute left-0 top-0 w-4 h-4 rounded-full border-2 ${
                          index === 0 
                            ? 'bg-red-600 border-red-600' 
                            : 'bg-white border-gray-300'
                        }`} />

                        {/* Event Content */}
                        <div className={`bg-white border rounded-lg p-3 ${
                          index === 0 ? 'border-red-200 shadow-sm' : 'border-gray-200'
                        }`}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className={`font-semibold ${index === 0 ? 'text-red-900' : 'text-gray-900'}`}>
                              {event.status || event.description}
                            </p>
                            <span className={`text-xs px-2 py-1 rounded ${
                              index === 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {index === 0 ? 'Latest' : ''}
                            </span>
                          </div>

                          {event.description && event.description !== event.status && (
                            <p className="text-sm text-gray-600 mb-2">
                              {event.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {event.timestamp && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {new Date(event.timestamp).toLocaleString('en-MY', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            )}

                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No Events */}
              {(!trackingData.events || trackingData.events.length === 0) && (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-600 font-medium">No tracking events yet</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Tracking information will appear here once the shipment is picked up
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error State */}
          {!isLoading && !trackingData && (
            <div className="text-center py-8 bg-red-50 rounded-lg">
              <Package className="w-12 h-12 mx-auto text-red-300 mb-3" />
              <p className="text-red-800 font-medium">Unable to load tracking information</p>
              <p className="text-sm text-red-600 mt-1">
                Please try again later or contact support
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
