import * as cron from 'node-cron';
import { db } from './db';
import { emailService } from './email-service';

class ScheduledTaskService {
  private dailyReportTask: cron.ScheduledTask | null = null;
  private weeklyReportTask: cron.ScheduledTask | null = null;
  private lowStockCheckTask: cron.ScheduledTask | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    console.log('Initializing scheduled tasks...');

    // Daily report - runs every day at 9:00 AM
    this.dailyReportTask = cron.schedule('0 9 * * *', async () => {
      console.log('Running daily report task...');
      await this.sendDailyReports();
    });

    // Weekly summary - runs every Monday at 9:00 AM
    this.weeklyReportTask = cron.schedule('0 9 * * 1', async () => {
      console.log('Running weekly summary task...');
      await this.sendWeeklySummaries();
    });

    // Low stock check - runs every hour
    this.lowStockCheckTask = cron.schedule('0 * * * *', async () => {
      console.log('Running low stock check task...');
      await this.checkLowStock();
    });

    console.log('Scheduled tasks initialized:');
    console.log('- Daily reports: Every day at 9:00 AM');
    console.log('- Weekly summaries: Every Monday at 9:00 AM');
    console.log('- Low stock alerts: Every hour');
  }

  private async sendDailyReports() {
    try {
      // Get all users with email notifications enabled
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          const user = userDoc.data();
          const settings = user.settings || {};
          
          if (!settings.emailDailyReports) {
            continue;
          }

          const notificationEmail = settings.notificationEmail || user.email;
          if (!notificationEmail) {
            continue;
          }

          // Calculate yesterday's date range
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(0, 0, 0, 0);
          
          const todayStart = new Date(today);
          todayStart.setHours(0, 0, 0, 0);

          // Get yesterday's orders
          const ordersSnapshot = await db
            .collection('orders')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', yesterday)
            .where('createdAt', '<', todayStart)
            .get();

          // Calculate metrics
          let totalRevenue = 0;
          let totalSales = 0;
          const productSales: Record<string, { quantity: number; revenue: number; name: string }> = {};

          for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            totalRevenue += parseFloat(order.totalPrice || '0');

            // Get order items
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                totalSales += item.quantity || 0;
                
                const productId = item.productId || item.id;
                if (!productSales[productId]) {
                  productSales[productId] = {
                    quantity: 0,
                    revenue: 0,
                    name: item.productName || item.name || 'Unknown Product',
                  };
                }
                
                productSales[productId].quantity += item.quantity || 0;
                productSales[productId].revenue += parseFloat(item.price || '0') * (item.quantity || 0);
              }
            }
          }

          // Get top 5 products
          const topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

          // Get low stock count
          const productsSnapshot = await db
            .collection('products')
            .where('userId', '==', user.uid)
            .get();

          let lowStockCount = 0;
          for (const productDoc of productsSnapshot.docs) {
            const product = productDoc.data();
            const threshold = product.lowStockThreshold || settings.defaultLowStock || 10;
            if ((product.quantity || 0) <= threshold) {
              lowStockCount++;
            }
          }

          const companyName = settings.companyName || 'Your Company';
          const dateString = yesterday.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });

          await emailService.sendDailyReport(notificationEmail, companyName, {
            date: dateString,
            totalSales,
            totalOrders: ordersSnapshot.size,
            totalRevenue,
            lowStockCount,
            topProducts,
          });

          console.log(`Daily report sent to ${notificationEmail} for user ${user.uid}`);
        } catch (error) {
          console.error(`Error sending daily report for user ${userDoc.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendDailyReports:', error);
    }
  }

  private async sendWeeklySummaries() {
    try {
      // Get all users with email notifications enabled
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          const user = userDoc.data();
          const settings = user.settings || {};
          
          if (!settings.emailWeeklySummary) {
            continue;
          }

          const notificationEmail = settings.notificationEmail || user.email;
          if (!notificationEmail) {
            continue;
          }

          // Calculate last week's date range
          const today = new Date();
          const lastWeekEnd = new Date(today);
          lastWeekEnd.setDate(lastWeekEnd.getDate() - (today.getDay() || 7)); // Last Sunday
          lastWeekEnd.setHours(0, 0, 0, 0);

          const lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setDate(lastWeekStart.getDate() - 7); // Previous Monday

          // Get last week's orders
          const ordersSnapshot = await db
            .collection('orders')
            .where('userId', '==', user.uid)
            .where('createdAt', '>=', lastWeekStart)
            .where('createdAt', '<', lastWeekEnd)
            .get();

          // Calculate metrics
          let totalRevenue = 0;
          let totalSales = 0;
          const productSales: Record<string, { quantity: number; revenue: number; name: string }> = {};

          for (const orderDoc of ordersSnapshot.docs) {
            const order = orderDoc.data();
            totalRevenue += parseFloat(order.totalPrice || '0');

            // Get order items
            if (order.items && Array.isArray(order.items)) {
              for (const item of order.items) {
                totalSales += item.quantity || 0;
                
                const productId = item.productId || item.id;
                if (!productSales[productId]) {
                  productSales[productId] = {
                    quantity: 0,
                    revenue: 0,
                    name: item.productName || item.name || 'Unknown Product',
                  };
                }
                
                productSales[productId].quantity += item.quantity || 0;
                productSales[productId].revenue += parseFloat(item.price || '0') * (item.quantity || 0);
              }
            }
          }

          // Get top 10 products
          const topProducts = Object.values(productSales)
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 10);

          // Get inventory status
          const productsSnapshot = await db
            .collection('products')
            .where('userId', '==', user.uid)
            .get();

          const totalProducts = productsSnapshot.size;
          let lowStockCount = 0;
          let outOfStockCount = 0;

          for (const productDoc of productsSnapshot.docs) {
            const product = productDoc.data();
            const quantity = product.quantity || 0;
            const threshold = product.lowStockThreshold || settings.defaultLowStock || 10;
            
            if (quantity === 0) {
              outOfStockCount++;
            } else if (quantity <= threshold) {
              lowStockCount++;
            }
          }

          const companyName = settings.companyName || 'Your Company';
          const weekRange = `${lastWeekStart.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })} - ${lastWeekEnd.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}`;

          const averageOrderValue = ordersSnapshot.size > 0 ? totalRevenue / ordersSnapshot.size : 0;

          await emailService.sendWeeklySummary(notificationEmail, companyName, {
            weekRange,
            totalSales,
            totalOrders: ordersSnapshot.size,
            totalRevenue,
            averageOrderValue,
            topProducts,
            inventoryStatus: {
              totalProducts,
              lowStockCount,
              outOfStockCount,
            },
          });

          console.log(`Weekly summary sent to ${notificationEmail} for user ${user.uid}`);
        } catch (error) {
          console.error(`Error sending weekly summary for user ${userDoc.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in sendWeeklySummaries:', error);
    }
  }

  private async checkLowStock() {
    try {
      // Get all users with low stock alerts enabled
      const usersSnapshot = await db.collection('users').get();

      for (const userDoc of usersSnapshot.docs) {
        try {
          const user = userDoc.data();
          const settings = user.settings || {};
          
          if (!settings.emailLowStock) {
            continue;
          }

          const notificationEmail = settings.notificationEmail || user.email;
          if (!notificationEmail) {
            continue;
          }

          // Get all products for this user
          const productsSnapshot = await db
            .collection('products')
            .where('userId', '==', user.uid)
            .get();

          // Find low stock products
          const lowStockProducts: Array<{ name: string; currentStock: number; lowStockThreshold: number }> = [];
          
          for (const productDoc of productsSnapshot.docs) {
            const product = productDoc.data();
            const threshold = product.lowStockThreshold || settings.defaultLowStock || 10;
            const quantity = product.quantity || 0;
            
            if (quantity > 0 && quantity <= threshold) {
              lowStockProducts.push({
                name: product.name || 'Unnamed Product',
                currentStock: quantity,
                lowStockThreshold: threshold,
              });
            }
          }

          if (lowStockProducts.length === 0) {
            continue;
          }

          // Check if we've already sent an alert recently (within last 24 hours)
          const lastAlertKey = `lowStockAlert_${user.uid}`;
          const lastAlert = (global as any)[lastAlertKey];
          const now = Date.now();

          if (lastAlert && now - lastAlert < 24 * 60 * 60 * 1000) {
            // Already sent an alert in the last 24 hours
            continue;
          }

          const companyName = settings.companyName || 'Your Company';

          await emailService.sendLowStockAlert(
            notificationEmail,
            companyName,
            lowStockProducts
          );

          // Store the last alert time
          (global as any)[lastAlertKey] = now;

          console.log(`Low stock alert sent to ${notificationEmail} for user ${user.uid} - ${lowStockProducts.length} products`);
        } catch (error) {
          console.error(`Error checking low stock for user ${userDoc.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in checkLowStock:', error);
    }
  }

  public stop() {
    if (this.dailyReportTask) {
      this.dailyReportTask.stop();
    }
    if (this.weeklyReportTask) {
      this.weeklyReportTask.stop();
    }
    if (this.lowStockCheckTask) {
      this.lowStockCheckTask.stop();
    }
    console.log('Scheduled tasks stopped');
  }
}

export const scheduledTaskService = new ScheduledTaskService();
