import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart, ComposedChart } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download, Filter, TrendingUp, TrendingDown, Package, DollarSign, Loader2, Brain, AlertTriangle, CheckCircle, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ReportsChatbot from "@/components/reports-chatbot";

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

interface AccountingDataItem {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

interface PredictionItem {
  period: string;
  predicted: number;
  confidence: number;
}

interface CashFlowItem {
  month: string;
  inflow: number;
  outflow: number;
  balance: number;
}

interface ReportsData {
  keyMetrics: KeyMetrics;
  salesData: SalesDataItem[];
  inventoryTrends: InventoryTrendItem[];
  categoryData: CategoryDataItem[];
  topProducts: TopProductItem[];
  accountingData?: AccountingDataItem[];
  predictions?: PredictionItem[];
  cashFlow?: CashFlowItem[];
  insights?: {
    trend: 'increasing' | 'decreasing' | 'stable';
    recommendation: string;
    anomalies?: number;
  };
}

export default function Reports() {
  const [timeRange, setTimeRange] = useState("30days");
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  
  // Fetch real data from the API
  const { data: reportsData, isLoading, error } = useQuery<ReportsData>({
    queryKey: ['/api/reports/data', timeRange],
    queryFn: async () => {
      console.log('[REPORTS] Fetching reports data...');
      try {
        const response = await apiRequest('GET', `/api/reports/data?range=${timeRange}`);
        const data = await response.json();
        console.log('[REPORTS] Data received:', data);
        return data;
      } catch (err: any) {
        console.error('[REPORTS] Error fetching data:', err);
        console.error('[REPORTS] Error message:', err.message);
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-6 h-6 animate-spin text-red-600" />
          <span className="text-lg text-gray-700">Loading reports data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    console.error('[REPORTS] Render error:', error);
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error Loading Reports</h2>
          <p className="text-gray-600">Unable to fetch reports data. Please try again later.</p>
          <p className="text-sm text-gray-500 mt-2">Error: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
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
  const accountingData: AccountingDataItem[] = reportsData?.accountingData || [];
  const predictions: PredictionItem[] = reportsData?.predictions || [];
  const cashFlow: CashFlowItem[] = reportsData?.cashFlow || [];
  const insights = reportsData?.insights;

  // Define default colors for pie chart if not provided by API
  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'];

  return (
    <div className="container mx-auto p-6 space-y-6 relative" data-testid="reports-page">
        {/* AI Chatbot */}
        <ReportsChatbot 
          isOpen={isChatbotOpen} 
          onClose={() => setIsChatbotOpen(false)}
          reportsData={reportsData}
        />

        {/* Floating AI Assistant Button */}
        {!isChatbotOpen && (
          <Button
            onClick={() => setIsChatbotOpen(true)}
            className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 p-0"
            data-testid="button-open-ai-chat"
          >
            <div className="relative">
              <Brain size={24} className="text-white" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white"></span>
            </div>
          </Button>
        )}

        {/* Header */}
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="reports-title">
              Reports & Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-400" data-testid="reports-description">
              Comprehensive insights into your inventory performance with AI-powered predictions
            </p>
          </div>
          <div className="flex space-x-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
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

        {/* ML Insights Alert */}
        {insights && (
          <Alert className={insights.trend === 'increasing' ? 'border-green-500' : insights.trend === 'decreasing' ? 'border-red-500' : 'border-blue-500'}>
            <Brain className="h-4 w-4" />
            <AlertTitle>AI-Powered Insights</AlertTitle>
            <AlertDescription>
              <p className="font-medium">Trend: {insights.trend.toUpperCase()}</p>
              <p className="mt-1">{insights.recommendation}</p>
              {insights.anomalies && insights.anomalies > 0 && (
                <p className="mt-1 text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {insights.anomalies} anomalies detected in recent data
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}

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

        {/* Tabbed Analytics View */}
        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="sales">Sales & Inventory</TabsTrigger>
            <TabsTrigger value="accounting">Accounting & Finance</TabsTrigger>
            <TabsTrigger value="predictions">AI Predictions</TabsTrigger>
            <TabsTrigger value="insights">Business Insights</TabsTrigger>
          </TabsList>

          {/* Sales & Inventory Tab */}
          <TabsContent value="sales" className="space-y-6">
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
                      <Legend />
                      <Bar dataKey="sales" fill="#dc2626" name="Sales" />
                      <Bar dataKey="returns" fill="#7c2d12" name="Returns" />
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
                      <Legend />
                      <Line type="monotone" dataKey="inStock" stroke="#dc2626" strokeWidth={2} name="Stock In" />
                      <Line type="monotone" dataKey="outStock" stroke="#7c2d12" strokeWidth={2} name="Stock Out" />
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
                      <Legend />
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
          </TabsContent>

          {/* Accounting & Finance Tab */}
          <TabsContent value="accounting" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue vs Expenses */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue vs Expenses</CardTitle>
                  <CardDescription>Monthly financial performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={accountingData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="revenue" fill="#22c55e" name="Revenue" />
                      <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
                      <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Profit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cash Flow Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle>Cash Flow Analysis</CardTitle>
                  <CardDescription>Track your cash inflows and outflows</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="inflow" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Cash Inflow" />
                      <Area type="monotone" dataKey="outflow" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Cash Outflow" />
                      <Line type="monotone" dataKey="balance" stroke="#3b82f6" strokeWidth={2} name="Balance" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Profit Margin Trend */}
              <Card>
                <CardHeader>
                  <CardTitle>Profit Margin Trend</CardTitle>
                  <CardDescription>Track profitability over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={accountingData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Profit Margin') return `${value.toFixed(1)}%`;
                          return `$${value.toLocaleString()}`;
                        }}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey={(data: AccountingDataItem) => data.revenue > 0 ? ((data.profit / data.revenue) * 100) : 0}
                        stroke="#8b5cf6" 
                        strokeWidth={2} 
                        name="Profit Margin" 
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expense Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Financial Summary</CardTitle>
                  <CardDescription>Detailed breakdown of finances</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {accountingData.slice(-3).reverse().map((data, index) => (
                      <div key={index} className="border-b pb-3 last:border-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold text-lg">{data.month}</span>
                          <Badge variant={data.profit > 0 ? "default" : "destructive"} className={data.profit > 0 ? "bg-green-100 text-green-800" : ""}>
                            {data.profit > 0 ? 'Profitable' : 'Loss'}
                          </Badge>
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Revenue:</span>
                            <span className="font-medium text-green-600">${data.revenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Expenses:</span>
                            <span className="font-medium text-red-600">${data.expenses.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1">
                            <span className="font-semibold">Net Profit:</span>
                            <span className={`font-bold ${data.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ${data.profit.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Margin:</span>
                            <span className="font-medium">
                              {data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Predictions Tab */}
          <TabsContent value="predictions" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Forecast */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-600" />
                    Sales Forecast (ML Powered)
                  </CardTitle>
                  <CardDescription>AI-predicted sales for upcoming periods</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={predictions}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="predicted" fill="#8b5cf6" name="Predicted Sales" />
                      <Line yAxisId="right" type="monotone" dataKey="confidence" stroke="#f59e0b" strokeWidth={2} name="Confidence %" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Prediction Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Prediction Insights</CardTitle>
                  <CardDescription>Detailed forecast analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {predictions.map((pred, index) => (
                      <div key={index} className="border-b pb-3 last:border-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-semibold">{pred.period}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              pred.confidence > 80 ? 'border-green-500 text-green-700' :
                              pred.confidence > 60 ? 'border-yellow-500 text-yellow-700' :
                              'border-red-500 text-red-700'
                            }
                          >
                            {pred.confidence}% Confidence
                          </Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Predicted Value:</span>
                          <span className="font-bold text-purple-600">${pred.predicted.toLocaleString()}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          {pred.confidence > 70 ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                          )}
                          <span className="text-xs text-gray-500">
                            {pred.confidence > 70 ? 'High confidence prediction' : 'Monitor closely - variable confidence'}
                          </span>
                        </div>
                      </div>
                    ))}
                    {predictions.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Not enough historical data for predictions.</p>
                        <p className="text-sm">Continue tracking sales to enable AI forecasting.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reorder Recommendations */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Smart Reorder Recommendations</CardTitle>
                  <CardDescription>AI-powered inventory optimization</CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertTitle>Machine Learning Analysis</AlertTitle>
                    <AlertDescription>
                      Based on historical sales patterns, demand forecasting, and seasonal trends, our AI recommends:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Review low-stock items before they reach reorder point</li>
                        <li>Increase safety stock for high-demand products by 15%</li>
                        <li>Consider promotional strategies for slow-moving inventory</li>
                        <li>Optimize ordering frequency to reduce holding costs</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Business Insights Tab */}
          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Inventory Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600 mb-2">
                    {keyMetrics.returnRate}
                  </div>
                  <p className="text-sm text-gray-600">Return Rate - Excellent Performance</p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Below industry average</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Velocity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    {keyMetrics.unitsSold}
                  </div>
                  <p className="text-sm text-gray-600">Units Sold This Period</p>
                  <div className="mt-4 flex items-center gap-2 text-sm text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span>+12.5% vs last period</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Revenue Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600 mb-2">
                    {keyMetrics.avgOrderValue}
                  </div>
                  <p className="text-sm text-gray-600">Average Order Value</p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Target: $50+</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Key Business Metrics & KPIs</CardTitle>
                <CardDescription>Performance indicators and recommendations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-l-4 border-green-500 pl-4 py-2">
                    <h4 className="font-semibold text-green-700">Strong Performance</h4>
                    <p className="text-sm text-gray-600 mt-1">Revenue growth is exceeding targets by 20.1%. Continue current strategies and consider scaling successful products.</p>
                  </div>
                  <div className="border-l-4 border-blue-500 pl-4 py-2">
                    <h4 className="font-semibold text-blue-700">Optimization Opportunity</h4>
                    <p className="text-sm text-gray-600 mt-1">Inventory turnover can be improved by 10% through better demand forecasting and stock management.</p>
                  </div>
                  <div className="border-l-4 border-amber-500 pl-4 py-2">
                    <h4 className="font-semibold text-amber-700">Action Required</h4>
                    <p className="text-sm text-gray-600 mt-1">Average order value decreased by 2.3%. Consider implementing cross-selling and bundle strategies.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Charts Grid - Moved to tabs above */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ display: 'none' }}>
          {/* These are now in the Sales & Inventory tab */}
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
  );
}