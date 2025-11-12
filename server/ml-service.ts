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
   * Generate intelligent chatbot response based on query and context
   */
  generateChatbotResponse(query: string, context: {
    totalProducts?: number;
    lowStockItems?: number;
    totalRevenue?: number;
    recentSales?: number;
  }): string {
    const lowerQuery = query.toLowerCase();

    // Inventory queries
    if (lowerQuery.includes('stock') || lowerQuery.includes('inventory')) {
      if (context.lowStockItems && context.lowStockItems > 0) {
        return `You currently have ${context.lowStockItems} items with low stock levels. I recommend reviewing these items and placing orders soon to avoid stockouts.`;
      }
      return `Your inventory levels look good! All ${context.totalProducts || 0} products are adequately stocked.`;
    }

    // Sales queries
    if (lowerQuery.includes('sales') || lowerQuery.includes('revenue')) {
      if (context.totalRevenue) {
        return `Your total revenue is $${context.totalRevenue.toLocaleString()}. ${context.recentSales ? `Recent sales show ${context.recentSales > 0 ? 'positive' : 'declining'} trends.` : ''}`;
      }
      return `I can help you track sales performance. Please provide more details about the time period you're interested in.`;
    }

    // Prediction queries
    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast')) {
      return `Based on historical data analysis, I can predict future sales trends, optimal reorder points, and potential stockouts. What specific prediction would you like to see?`;
    }

    // Product queries
    if (lowerQuery.includes('product') || lowerQuery.includes('item')) {
      return `You have ${context.totalProducts || 0} products in your inventory. I can help you analyze product performance, identify top sellers, or recommend optimal stock levels.`;
    }

    // Help queries
    if (lowerQuery.includes('help') || lowerQuery.includes('how')) {
      return `I can assist you with:\n• Inventory management and stock predictions\n• Sales analysis and forecasting\n• Product performance insights\n• Revenue tracking\n• Reorder point recommendations\n\nWhat would you like to know?`;
    }

    // Default response
    return `I understand you're asking about "${query}". I can help with inventory management, sales predictions, and business insights. Could you provide more specific details?`;
  }
}

export const mlService = new MLService();
