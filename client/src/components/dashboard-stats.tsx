import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "@/lib/queryKeys";
import { apiRequest } from "@/lib/queryClient";
import { useCurrency } from "@/hooks/useCurrency";
import { Package, AlertTriangle, DollarSign, ShoppingCart } from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  lowStockItems: number;
  totalValue: string;
  ordersToday: number;
}

export default function DashboardStats() {
  const { formatCurrency } = useCurrency();
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard.stats,
    queryFn: async () => {
      console.log("Fetching dashboard stats...");
      try {
        const response = await apiRequest("GET", "/api/dashboard/stats");
        console.log("Dashboard stats response status:", response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("Dashboard stats API error:", errorData);
          throw new Error(errorData.message || "Failed to fetch dashboard stats");
        }
        
        const data = await response.json();
        console.log("Dashboard stats data received:", data);
        return data;
      } catch (err) {
        console.error("Dashboard stats fetch error:", err);
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - much longer caching
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    refetchInterval: false,
    refetchOnMount: false, // Don't refetch on every mount
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 0, // Don't retry during quota issues
    enabled: true, // But you can set to false to completely disable
  });

  console.log("Dashboard stats state:", { isLoading, error: error?.message, hasData: !!stats });

  if (error) {
    console.error("Dashboard stats error:", error);
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="col-span-full bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <p className="text-yellow-800 font-semibold">
              ⚠️ Firebase Quota Exceeded
            </p>
            <p className="text-sm text-yellow-700 mt-2">
              Your Firestore database has reached its daily quota limit. 
            </p>
            <p className="text-sm text-yellow-600 mt-2">
              <strong>Solutions:</strong><br/>
              1. Wait for quota reset (midnight Pacific Time)<br/>
              2. Upgrade to Firebase Blaze Plan for unlimited usage<br/>
              3. Dashboard will automatically resume when quota is available
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/3"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Parse totalValue to remove $ and convert to number
  const totalValueNumber = stats?.totalValue 
    ? parseFloat(stats.totalValue.replace(/[^0-9.-]+/g, "")) 
    : 0;

  const statsData = [
    {
      title: "Total Products",
      value: stats?.totalProducts || 0,
      icon: Package,
      color: "chart-1",
      change: "+12% from last month",
      testId: "card-total-products",
    },
    {
      title: "Low Stock Items",
      value: stats?.lowStockItems || 0,
      icon: AlertTriangle,
      color: "primary",
      change: "Needs attention",
      testId: "card-low-stock",
    },
    {
      title: "Total Value",
      value: formatCurrency(totalValueNumber),
      icon: DollarSign,
      color: "chart-2",
      change: "+8% from last month",
      testId: "card-total-value",
    },
    {
      title: "Orders Today",
      value: stats?.ordersToday || 0,
      icon: ShoppingCart,
      color: "chart-3",
      change: "+24% from yesterday",
      testId: "card-orders-today",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {statsData.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} data-testid={stat.testId}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold text-foreground" data-testid={`text-${stat.testId}-value`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`bg-${stat.color}/10 p-3 rounded-lg`}>
                  <Icon className={`text-${stat.color}`} size={24} />
                </div>
              </div>
              <p className={`text-sm text-${stat.color} mt-2`} data-testid={`text-${stat.testId}-change`}>
                {stat.change}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}