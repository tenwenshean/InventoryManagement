import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart, ComposedChart } from 'recharts';
import { useCurrency } from '@/hooks/useCurrency';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Printer } from "lucide-react";

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
  id?: string;
  name: string;
  sku?: string;
  category?: string;
  supplier?: string;
  price?: number;
  costPrice?: number;
  quantity?: number;
  qrCode?: string | null;
  sales: number;
  returns?: number;
  returnRate?: string;
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
  calculation?: {
    formula: string;
    slope: number;
    intercept: number;
    rSquared: number;
    dataPoints: number;
    method: string;
    xValue: number;
    calculation: string;
  };
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
  topRefundedProducts?: TopProductItem[];
  accountingData?: AccountingDataItem[];
  predictions?: PredictionItem[];
  cashFlow?: CashFlowItem[];
  insights?: {
    trend: 'increasing' | 'decreasing' | 'stable';
    recommendation: string;
    anomalies?: number;
  };
}

// Report sections configuration
const reportSections = [
  { id: 'products', label: 'Product Inventory', description: 'All products with quantities and details' },
  { id: 'topProducts', label: 'Top Selling & Refunded Products', description: 'Best and worst performing products with full details (SKU, QR, pricing)' },
  { id: 'suppliers', label: 'Supplier Analysis', description: 'Refund and sales analysis by supplier' },
  { id: 'categories', label: 'Category Distribution', description: 'Product breakdown by category' },
  { id: 'salesTrends', label: 'Sales Trends', description: 'Monthly sales and returns data' },
  { id: 'inventory', label: 'Inventory Movement', description: 'Stock in/out trends' },
  { id: 'predictions', label: 'AI Predictions', description: 'Machine learning forecasts' },
  { id: 'insights', label: 'Business Insights', description: 'Key metrics and recommendations' },
];

export default function Reports() {
  const { formatCurrency } = useCurrency();
  const [timeRange, setTimeRange] = useState("30days");
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isCustomReportOpen, setIsCustomReportOpen] = useState(false);
  const [selectedReportSections, setSelectedReportSections] = useState<string[]>([]);
  
  console.log('[REPORTS COMPONENT] Rendering...');
  
  // Fetch real data from the API
  const { data: reportsData, isLoading, error } = useQuery<ReportsData>({
    queryKey: ['/api/reports/data', timeRange],
    queryFn: async () => {
      console.log('[REPORTS] Fetching reports data...');
      try {
        const response = await apiRequest('GET', `/api/reports/data?range=${timeRange}`);
        const data = await response.json();
        console.log('[REPORTS] Data received:', data);
        console.log('[REPORTS] Top products:', JSON.stringify(data.topProducts, null, 2));
        console.log('[REPORTS] Top refunded:', JSON.stringify(data.topRefundedProducts, null, 2));
        return data;
      } catch (err: any) {
        console.error('[REPORTS] Error fetching data:', err);
        console.error('[REPORTS] Error message:', err.message);
        throw err;
      }
    },
    staleTime: 0, // No cache - always fetch fresh data
    gcTime: 0, // Don't keep in cache
  });

  console.log('[REPORTS COMPONENT] State:', { isLoading, hasError: !!error, hasData: !!reportsData });

  // Safely destructure with default values (must be before conditional returns for hooks)
  const keyMetrics: KeyMetrics = reportsData?.keyMetrics || {
    totalRevenue: '$0',
    unitsSold: 0,
    avgOrderValue: '$0',
    returnRate: '0%'
  };

  // Parse currency strings from backend and format with current currency
  const totalRevenueValue = parseFloat(keyMetrics.totalRevenue.replace(/[^0-9.-]/g, '')) || 0;
  const avgOrderValue = parseFloat(keyMetrics.avgOrderValue.replace(/[^0-9.-]/g, '')) || 0;

  const salesData: SalesDataItem[] = reportsData?.salesData || [];
  const inventoryTrends: InventoryTrendItem[] = reportsData?.inventoryTrends || [];
  const categoryData: CategoryDataItem[] = reportsData?.categoryData || [];
  const topProducts: TopProductItem[] = reportsData?.topProducts || [];
  const topRefundedProducts: TopProductItem[] = reportsData?.topRefundedProducts || [];
  const accountingData: AccountingDataItem[] = reportsData?.accountingData || [];
  const predictions: PredictionItem[] = reportsData?.predictions || [];
  const cashFlow: CashFlowItem[] = reportsData?.cashFlow || [];
  const insights = reportsData?.insights;

  // Calculate supplier refund statistics (must be before conditional returns for hooks)
  const supplierRefundStats = useMemo(() => {
    const stats = new Map<string, { totalReturns: number, totalSales: number, products: Set<string> }>();
    
    // Add refunded products data
    topRefundedProducts.forEach(product => {
      const supplier = product.supplier || 'N/A';
      if (!stats.has(supplier)) {
        stats.set(supplier, { totalReturns: 0, totalSales: 0, products: new Set() });
      }
      const supplierData = stats.get(supplier)!;
      supplierData.totalReturns += product.returns || 0;
      supplierData.totalSales += product.sales || 0;
      supplierData.products.add(product.name);
    });

    // Add top selling products data for sales count
    topProducts.forEach(product => {
      const supplier = product.supplier || 'N/A';
      if (!stats.has(supplier)) {
        stats.set(supplier, { totalReturns: 0, totalSales: 0, products: new Set() });
      }
      const supplierData = stats.get(supplier)!;
      // Only add sales if we haven't counted this product already
      if (!supplierData.products.has(product.name)) {
        supplierData.totalSales += product.sales || 0;
        supplierData.products.add(product.name);
      }
    });

    // Convert to array and calculate return rate
    const supplierArray = Array.from(stats.entries())
      .map(([supplier, data]) => ({
        supplier,
        totalReturns: data.totalReturns,
        totalSales: data.totalSales,
        returnRate: data.totalSales > 0 ? (data.totalReturns / data.totalSales * 100).toFixed(1) + '%' : '0%',
        productCount: data.products.size
      }))
      .filter(s => s.supplier !== 'N/A');

    // Sort by return rate
    supplierArray.sort((a, b) => parseFloat(b.returnRate) - parseFloat(a.returnRate));

    return {
      all: supplierArray,
      mostRefunded: supplierArray[0] || null,
      leastRefunded: supplierArray[supplierArray.length - 1] || null
    };
  }, [topProducts, topRefundedProducts]);

  if (isLoading) {
    console.log('[REPORTS COMPONENT] Rendering loading state');
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

  console.log('[REPORTS COMPONENT] Extracting data...');

  // Define default colors for pie chart if not provided by API
  const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#fecaca'];

  // Report generation handlers
  const handlePrintInventoryReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportHTML = generateFullInventoryReport();
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handlePrintCustomReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const reportHTML = generateCustomReport(selectedReportSections);
    printWindow.document.write(reportHTML);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
    setIsCustomReportOpen(false);
    setSelectedReportSections([]);
  };

  const generateFullInventoryReport = (): string => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Full Inventory Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
          h2 { color: #dc2626; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #dc2626; color: white; }
          .metric-card { display: inline-block; border: 1px solid #ddd; padding: 15px; margin: 10px; min-width: 200px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #dc2626; }
          .metric-label { color: #666; font-size: 14px; }
          .section { page-break-inside: avoid; margin-bottom: 40px; }
          .trend-up { color: #22c55e; }
          .trend-down { color: #ef4444; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>📊 Complete Inventory & Business Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Period:</strong> ${timeRange}</p>

        <div class=\"section\">
          <h2>📈 Key Business Metrics</h2>
          <div class=\"metric-card\">
            <div class=\"metric-label\">Total Revenue</div>
            <div class=\"metric-value\">${formatCurrency(totalRevenueValue)}</div>
          </div>
          <div class=\"metric-card\">
            <div class=\"metric-label\">Units Sold</div>
            <div class=\"metric-value\">${keyMetrics.unitsSold}</div>
          </div>
          <div class=\"metric-card\">
            <div class=\"metric-label\">Avg Order Value</div>
            <div class=\"metric-value\">${formatCurrency(avgOrderValue)}</div>
          </div>
          <div class=\"metric-card\">
            <div class=\"metric-label\">Return Rate</div>
            <div class=\"metric-value\">${keyMetrics.returnRate}</div>
          </div>
        </div>

        <div class=\"section\">
          <h2>🏆 Top Selling Products</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Units Sold</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.map((product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${product.name}</strong></td>
                  <td>${product.sku || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>${product.supplier || 'N/A'}</td>
                  <td>$${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || '0').toFixed(2)}</td>
                  <td>$${typeof product.costPrice === 'number' ? product.costPrice.toFixed(2) : parseFloat(product.costPrice || '0').toFixed(2)}</td>
                  <td>${product.quantity || 0}</td>
                  <td><strong>${product.sales}</strong></td>
                  <td>${product.qrCode || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${topRefundedProducts && topRefundedProducts.length > 0 ? `
        <div class=\"section\">
          <h2>⚠️ Top Refunded Products</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Returns</th>
                <th>Return Rate</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody>
              ${topRefundedProducts.map((product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${product.name}</strong></td>
                  <td>${product.sku || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>${product.supplier || 'N/A'}</td>
                  <td>$${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || '0').toFixed(2)}</td>
                  <td>$${typeof product.costPrice === 'number' ? product.costPrice.toFixed(2) : parseFloat(product.costPrice || '0').toFixed(2)}</td>
                  <td>${product.quantity || 0}</td>
                  <td><strong>${product.returns}</strong></td>
                  <td class=\"trend-down\">${product.returnRate}</td>
                  <td>${product.qrCode || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${supplierRefundStats.all.length > 0 ? `
        <div class=\"section\">
          <h2>🏢 Supplier Analysis</h2>
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Products</th>
                <th>Total Sales</th>
                <th>Total Returns</th>
                <th>Return Rate</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${supplierRefundStats.all.map((supplier, index) => {
                const isWorst = index === 0;
                const isBest = index === supplierRefundStats.all.length - 1;
                return `
                <tr>
                  <td><strong>${supplier.supplier}</strong></td>
                  <td>${supplier.productCount}</td>
                  <td>${supplier.totalSales}</td>
                  <td>${supplier.totalReturns}</td>
                  <td class="${isWorst ? 'trend-down' : isBest ? 'trend-up' : ''}">${supplier.returnRate}</td>
                  <td>${isWorst ? '⚠️ Most Refunded' : isBest ? '✅ Least Refunded' : '-'}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
          <div style=\"margin-top: 20px; padding: 15px; border-left: 4px solid #dc2626; background-color: #fef2f2;\">
            <strong>📊 Key Insights:</strong><br>
            <strong style=\"color: #dc2626;\">Most Refunded:</strong> ${supplierRefundStats.mostRefunded?.supplier} (${supplierRefundStats.mostRefunded?.returnRate} return rate)<br>
            <strong style=\"color: #22c55e;\">Least Refunded:</strong> ${supplierRefundStats.leastRefunded?.supplier} (${supplierRefundStats.leastRefunded?.returnRate} return rate)
          </div>
        </div>
        ` : ''}

        <div class=\"section\">
          <h2>📦 Category Distribution</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${categoryData.map(cat => `
                <tr>
                  <td>${cat.name}</td>
                  <td>${cat.value}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class=\"section\">
          <h2>📊 Monthly Sales Trends</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sales</th>
                <th>Returns</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(data => `
                <tr>
                  <td>${data.month}</td>
                  <td>${data.sales}</td>
                  <td>${data.returns}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class=\"section\">
          <h2>📦 Inventory Movement</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Stock In</th>
                <th>Stock Out</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryTrends.map(trend => `
                <tr>
                  <td>${trend.month}</td>
                  <td>${trend.inStock}</td>
                  <td>${trend.outStock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${predictions.length > 0 ? `
        <div class=\"section\">
          <h2>🤖 AI-Powered Predictions</h2>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Predicted Sales</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${predictions.map(pred => `
                <tr>
                  <td>${pred.period}</td>
                  <td>${formatCurrency(pred.predicted)}</td>
                  <td>${pred.confidence}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        ${insights ? `
        <div class=\"section\">
          <h2>💡 Business Insights</h2>
          <p><strong>Trend:</strong> ${insights.trend.toUpperCase()}</p>
          <p><strong>Recommendation:</strong> ${insights.recommendation}</p>
          ${insights.anomalies ? `<p><strong>Anomalies Detected:</strong> ${insights.anomalies}</p>` : ''}
        </div>
        ` : ''}

        <div style=\"margin-top: 50px; text-align: center; color: #666; font-size: 12px;\">
          <p>Generated by Inventory Management System</p>
          <p>© ${new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </body>
      </html>
    `;
  };

  const generateCustomReport = (sections: string[]): string => {
    let sectionsHTML = '';

    if (sections.includes('products') || sections.includes('topProducts')) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>🏆 Top Selling Products</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Units Sold</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody>
              ${topProducts.map((product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${product.name}</strong></td>
                  <td>${product.sku || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>${product.supplier || 'N/A'}</td>
                  <td>$${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || '0').toFixed(2)}</td>
                  <td>$${typeof product.costPrice === 'number' ? product.costPrice.toFixed(2) : parseFloat(product.costPrice || '0').toFixed(2)}</td>
                  <td>${product.quantity || 0}</td>
                  <td><strong>${product.sales}</strong></td>
                  <td>${product.qrCode || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        ${topRefundedProducts && topRefundedProducts.length > 0 ? `
        <div class=\"section\">
          <h2>⚠️ Top Refunded Products</h2>
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product Name</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Returns</th>
                <th>Return Rate</th>
                <th>QR Code</th>
              </tr>
            </thead>
            <tbody>
              ${topRefundedProducts.map((product, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${product.name}</strong></td>
                  <td>${product.sku || 'N/A'}</td>
                  <td>${product.category || 'N/A'}</td>
                  <td>${product.supplier || 'N/A'}</td>
                  <td>$${typeof product.price === 'number' ? product.price.toFixed(2) : parseFloat(product.price || '0').toFixed(2)}</td>
                  <td>$${typeof product.costPrice === 'number' ? product.costPrice.toFixed(2) : parseFloat(product.costPrice || '0').toFixed(2)}</td>
                  <td>${product.quantity || 0}</td>
                  <td><strong>${product.returns}</strong></td>
                  <td class=\"trend-down\">${product.returnRate}</td>
                  <td>${product.qrCode || 'N/A'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      `;
    }

    if (sections.includes('categories')) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>📦 Category Distribution</h2>
          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${categoryData.map(cat => `
                <tr>
                  <td>${cat.name}</td>
                  <td>${cat.value}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (sections.includes('suppliers')) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>🏢 Supplier Analysis</h2>
          ${supplierRefundStats.all.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Products</th>
                  <th>Total Sales</th>
                  <th>Total Returns</th>
                  <th>Return Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${supplierRefundStats.all.map((supplier, index) => {
                  const isWorst = index === 0;
                  const isBest = index === supplierRefundStats.all.length - 1;
                  return `
                  <tr>
                    <td><strong>${supplier.supplier}</strong></td>
                    <td>${supplier.productCount}</td>
                    <td>${supplier.totalSales}</td>
                    <td>${supplier.totalReturns}</td>
                    <td class="${isWorst ? 'trend-down' : isBest ? 'trend-up' : ''}">${supplier.returnRate}</td>
                    <td>${isWorst ? '⚠️ Most Refunded' : isBest ? '✅ Least Refunded' : '-'}</td>
                  </tr>
                `;
                }).join('')}
              </tbody>
            </table>
            <div style=\"margin-top: 20px; padding: 15px; border-left: 4px solid #dc2626; background-color: #fef2f2;\">
              <strong>📊 Key Insights:</strong><br>
              <strong style=\"color: #dc2626;\">Most Refunded:</strong> ${supplierRefundStats.mostRefunded?.supplier} (${supplierRefundStats.mostRefunded?.returnRate} return rate)<br>
              <strong style=\"color: #22c55e;\">Least Refunded:</strong> ${supplierRefundStats.leastRefunded?.supplier} (${supplierRefundStats.leastRefunded?.returnRate} return rate)
            </div>
          ` : '<p>No supplier data available</p>'}
        </div>
      `;
    }

    if (sections.includes('salesTrends')) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>📊 Monthly Sales Trends</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sales</th>
                <th>Returns</th>
              </tr>
            </thead>
            <tbody>
              ${salesData.map(data => `
                <tr>
                  <td>${data.month}</td>
                  <td>${data.sales}</td>
                  <td>${data.returns}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (sections.includes('inventory')) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>📦 Inventory Movement</h2>
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Stock In</th>
                <th>Stock Out</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryTrends.map(trend => `
                <tr>
                  <td>${trend.month}</td>
                  <td>${trend.inStock}</td>
                  <td>${trend.outStock}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (sections.includes('predictions') && predictions.length > 0) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>🤖 AI-Powered Predictions</h2>
          <table>
            <thead>
              <tr>
                <th>Period</th>
                <th>Predicted Sales</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${predictions.map(pred => `
                <tr>
                  <td>${pred.period}</td>
                  <td>${formatCurrency(pred.predicted)}</td>
                  <td>${pred.confidence}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    if (sections.includes('insights') && insights) {
      sectionsHTML += `
        <div class=\"section\">
          <h2>💡 Business Insights</h2>
          <p><strong>Trend:</strong> ${insights.trend.toUpperCase()}</p>
          <p><strong>Recommendation:</strong> ${insights.recommendation}</p>
          ${insights.anomalies ? `<p><strong>Anomalies Detected:</strong> ${insights.anomalies}</p>` : ''}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Custom Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; }
          h1 { color: #dc2626; border-bottom: 3px solid #dc2626; padding-bottom: 10px; }
          h2 { color: #dc2626; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #dc2626; color: white; }
          .section { page-break-inside: avoid; margin-bottom: 40px; }
          .trend-up { color: #22c55e; }
          .trend-down { color: #ef4444; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <h1>📊 Custom Business Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Period:</strong> ${timeRange}</p>
        
        ${sectionsHTML}

        <div style=\"margin-top: 50px; text-align: center; color: #666; font-size: 12px;\">
          <p>Generated by Inventory Management System</p>
          <p>© ${new Date().getFullYear()} All Rights Reserved</p>
        </div>
      </body>
      </html>
    `;
  };

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
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalRevenueValue)}</div>
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
              <div className="text-2xl font-bold text-red-600">{formatCurrency(avgOrderValue)}</div>
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
                  <CardDescription>Best performing products with full details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topProducts && topProducts.length > 0 ? topProducts.map((product: TopProductItem, index: number) => (
                      <div key={index} className="border-b pb-3 last:border-b-0" data-testid={`product-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="w-6 h-6 p-0 text-xs">
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{product.name}</span>
                          </div>
                          <Badge className="bg-green-100 text-green-800">
                            {product.sales} sold
                          </Badge>
                        </div>
                        <div className="ml-8 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>• SKU: <span className="font-mono">{product.sku || 'N/A'}</span></div>
                          <div>• Price: <span className="font-semibold">{formatCurrency(typeof product.price === 'number' ? product.price : parseFloat(product.price || '0'))}</span> | Cost: {formatCurrency(typeof product.costPrice === 'number' ? product.costPrice : parseFloat(product.costPrice || '0'))}</div>
                          <div>• Category: {product.category || 'N/A'} | Stock: {product.quantity || 0} units</div>
                          <div>• Supplier: <span className="font-semibold text-blue-600">{product.supplier || 'N/A'}</span></div>
                          {product.qrCode && <div>• QR Code: <span className="font-mono text-xs">{product.qrCode}</span></div>}
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-gray-500">No sales data available</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top Refunded Products */}
              <Card data-testid="table-top-refunded">
                <CardHeader>
                  <CardTitle className="text-red-600">Top Refunded Products</CardTitle>
                  <CardDescription>Products with highest return rates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {topRefundedProducts && topRefundedProducts.length > 0 ? topRefundedProducts.map((product: TopProductItem, index: number) => (
                      <div key={index} className="border-b pb-3 last:border-b-0" data-testid={`refunded-${index}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="w-6 h-6 p-0 text-xs">
                              {index + 1}
                            </Badge>
                            <span className="font-medium">{product.name}</span>
                          </div>
                          <Badge variant="destructive">
                            {product.returns} returns ({product.returnRate})
                          </Badge>
                        </div>
                        <div className="ml-8 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <div>SKU: <span className="font-mono">{product.sku || 'N/A'}</span></div>
                          <div>Price: <span className="font-semibold">{formatCurrency(typeof product.price === 'number' ? product.price : parseFloat(product.price || '0'))}</span> | Cost: {formatCurrency(typeof product.costPrice === 'number' ? product.costPrice : parseFloat(product.costPrice || '0'))}</div>
                          <div>Category: {product.category || 'N/A'} | Stock: {product.quantity || 0} units</div>
                          <div>Supplier: <span className="font-semibold text-blue-600">{product.supplier || 'N/A'}</span></div>
                          {product.qrCode && <div>QR Code: <span className="font-mono text-xs">{product.qrCode}</span></div>}
                        </div>
                      </div>
                    )) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-gray-500">No product returns recorded</p>
                        <p className="text-xs text-gray-400 mt-1">Return data will appear here when customers return products</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Supplier Analysis Section */}
            {supplierRefundStats.all.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                {/* Most Refunded Supplier */}
                {supplierRefundStats.mostRefunded && (
                  <Card className="border-red-200 dark:border-red-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Most Refunded Supplier
                      </CardTitle>
                      <CardDescription>Supplier with highest return rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-2xl font-bold text-red-600">
                            {supplierRefundStats.mostRefunded.supplier}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {supplierRefundStats.mostRefunded.productCount} {supplierRefundStats.mostRefunded.productCount === 1 ? 'product' : 'products'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total Returns</div>
                            <div className="text-xl font-semibold text-red-600">
                              {supplierRefundStats.mostRefunded.totalReturns}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total Sales</div>
                            <div className="text-xl font-semibold">
                              {supplierRefundStats.mostRefunded.totalSales}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Return Rate</div>
                            <div className="text-xl font-semibold text-red-600">
                              {supplierRefundStats.mostRefunded.returnRate}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Least Refunded Supplier */}
                {supplierRefundStats.leastRefunded && (
                  <Card className="border-green-200 dark:border-green-900">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="h-5 w-5" />
                        Least Refunded Supplier
                      </CardTitle>
                      <CardDescription>Supplier with lowest return rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {supplierRefundStats.leastRefunded.supplier}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {supplierRefundStats.leastRefunded.productCount} {supplierRefundStats.leastRefunded.productCount === 1 ? 'product' : 'products'}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total Returns</div>
                            <div className="text-xl font-semibold text-green-600">
                              {supplierRefundStats.leastRefunded.totalReturns}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Total Sales</div>
                            <div className="text-xl font-semibold">
                              {supplierRefundStats.leastRefunded.totalSales}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Return Rate</div>
                            <div className="text-xl font-semibold text-green-600">
                              {supplierRefundStats.leastRefunded.returnRate}
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
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
                            <span className="font-medium text-green-600">{formatCurrency(data.revenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Expenses:</span>
                            <span className="font-medium text-red-600">{formatCurrency(data.expenses)}</span>
                          </div>
                          <div className="flex justify-between border-t pt-1">
                            <span className="font-semibold">Net Profit:</span>
                            <span className={`font-bold ${data.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(data.profit)}
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
                  <CardDescription>Linear regression forecast with calculation details</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {predictions.length > 0 && predictions[0].calculation && (
                      <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                        <h4 className="font-semibold text-sm text-purple-900 mb-2">📊 Regression Model</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-700">Method:</span>
                            <span className="font-mono font-semibold text-purple-800">{predictions[0].calculation.method}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Formula:</span>
                            <span className="font-mono font-semibold text-purple-800">{predictions[0].calculation.formula}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Slope (m):</span>
                            <span className="font-mono text-purple-700">{predictions[0].calculation.slope}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Intercept (b):</span>
                            <span className="font-mono text-purple-700">{predictions[0].calculation.intercept}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">R² (accuracy):</span>
                            <span className="font-mono text-purple-700">{predictions[0].calculation.rSquared}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-700">Data points:</span>
                            <span className="font-mono text-purple-700">{predictions[0].calculation.dataPoints} months</span>
                          </div>
                        </div>
                      </div>
                    )}
                    
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
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-gray-600">Predicted Value:</span>
                          <span className="font-bold text-purple-600">{formatCurrency(pred.predicted)}</span>
                        </div>
                        
                        {pred.calculation && (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div className="font-semibold text-gray-700 mb-1">Calculation:</div>
                            <div className="font-mono text-gray-600">
                              y = {pred.calculation.slope} × {pred.calculation.xValue} + {pred.calculation.intercept}
                            </div>
                            <div className="font-mono text-gray-600">
                              = {pred.calculation.calculation.split('=')[1]?.trim()}
                            </div>
                          </div>
                        )}
                        
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
                  <CardTitle>Linear Regression Analysis</CardTitle>
                  <CardDescription>Understanding the prediction model</CardDescription>
                </CardHeader>
                <CardContent>
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertTitle>How Linear Regression Works</AlertTitle>
                    <AlertDescription>
                      Our prediction system uses <strong>Linear Regression</strong>, a statistical method that finds the best-fit line through your historical data points.
                      <div className="mt-3 space-y-2">
                        <div className="font-semibold">The Formula: y = mx + b</div>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li><strong>m (slope)</strong>: The rate of change in revenue over time. Positive = growing, Negative = declining</li>
                          <li><strong>b (intercept)</strong>: The baseline revenue at the starting point</li>
                          <li><strong>R²</strong>: Measures how well the line fits your data (0-1, higher is better)</li>
                          <li><strong>Confidence</strong>: Based on R², adjusted for future distance from known data</li>
                        </ul>
                        <div className="mt-3 p-2 bg-purple-50 rounded text-sm">
                          <strong>Example:</strong> If slope = 100 and intercept = 5000, then for month 12:<br/>
                          <span className="font-mono">y = 100 × 12 + 5000 = $6,200 predicted revenue</span>
                        </div>
                      </div>
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
                    {formatCurrency(avgOrderValue)}
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
            <CardTitle>Generate Reports</CardTitle>
            <CardDescription>Print comprehensive or customized reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                className="h-24 flex flex-col space-y-2 hover:bg-red-50" 
                onClick={() => handlePrintInventoryReport()}
                data-testid="button-inventory-report"
              >
                <Package className="w-8 h-8 text-red-600" />
                <div className="text-center">
                  <div className="font-semibold">Full Inventory Report</div>
                  <div className="text-xs text-gray-500">Print all data & insights</div>
                </div>
              </Button>
              <Button 
                variant="outline" 
                className="h-24 flex flex-col space-y-2 hover:bg-red-50" 
                onClick={() => setIsCustomReportOpen(true)}
                data-testid="button-custom-report"
              >
                <Filter className="w-8 h-8 text-red-600" />
                <div className="text-center">
                  <div className="font-semibold">Custom Report</div>
                  <div className="text-xs text-gray-500">Select sections to print</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom Report Dialog */}
        <Dialog open={isCustomReportOpen} onOpenChange={setIsCustomReportOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Custom Report</DialogTitle>
              <DialogDescription>
                Select which sections to include in your custom report
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {reportSections.map((section) => (
                <div key={section.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={section.id}
                    checked={selectedReportSections.includes(section.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedReportSections([...selectedReportSections, section.id]);
                      } else {
                        setSelectedReportSections(selectedReportSections.filter(id => id !== section.id));
                      }
                    }}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor={section.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {section.label}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {section.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCustomReportOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handlePrintCustomReport()}
                disabled={selectedReportSections.length === 0}
                className="bg-red-600 hover:bg-red-700"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Selected
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
}