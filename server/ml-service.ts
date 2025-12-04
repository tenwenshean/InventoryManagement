/**
 * Machine Learning Service for Inventory Management
 * Provides predictions and insights using statistical analysis
 */

interface DataPoint {
  date: Date;
  value: number;
}

interface PredictionResult {
  predictedValue: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  recommendation: string;
}

interface SalesData {
  productId: string;
  productName: string;
  date: Date;
  quantity: number;
  revenue: number;
}

export class MLService {
  /**
   * Simple Linear Regression for trend prediction
   */
  private linearRegression(data: DataPoint[]): { slope: number; intercept: number } {
    if (data.length < 2) {
      return { slope: 0, intercept: 0 };
    }

    const n = data.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Moving Average Calculation
   */
  private movingAverage(data: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i < period - 1) {
        result.push(data[i]);
      } else {
        const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        result.push(sum / period);
      }
    }
    return result;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Predict next period value using linear regression
   */
  predictNextValue(historicalData: DataPoint[]): PredictionResult {
    if (historicalData.length < 3) {
      return {
        predictedValue: 0,
        confidence: 0,
        trend: 'stable',
        recommendation: 'Not enough data for prediction. Collect more historical data.'
      };
    }

    const { slope, intercept } = this.linearRegression(historicalData);
    const nextIndex = historicalData.length;
    const predictedValue = slope * nextIndex + intercept;

    // Calculate confidence based on data consistency
    const values = historicalData.map(d => d.value);
    const stdDev = this.standardDeviation(values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const cv = stdDev / avg; // Coefficient of variation
    const confidence = Math.max(0, Math.min(100, 100 - (cv * 100)));

    // Determine trend
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (slope > avg * 0.05) trend = 'increasing';
    else if (slope < -avg * 0.05) trend = 'decreasing';

    // Generate recommendation
    let recommendation = '';
    if (trend === 'increasing') {
      recommendation = `Sales are trending upward. Consider increasing stock by ${Math.round((slope / avg) * 100)}% for next period.`;
    } else if (trend === 'decreasing') {
      recommendation = `Sales are declining. Review marketing strategy and consider promotions to boost sales.`;
    } else {
      recommendation = 'Sales are stable. Maintain current inventory levels.';
    }

    return {
      predictedValue: Math.max(0, predictedValue),
      confidence: Math.round(confidence),
      trend,
      recommendation
    };
  }

  /**
   * Predict inventory reorder point using historical sales data
   */
  predictReorderPoint(salesHistory: number[]): { reorderPoint: number; safetyStock: number } {
    if (salesHistory.length === 0) {
      return { reorderPoint: 0, safetyStock: 0 };
    }

    const avgDailySales = salesHistory.reduce((a, b) => a + b, 0) / salesHistory.length;
    const stdDev = this.standardDeviation(salesHistory);
    
    // Lead time (assume 7 days)
    const leadTime = 7;
    
    // Safety stock = Z-score * stdDev * sqrt(leadTime)
    // Using Z-score of 1.65 for 95% service level
    const safetyStock = Math.ceil(1.65 * stdDev * Math.sqrt(leadTime));
    
    // Reorder point = (Average daily sales * Lead time) + Safety stock
    const reorderPoint = Math.ceil((avgDailySales * leadTime) + safetyStock);

    return { reorderPoint, safetyStock };
  }

  /**
   * Detect anomalies in sales data
   */
  detectAnomalies(data: DataPoint[]): { anomalies: DataPoint[]; threshold: number } {
    if (data.length < 5) {
      return { anomalies: [], threshold: 0 };
    }

    const values = data.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = this.standardDeviation(values);
    
    // Using 2 standard deviations as threshold (95% confidence interval)
    const threshold = 2 * stdDev;
    
    const anomalies = data.filter(point => 
      Math.abs(point.value - avg) > threshold
    );

    return { anomalies, threshold };
  }

  /**
   * Forecast revenue for next N periods
   */
  forecastRevenue(historicalRevenue: DataPoint[], periodsAhead: number = 3): {
    forecasts: Array<{ period: number; value: number; confidence: number }>;
    totalPredicted: number;
  } {
    const forecasts: Array<{ period: number; value: number; confidence: number }> = [];
    let totalPredicted = 0;

    const { slope, intercept } = this.linearRegression(historicalRevenue);
    const values = historicalRevenue.map(d => d.value);
    const stdDev = this.standardDeviation(values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    for (let i = 1; i <= periodsAhead; i++) {
      const nextIndex = historicalRevenue.length + i - 1;
      const predictedValue = Math.max(0, slope * nextIndex + intercept);
      
      // Confidence decreases with distance from known data
      const cv = stdDev / avg;
      const baseConfidence = Math.max(0, Math.min(100, 100 - (cv * 100)));
      const confidence = Math.round(baseConfidence * Math.pow(0.9, i - 1));

      forecasts.push({
        period: i,
        value: Math.round(predictedValue * 100) / 100,
        confidence
      });

      totalPredicted += predictedValue;
    }

    return { forecasts, totalPredicted: Math.round(totalPredicted * 100) / 100 };
  }

  /**
   * Product demand classification (ABC Analysis)
   */
  classifyProducts(products: Array<{ id: string; name: string; revenue: number }>): {
    classA: string[]; // Top 20% - 80% revenue
    classB: string[]; // Next 30% - 15% revenue
    classC: string[]; // Remaining 50% - 5% revenue
  } {
    const sorted = [...products].sort((a, b) => b.revenue - a.revenue);
    const totalRevenue = sorted.reduce((sum, p) => sum + p.revenue, 0);

    let cumulativeRevenue = 0;
    const classA: string[] = [];
    const classB: string[] = [];
    const classC: string[] = [];

    sorted.forEach(product => {
      cumulativeRevenue += product.revenue;
      const percentOfTotal = (cumulativeRevenue / totalRevenue) * 100;

      if (percentOfTotal <= 80) {
        classA.push(product.name);
      } else if (percentOfTotal <= 95) {
        classB.push(product.name);
      } else {
        classC.push(product.name);
      }
    });

    return { classA, classB, classC };
  }

  /**
   * Sentiment analysis for chatbot responses (simple keyword-based)
   */
  analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
    const positiveKeywords = ['good', 'great', 'excellent', 'increase', 'profit', 'growth', 'success'];
    const negativeKeywords = ['bad', 'poor', 'decrease', 'loss', 'decline', 'problem', 'issue'];

    const lowerText = text.toLowerCase();
    let score = 0;

    positiveKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) score += 1;
    });

    negativeKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) score -= 1;
    });

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Generate intelligent chatbot response based on query and comprehensive context
   */
  generateChatbotResponse(query: string, context: {
    // Products & Inventory
    totalProducts?: number;
    lowStockItems?: number;
    outOfStockItems?: number;
    products?: Array<{ name: string; sku: string; quantity: number; price: number; location: string; category: string; minStockLevel: number }>;
    categories?: Array<{ name: string; productCount: number }>;
    
    // Orders
    totalOrders?: number;
    pendingOrders?: number;
    completedOrders?: number;
    recentOrders?: Array<{ id: string; status: string; total: number; date: string }>;
    
    // Financial
    totalRevenue?: number;
    totalExpenses?: number;
    netProfit?: number;
    accountingEntries?: Array<{ type: string; amount: number; description: string }>;
    
    // Settings & Configuration
    branches?: string[];
    currentBranch?: string;
    staffMembers?: Array<{ name: string; branch: string }>;
    companyName?: string;
    currency?: string;
    defaultUnit?: string;
    
    // Transfer History
    transferHistory?: Array<{ type: string; staffName: string; fromBranch: string; toBranch: string; productId: string }>;
  }): string {
    const lowerQuery = query.toLowerCase();

    // ==================== SETTINGS & CONFIGURATION ====================
    if (lowerQuery.includes('shop') || lowerQuery.includes('store') || lowerQuery.includes('company') || lowerQuery.includes('business')) {
      if (lowerQuery.includes('detail') || lowerQuery.includes('name') || lowerQuery.includes('set') || lowerQuery.includes('where') || lowerQuery.includes('configure')) {
        return `You can configure your shop/company details in the **Settings** page. Go to the sidebar menu and click on "Settings". In the **General Settings** section, you can set your Company Name. For customer-facing shop details, scroll down to the **Shop Profile** section where you can set your Shop Name, Description, Logo, Banner, and Contact Email.`;
      }
      return `Your company name is "${context.companyName || 'Not set'}". To update shop details, go to Settings > General Settings for company name, or Settings > Shop Profile for customer-facing information like logo, banner, and description.`;
    }

    // Branch & Warehouse Settings
    if (lowerQuery.includes('branch') || lowerQuery.includes('warehouse') || lowerQuery.includes('location')) {
      if (lowerQuery.includes('add') || lowerQuery.includes('create') || lowerQuery.includes('new') || lowerQuery.includes('set') || lowerQuery.includes('where') || lowerQuery.includes('manage')) {
        return `You can manage branches/warehouses in **Settings** > **Branch Management** section. There you can:\n• Add new branches (click "Add Branch" button)\n• Set your current working branch\n• Delete branches you no longer need\n\nCurrent branches: ${context.branches?.join(', ') || 'Warehouse A'}`;
      }
      return `You have ${context.branches?.length || 1} branch(es): ${context.branches?.join(', ') || 'Warehouse A'}. Current branch: ${context.currentBranch || 'Warehouse A'}. Manage branches in Settings > Branch Management.`;
    }

    // Staff Management
    if (lowerQuery.includes('staff') || lowerQuery.includes('employee') || lowerQuery.includes('pin') || lowerQuery.includes('personnel')) {
      if (lowerQuery.includes('add') || lowerQuery.includes('create') || lowerQuery.includes('where') || lowerQuery.includes('manage')) {
        return `You can manage staff members in **Settings** > **Staff Management** section. There you can:\n• Add new staff with their name and assigned branch\n• Each staff gets a unique 6-digit PIN for product transfers\n• Edit staff branch assignments\n• Regenerate or copy PINs\n• Delete staff members\n\nCurrent staff count: ${context.staffMembers?.length || 0}`;
      }
      return `You have ${context.staffMembers?.length || 0} staff member(s). ${context.staffMembers?.map(s => `${s.name} (${s.branch})`).join(', ') || 'No staff added yet'}. Manage staff in Settings > Staff Management.`;
    }

    // Currency & Units
    if (lowerQuery.includes('currency') || lowerQuery.includes('unit') || lowerQuery.includes('measurement')) {
      return `You can configure currency and measurement units in **Settings** > **Inventory Settings** section:\n• Default Currency: ${context.currency || 'MYR'}\n• Default Unit: ${context.defaultUnit || 'units'}\n• Low Stock Threshold: Sets when to show low stock warnings`;
    }

    // ==================== INVENTORY & PRODUCTS ====================
    if (lowerQuery.includes('stock') || lowerQuery.includes('inventory')) {
      if (lowerQuery.includes('low') || lowerQuery.includes('alert') || lowerQuery.includes('warning')) {
        const lowItems = context.products?.filter(p => p.quantity <= p.minStockLevel) || [];
        if (lowItems.length > 0) {
          return `⚠️ You have ${lowItems.length} low stock item(s):\n${lowItems.slice(0, 5).map(p => `• ${p.name} (${p.quantity} left, min: ${p.minStockLevel})`).join('\n')}${lowItems.length > 5 ? `\n...and ${lowItems.length - 5} more` : ''}\n\nView all in the Products page or Dashboard.`;
        }
        return `✅ Great news! All products are adequately stocked. No low stock alerts at the moment.`;
      }
      if (lowerQuery.includes('out') || lowerQuery.includes('zero')) {
        const outOfStock = context.products?.filter(p => p.quantity === 0) || [];
        return outOfStock.length > 0 
          ? `🚫 ${outOfStock.length} product(s) are out of stock: ${outOfStock.slice(0, 5).map(p => p.name).join(', ')}${outOfStock.length > 5 ? '...' : ''}`
          : `✅ No products are currently out of stock.`;
      }
      return `📦 **Inventory Overview:**\n• Total Products: ${context.totalProducts || 0}\n• Low Stock Items: ${context.lowStockItems || 0}\n• Out of Stock: ${context.outOfStockItems || 0}\n\nView detailed inventory in the Products page. Manage stock levels by editing individual products.`;
    }

    // Product specific queries
    if (lowerQuery.includes('product')) {
      if (lowerQuery.includes('add') || lowerQuery.includes('create') || lowerQuery.includes('new')) {
        return `To add a new product:\n1. Go to **Products** page from the sidebar\n2. Click the **"Add Product"** button\n3. Fill in required fields: Name, SKU, Category, Price, Cost Price, Quantity, Min/Max Stock, Location, and Supplier\n4. Optionally add an image and notes\n5. Click "Create Product"\n\nThe product will be assigned to your current branch by default.`;
      }
      if (lowerQuery.includes('edit') || lowerQuery.includes('update') || lowerQuery.includes('change')) {
        return `To edit a product:\n1. Go to **Products** page\n2. Find the product you want to edit\n3. Click the **Edit** button (pencil icon) on the product card\n4. Update the fields you want to change\n5. Click "Update Product"\n\nNote: Changing the location will be recorded in the Transfer History.`;
      }
      if (lowerQuery.includes('delete') || lowerQuery.includes('remove')) {
        return `To delete a product:\n1. Go to **Products** page\n2. Find the product you want to delete\n3. Click the **Delete** button (trash icon)\n4. Confirm the deletion\n\n⚠️ Warning: This action cannot be undone and will remove all associated data.`;
      }
      return `📦 You have ${context.totalProducts || 0} products. View and manage them in the **Products** page. You can add, edit, delete products, and manage their stock levels there.`;
    }

    // Category queries
    if (lowerQuery.includes('category') || lowerQuery.includes('categories')) {
      if (lowerQuery.includes('add') || lowerQuery.includes('create')) {
        return `To add a category:\n1. Go to **Products** page\n2. Click "Add Product" or "Edit Product"\n3. In the Category dropdown, click **"+ Add Category"**\n4. Enter the category name\n5. Click Add\n\nCategories help organize your products for better management and reporting.`;
      }
      return `📁 You have ${context.categories?.length || 0} categories: ${context.categories?.map(c => `${c.name} (${c.productCount} products)`).join(', ') || 'No categories yet'}`;
    }

    // ==================== TRANSFERS & QR CODES ====================
    if (lowerQuery.includes('transfer') || lowerQuery.includes('move') || lowerQuery.includes('qr') || lowerQuery.includes('scan')) {
      if (lowerQuery.includes('how') || lowerQuery.includes('where')) {
        return `**Product Transfer System:**\n\n1. **Generate QR Code**: Go to **QR Codes** page > find your product > click "Generate QR"\n\n2. **Transfer Product**: Scan the QR code with any device > Click "Transfer" > Enter staff PIN > Select destination branch\n\n3. **Receive Product**: Scan QR code > Click "Receive" > Enter staff PIN > Select receiving branch\n\n4. **View History**: QR Codes page shows all transfer history with timestamps and staff info\n\nNote: Staff PINs are managed in Settings > Staff Management`;
      }
      if (lowerQuery.includes('history')) {
        const transfers = context.transferHistory || [];
        return transfers.length > 0 
          ? `📋 Recent transfers: ${transfers.slice(0, 3).map(t => `${t.type}: ${t.fromBranch} → ${t.toBranch} by ${t.staffName}`).join('; ')}. View full history on the QR Codes page.`
          : `No transfer history yet. Transfers are recorded when products are moved between branches using the QR code system.`;
      }
      return `🔄 Transfer system allows you to track product movement between branches. Use QR codes to transfer/receive products. Staff need a PIN (from Settings) to authorize transfers.`;
    }

    // ==================== ORDERS ====================
    if (lowerQuery.includes('order')) {
      if (lowerQuery.includes('pending') || lowerQuery.includes('status')) {
        return `📋 **Order Status:**\n• Pending Orders: ${context.pendingOrders || 0}\n• Completed Orders: ${context.completedOrders || 0}\n• Total Orders: ${context.totalOrders || 0}\n\nManage orders in the **Orders** page.`;
      }
      if (lowerQuery.includes('create') || lowerQuery.includes('new') || lowerQuery.includes('how')) {
        return `To create an order:\n1. Go to **Orders** page\n2. Click "Create Order" or use the shopping cart\n3. Add products to the order\n4. Set customer details\n5. Process payment if applicable\n6. Complete the order\n\nOrders automatically update inventory quantities.`;
      }
      return `📦 **Orders Overview:**\n• Total: ${context.totalOrders || 0}\n• Pending: ${context.pendingOrders || 0}\n• Completed: ${context.completedOrders || 0}\n\nView and manage orders in the Orders page.`;
    }

    // ==================== ACCOUNTING & FINANCIAL ====================
    if (lowerQuery.includes('accounting') || lowerQuery.includes('finance') || lowerQuery.includes('financial') || lowerQuery.includes('money')) {
      if (lowerQuery.includes('where') || lowerQuery.includes('find') || lowerQuery.includes('see') || lowerQuery.includes('view')) {
        return `You can view financial information in the **Accounting** page:\n• Revenue tracking\n• Expense management\n• Profit/Loss calculations\n• Cash flow analysis\n• Monthly breakdowns\n\nThe Dashboard also shows key financial metrics at a glance.`;
      }
      return `💰 **Financial Summary:**\n• Total Revenue: $${(context.totalRevenue || 0).toLocaleString()}\n• Total Expenses: $${(context.totalExpenses || 0).toLocaleString()}\n• Net Profit: $${(context.netProfit || 0).toLocaleString()}\n\nView detailed reports in the Accounting page.`;
    }

    if (lowerQuery.includes('revenue') || lowerQuery.includes('sales') || lowerQuery.includes('income')) {
      return `💵 **Revenue:** $${(context.totalRevenue || 0).toLocaleString()}\n\nTrack detailed sales and revenue in:\n• **Dashboard** - Quick overview\n• **Reports** - Detailed analytics\n• **Accounting** - Financial breakdown`;
    }

    if (lowerQuery.includes('expense') || lowerQuery.includes('cost') || lowerQuery.includes('spending')) {
      return `💸 **Expenses:** $${(context.totalExpenses || 0).toLocaleString()}\n\nManage expenses in the **Accounting** page. You can add, categorize, and track all business expenses there.`;
    }

    if (lowerQuery.includes('profit') || lowerQuery.includes('margin') || lowerQuery.includes('earning')) {
      return `📈 **Net Profit:** $${(context.netProfit || 0).toLocaleString()}\n\nView profit analysis in the **Accounting** page and **Reports** section. Profit is calculated as Revenue minus Expenses.`;
    }

    // ==================== REPORTS & ANALYTICS ====================
    if (lowerQuery.includes('report') || lowerQuery.includes('analytics') || lowerQuery.includes('insight')) {
      return `📊 **Reports & Analytics:**\n\nAvailable in the **Reports** page:\n• Sales Performance & Trends\n• Inventory Analysis\n• Top Products\n• Category Distribution\n• Revenue Forecasts\n• Stock Predictions\n\nThe Dashboard provides a quick overview of key metrics.`;
    }

    // ==================== PREDICTIONS ====================
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('future')) {
      return `🔮 **Predictions & Forecasts:**\n\nI can help predict:\n• Future sales trends based on historical data\n• Optimal reorder points for inventory\n• Stock-out risks\n• Revenue forecasts\n\nView predictions in the **Reports** page. The AI analyzes your data to provide actionable insights.`;
    }

    // ==================== HELP & CAPABILITIES ====================
    if (lowerQuery.includes('help') || lowerQuery.includes('what can you') || lowerQuery.includes('capabilities') || lowerQuery.includes('what do you know')) {
      return `🤖 **I can help you with:**\n\n**📦 Products & Inventory:**\n• Stock levels, low stock alerts\n• Adding/editing products\n• Category management\n\n**🔄 Transfers:**\n• QR code system\n• Transfer history\n• Branch management\n\n**📋 Orders:**\n• Order status\n• Creating orders\n\n**💰 Accounting:**\n• Revenue & expenses\n• Profit calculations\n• Financial reports\n\n**⚙️ Settings:**\n• Shop/company details\n• Branch & staff management\n• Currency & units\n\n**📊 Reports:**\n• Analytics & insights\n• Sales predictions\n• Forecasts\n\nJust ask me anything about your inventory system!`;
    }

    // ==================== NAVIGATION ====================
    if (lowerQuery.includes('where') || lowerQuery.includes('how to') || lowerQuery.includes('find') || lowerQuery.includes('navigate')) {
      return `🧭 **Navigation Guide:**\n\n• **Dashboard** - Overview & key metrics\n• **Products** - Manage inventory items\n• **Orders** - View & manage orders\n• **QR Codes** - Generate QR codes & view transfers\n• **Reports** - Analytics & insights\n• **Accounting** - Financial management\n• **Settings** - Configure system preferences\n\nWhat specific feature are you looking for?`;
    }

    // Default response
    return `I understand you're asking about "${query}". I can help with:\n• Products & inventory management\n• Orders & sales\n• Accounting & finances\n• Settings & configuration\n• Reports & predictions\n• QR codes & transfers\n\nCould you please be more specific about what you'd like to know?`;
  }
}

export const mlService = new MLService();
