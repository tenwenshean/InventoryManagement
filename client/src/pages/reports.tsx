import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Filter, TrendingUp, TrendingDown, Package, DollarSign, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

// Type definitions
interface KeyMetrics {
  totalRevenue: string;
  unitsSold: number;
  avgOrderValue: string;
  returnRate: string;
}

interface SalesDataItem {
  month: string;
  sales: number;
  returns: number;
}

interface InventoryTrendItem {
  month: string;
  inStock: number;
  outStock: number;
}

interface CategoryDataItem {
  name: string;
  value: number;
  color?: string;
}

interface TopProductItem {
  name: string;
  sales: number;
  change: number;
}

interface ReportsData {
  keyMetrics: KeyMetrics;
  salesData: SalesDataItem[];
  inventoryTrends: InventoryTrendItem[];
  categoryData: CategoryDataItem[];
  topProducts: TopProductItem[];
}

export default function Reports() {
  // Fetch real data from the API
  const { data: reportsData, isLoading, error } = useQuery<ReportsData>({
    queryKey: ['/api/reports/data'],
    queryFn: async () => {
      const response = await fetch('/api/reports/data');
      if (!response.ok) {
        throw new Error('Failed to fetch reports data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-auto"
          style={{
            background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
          }}
        >
          <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
            <div className="flex items-center space-x-2">
              <Loader2 className="w-6 h-6 animate-spin text-red-600" />
              <span className="text-lg text-gray-700">Loading reports data...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 overflow-auto"
          style={{
            background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
          }}
        >
          <div className="container mx-auto p-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Reports</h2>
              <p className="text-gray-600">Unable to fetch reports data. Please try again later.</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Safely destructure with default values
  const keyMetrics: KeyMetrics = reportsData?.keyMetrics || {
    totalRevenue: '$0',
    unitsSold: 0,
    avgOrderValue: '$0',
    returnRate: '0%'
  };

  const salesData: SalesDataItem[] = reportsData?.salesData || [];
  const inventoryTrends: InventoryTrendItem[] = reportsData?.inventoryTrends || [];
  const categoryData: CategoryDataItem[] = reportsData?.categoryData || [];
  const topProducts: TopProductItem[] = reportsData?.topProducts || [];

  // Define default colors for pie chart if not provided by API
  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 overflow-auto"
        style={{
          background: "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)",
        }}
      >
      <div className="container mx-auto p-6 space-y-6" data-testid="reports-page">
        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="reports-title">
              Reports & Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400" data-testid="reports-description">
              Comprehensive insights into your inventory performance
            </p>
          </div>
          <div className="flex space-x-2">
            <Select defaultValue="30days">
              <SelectTrigger className="w-32" data-testid="date-filter">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 days</SelectItem>
                <SelectItem value="30days">Last 30 days</SelectItem>
                <SelectItem value="90days">Last 90 days</SelectItem>
                <SelectItem value="1year">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" data-testid="button-filter">
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" data-testid="button-export">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-red-200 dark:border-red-900" data-testid="card-revenue">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{keyMetrics.totalRevenue}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                +20.1% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900" data-testid="card-units-sold">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Units Sold</CardTitle>
              <Package className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{keyMetrics.unitsSold?.toLocaleString() || '0'}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12.5% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900" data-testid="card-avg-order">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Order Value</CardTitle>
              <TrendingUp className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{keyMetrics.avgOrderValue}</div>
              <div className="flex items-center text-xs text-red-600">
                <TrendingDown className="w-3 h-3 mr-1" />
                -2.3% from last month
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-900" data-testid="card-return-rate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Return Rate</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{keyMetrics.returnRate}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingDown className="w-3 h-3 mr-1" />
                -0.5% from last month
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sales Trend Chart */}
          <Card data-testid="chart-sales-trend">
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
              <CardDescription>Monthly sales and returns comparison</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="sales" fill="#dc2626" />
                  <Bar dataKey="returns" fill="#7c2d12" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Inventory Movement */}
          <Card data-testid="chart-inventory-movement">
            <CardHeader>
              <CardTitle>Inventory Movement</CardTitle>
              <CardDescription>Stock in vs stock out trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={inventoryTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="inStock" stroke="#dc2626" strokeWidth={2} />
                  <Line type="monotone" dataKey="outStock" stroke="#7c2d12" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card data-testid="chart-category-distribution">
            <CardHeader>
              <CardTitle>Category Distribution</CardTitle>
              <CardDescription>Sales breakdown by product category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label
                  >
                    {categoryData.map((entry: CategoryDataItem, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card data-testid="table-top-products">
            <CardHeader>
              <CardTitle>Top Selling Products</CardTitle>
              <CardDescription>Best performing products this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topProducts.map((product: TopProductItem, index: number) => (
                  <div key={index} className="flex items-center justify-between" data-testid={`product-${index}`}>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="w-6 h-6 p-0 text-xs">
                        {index + 1}
                      </Badge>
                      <span className="font-medium">{product.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {product.sales} units
                      </span>
                      <Badge 
                        variant={product.change > 0 ? "default" : "destructive"}
                        className={product.change > 0 ? "bg-green-100 text-green-800" : ""}
                      >
                        {product.change > 0 ? '+' : ''}{product.change}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Reports Section */}
        <Card data-testid="section-additional-reports">
          <CardHeader>
            <CardTitle>Additional Reports</CardTitle>
            <CardDescription>Generate detailed reports for specific business needs</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-inventory-report">
                <Package className="w-6 h-6 text-red-600" />
                <span>Inventory Report</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-financial-report">
                <DollarSign className="w-6 h-6 text-red-600" />
                <span>Financial Report</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col space-y-2" data-testid="button-custom-report">
                <TrendingUp className="w-6 h-6 text-red-600" />
                <span>Custom Report</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </main>
    </div>
  );
}