import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { queryKeys } from "@/lib/queryKeys";
import { Package, AlertTriangle, DollarSign, ShoppingCart } from "lucide-react";

interface DashboardStats {
  totalProducts: number;
  lowStockItems: number;
  totalValue: string;
  ordersToday: number;
}

export default function DashboardStats() {
  const { data: stats, isLoading, error } = useQuery<DashboardStats>({
    queryKey: queryKeys.dashboard.stats,
    staleTime: 1000 * 30, // Consider data stale after 30 seconds
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

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
      value: stats?.totalValue || "$0",
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