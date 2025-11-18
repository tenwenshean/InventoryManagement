import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Bell,
  X,
  Ticket,
  Package,
  Check,
  CheckCheck
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";

export default function NotificationsBell() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch notifications
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['notifications', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const response = await apiRequest('GET', `/api/notifications?userId=${user.uid}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!user?.uid,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Count unread notifications
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Mark notifications as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (notificationIds: string[]) => {
      const response = await apiRequest('POST', '/api/notifications/mark-read', {
        userId: user?.uid,
        notificationIds
      });
      if (!response.ok) throw new Error('Failed to mark notifications as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await apiRequest('DELETE', `/api/notifications/${notificationId}`);
      if (!response.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Mark all as read
  const handleMarkAllRead = () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    if (unreadIds.length > 0) {
      markReadMutation.mutate(unreadIds);
    }
  };

  // Mark single notification as read when opened
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate([notification.id]);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'coupon':
        return <Ticket className="w-5 h-5 text-green-600" />;
      case 'order':
        return <Package className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  if (!user) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600"
              variant="destructive"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs"
            >
              <CheckCheck className="w-4 h-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Bell className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const createdAt = notification.createdAt?.toDate 
                  ? notification.createdAt.toDate() 
                  : new Date(notification.createdAt);

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      !notification.isRead ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="font-semibold text-sm mb-1">
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 break-words">
                              {notification.message}
                            </p>
                            
                            {notification.data && (
                              <div className="mt-2">
                                {notification.type === 'coupon' && (() => {
                                  try {
                                    const data = JSON.parse(notification.data);
                                    return (
                                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 border border-green-300 rounded-md">
                                        <Ticket className="w-4 h-4 text-green-700" />
                                        <code className="text-sm font-mono font-semibold text-green-800">
                                          {data.couponCode}
                                        </code>
                                      </div>
                                    );
                                  } catch {
                                    return null;
                                  }
                                })()}
                              </div>
                            )}
                            
                            <p className="text-xs text-gray-400 mt-2">
                              {formatDistanceToNow(createdAt, { addSuffix: true })}
                            </p>
                          </div>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            <X className="w-4 h-4 text-gray-400" />
                          </Button>
                        </div>
                        
                        {!notification.isRead && (
                          <div className="flex items-center gap-1 mt-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            <span className="text-xs text-blue-600 font-medium">New</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
