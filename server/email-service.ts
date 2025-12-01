import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check if email credentials are configured
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const emailPort = parseInt(process.env.EMAIL_PORT || '587');
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.warn('Email credentials not configured. Email notifications will be disabled.');
      console.warn('Please set EMAIL_USER and EMAIL_PASS environment variables to enable email notifications.');
      return;
    }

    const config: EmailConfig = {
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    };

    this.transporter = nodemailer.createTransport(config);
    console.log('Email service initialized with host:', emailHost);
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not initialized. Cannot send email.');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"Inventory Management System" <${process.env.EMAIL_USER}>`,
        to: options.to,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
      });

      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendLowStockAlert(
    email: string,
    companyName: string,
    lowStockProducts: Array<{ name: string; currentStock: number; lowStockThreshold: number }>
  ): Promise<boolean> {
    const productRows = lowStockProducts
      .map(
        (product) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${product.currentStock}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.lowStockThreshold}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Low Stock Alert</h1>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                The following products in <strong>${companyName}</strong> have fallen below their low stock threshold and need restocking:
              </p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product Name</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Current Stock</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  ${productRows}
                </tbody>
              </table>
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
                Please review your inventory and place orders as needed.
              </p>
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is an automated notification from your Inventory Management System.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `Low Stock Alert\n\nThe following products have fallen below their low stock threshold:\n\n${lowStockProducts
      .map((p) => `${p.name}: ${p.currentStock} (Threshold: ${p.lowStockThreshold})`)
      .join('\n')}\n\nPlease review your inventory and place orders as needed.`;

    return this.sendEmail({
      to: email,
      subject: `⚠️ Low Stock Alert - ${lowStockProducts.length} Product(s) Need Restocking`,
      html,
      text,
    });
  }

  async sendDailyReport(
    email: string,
    companyName: string,
    data: {
      date: string;
      totalSales: number;
      totalOrders: number;
      totalRevenue: number;
      lowStockCount: number;
      topProducts: Array<{ name: string; quantity: number; revenue: number }>;
    }
  ): Promise<boolean> {
    const topProductRows = data.topProducts
      .map(
        (product, index) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">#${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">$${product.revenue.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📊 Daily Business Report</h1>
              <p style="color: #fee2e2; margin: 10px 0 0 0; font-size: 14px;">${data.date}</p>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Here's your daily business summary for <strong>${companyName}</strong>:
              </p>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 25px 0;">
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Total Orders</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.totalOrders}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Items Sold</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.totalSales}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Total Revenue</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${data.totalRevenue.toFixed(2)}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Low Stock Items</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.lowStockCount}</p>
                </div>
              </div>

              ${
                data.topProducts.length > 0
                  ? `
              <h3 style="color: #111827; font-size: 18px; margin: 30px 0 15px 0;">Top Selling Products</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Rank</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Qty Sold</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topProductRows}
                </tbody>
              </table>
              `
                  : ''
              }
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is an automated daily report from your Inventory Management System.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `📊 Daily Business Report - ${data.date}`,
      html,
    });
  }

  async sendWeeklySummary(
    email: string,
    companyName: string,
    data: {
      weekRange: string;
      totalSales: number;
      totalOrders: number;
      totalRevenue: number;
      averageOrderValue: number;
      topProducts: Array<{ name: string; quantity: number; revenue: number }>;
      inventoryStatus: {
        totalProducts: number;
        lowStockCount: number;
        outOfStockCount: number;
      };
    }
  ): Promise<boolean> {
    const topProductRows = data.topProducts
      .map(
        (product, index) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">#${index + 1}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">$${product.revenue.toFixed(2)}</td>
        </tr>
      `
      )
      .join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
            <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📈 Weekly Business Summary</h1>
              <p style="color: #fee2e2; margin: 10px 0 0 0; font-size: 14px;">${data.weekRange}</p>
            </div>
            <div style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
                Hello,
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                Here's your weekly performance summary for <strong>${companyName}</strong>:
              </p>
              
              <h3 style="color: #111827; font-size: 18px; margin: 25px 0 15px 0;">Sales Overview</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Total Orders</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.totalOrders}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #dc2626;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Items Sold</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${data.totalSales}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Total Revenue</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${data.totalRevenue.toFixed(2)}</p>
                </div>
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                  <p style="color: #6b7280; font-size: 12px; margin: 0; text-transform: uppercase;">Avg Order Value</p>
                  <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${data.averageOrderValue.toFixed(2)}</p>
                </div>
              </div>

              <h3 style="color: #111827; font-size: 18px; margin: 25px 0 15px 0;">Inventory Status</h3>
              <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <div style="margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Total Products:</span>
                  <span style="color: #111827; font-size: 14px; font-weight: bold; margin-left: 10px;">${data.inventoryStatus.totalProducts}</span>
                </div>
                <div style="margin-bottom: 10px;">
                  <span style="color: #6b7280; font-size: 14px;">Low Stock Items:</span>
                  <span style="color: #f59e0b; font-size: 14px; font-weight: bold; margin-left: 10px;">${data.inventoryStatus.lowStockCount}</span>
                </div>
                <div>
                  <span style="color: #6b7280; font-size: 14px;">Out of Stock:</span>
                  <span style="color: #dc2626; font-size: 14px; font-weight: bold; margin-left: 10px;">${data.inventoryStatus.outOfStockCount}</span>
                </div>
              </div>

              ${
                data.topProducts.length > 0
                  ? `
              <h3 style="color: #111827; font-size: 18px; margin: 25px 0 15px 0;">Top Selling Products This Week</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Rank</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Qty Sold</th>
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  ${topProductRows}
                </tbody>
              </table>
              `
                  : ''
              }
            </div>
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                This is an automated weekly summary from your Inventory Management System.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `📈 Weekly Business Summary - ${data.weekRange}`,
      html,
    });
  }
}

export const emailService = new EmailService();
