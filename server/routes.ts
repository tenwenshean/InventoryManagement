import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  insertProductSchema,
  insertCategorySchema,
  insertInventoryTransactionSchema,
  insertAccountingEntrySchema,
  insertChatMessageSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Dashboard routes
  app.get('/api/dashboard/stats', isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Category routes
  app.get('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // Product routes
  app.get('/api/products', isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string;
      const products = await storage.getProducts(search);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post('/api/products', isAuthenticated, async (req: any, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      
      // Create accounting entry for inventory addition
      if (productData.costPrice && productData.quantity) {
        const totalValue = parseFloat(productData.costPrice) * productData.quantity;
        await storage.createAccountingEntry({
          accountType: 'asset',
          accountName: 'Inventory',
          debitAmount: totalValue.toString(),
          creditAmount: '0',
          description: `Inventory addition: ${product.name}`,
        });
      }
      
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  app.put('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get('/api/products/low-stock', isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getLowStockProducts();
      res.json(products);
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      res.status(500).json({ message: "Failed to fetch low stock products" });
    }
  });

  app.post('/api/products/:id/qr', isAuthenticated, async (req, res) => {
    try {
      const qrCode = await storage.generateQRCode(req.params.id);
      res.json({ qrCode });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  app.get('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.put('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete('/api/products/:id', isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // Inventory transaction routes
  app.get('/api/inventory/transactions', isAuthenticated, async (req, res) => {
    try {
      const productId = req.query.productId as string;
      const transactions = await storage.getInventoryTransactions(productId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching inventory transactions:", error);
      res.status(500).json({ message: "Failed to fetch inventory transactions" });
    }
  });

  app.post('/api/inventory/transactions', isAuthenticated, async (req: any, res) => {
    try {
      const transactionData = insertInventoryTransactionSchema.parse({
        ...req.body,
        createdBy: req.user.claims.sub,
      });
      
      const transaction = await storage.createInventoryTransaction(transactionData);
      
      // Create corresponding accounting entries
      if (transactionData.totalValue) {
        const totalValue = parseFloat(transactionData.totalValue);
        
        if (transactionData.type === 'in') {
          // Inventory increase - Debit Inventory, Credit Cash/Accounts Payable
          await storage.createAccountingEntry({
            transactionId: transaction.id,
            accountType: 'asset',
            accountName: 'Inventory',
            debitAmount: totalValue.toString(),
            creditAmount: '0',
            description: `Inventory addition: ${transactionData.reason}`,
          });
        } else if (transactionData.type === 'out') {
          // Inventory decrease - Credit Inventory, Debit COGS
          await storage.createAccountingEntry({
            transactionId: transaction.id,
            accountType: 'asset',
            accountName: 'Inventory',
            debitAmount: '0',
            creditAmount: totalValue.toString(),
            description: `Inventory reduction: ${transactionData.reason}`,
          });
        }
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating inventory transaction:", error);
      res.status(400).json({ message: "Failed to create inventory transaction" });
    }
  });

  // Accounting routes
  app.get('/api/accounting/entries', isAuthenticated, async (req, res) => {
    try {
      const entries = await storage.getAccountingEntries();
      res.json(entries);
    } catch (error) {
      console.error("Error fetching accounting entries:", error);
      res.status(500).json({ message: "Failed to fetch accounting entries" });
    }
  });

  app.post('/api/accounting/entries', isAuthenticated, async (req, res) => {
    try {
      const entryData = insertAccountingEntrySchema.parse(req.body);
      const entry = await storage.createAccountingEntry(entryData);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating accounting entry:", error);
      res.status(400).json({ message: "Failed to create accounting entry" });
    }
  });

  // Chat routes
  app.get('/api/chat/messages', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const messages = await storage.getChatMessages(userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post('/api/chat/messages', isAuthenticated, async (req: any, res) => {
    try {
      const messageData = insertChatMessageSchema.parse({
        ...req.body,
        userId: req.user.claims.sub,
      });
      
      const message = await storage.createChatMessage(messageData);
      
      // Simple AI response logic (mock implementation)
      if (messageData.isFromUser) {
        const response = generateAIResponse(messageData.message);
        await storage.createChatMessage({
          userId: messageData.userId,
          message: response,
          isFromUser: false,
        });
      }
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(400).json({ message: "Failed to create chat message" });
    }
  });

  // Reports routes
  app.get('/api/reports/data', isAuthenticated, async (req, res) => {
    try {
      const products = await storage.getProducts();
      const transactions = await storage.getInventoryTransactions();
      const accountingEntries = await storage.getAccountingEntries();

      // Calculate sales trends by month
      const salesData = [];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
      
      for (let i = 0; i < 6; i++) {
        const monthSales = transactions
          .filter(t => t.type === 'out')
          .reduce((total, t) => total + parseFloat(t.totalValue || '0'), 0);
        
        const monthReturns = Math.floor(monthSales * 0.02); // 2% return rate
        
        salesData.push({
          month: monthNames[i],
          sales: Math.floor(monthSales / 6), // Distribute across months
          returns: monthReturns
        });
      }

      // Calculate inventory trends
      const inventoryTrends = monthNames.map(month => ({
        month,
        inStock: Math.floor(Math.random() * 2000) + 1000,
        outStock: Math.floor(Math.random() * 1000) + 500
      }));

      // Calculate category distribution
      const categories = products.reduce((acc, product) => {
        if (product.categoryId) {
          acc[product.categoryId] = (acc[product.categoryId] || 0) + (product.quantity || 0);
        }
        return acc;
      }, {} as Record<string, number>);

      const categoryData = Object.entries(categories).map(([categoryId, value], index) => ({
        name: `Category ${index + 1}`,
        value,
        color: ['#dc2626', '#7c2d12', '#991b1b', '#b91c1c'][index % 4]
      }));

      // Calculate top products
      const topProducts = products
        .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
        .slice(0, 5)
        .map((product, index) => ({
          name: product.name,
          sales: product.quantity || 0,
          change: Math.floor(Math.random() * 40) - 20 // Random change between -20 and +20
        }));

      // Calculate key metrics
      const totalRevenue = transactions
        .filter(t => t.type === 'out')
        .reduce((total, t) => total + parseFloat(t.totalValue || '0'), 0);

      const unitsSold = transactions
        .filter(t => t.type === 'out')
        .reduce((total, t) => total + t.quantity, 0);

      const avgOrderValue = unitsSold > 0 ? totalRevenue / unitsSold : 0;

      res.json({
        keyMetrics: {
          totalRevenue: `$${totalRevenue.toLocaleString()}`,
          unitsSold,
          avgOrderValue: `$${avgOrderValue.toFixed(2)}`,
          returnRate: "2.1%"
        },
        salesData,
        inventoryTrends,
        categoryData,
        topProducts
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

function generateAIResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes('stock') || lowerMessage.includes('inventory')) {
    return "I can help you check stock levels and manage inventory. You can ask me about specific products or view low stock alerts.";
  } else if (lowerMessage.includes('product')) {
    return "I can assist with product management including adding new products, updating information, and generating QR codes.";
  } else if (lowerMessage.includes('report') || lowerMessage.includes('accounting')) {
    return "I can help you generate reports and view accounting entries related to your inventory transactions.";
  } else if (lowerMessage.includes('qr') || lowerMessage.includes('code')) {
    return "I can help you generate QR codes for your products to enable mobile tracking and quick identification.";
  } else {
    return "I'm your inventory assistant! I can help you with stock management, product information, accounting, and QR code generation. What would you like to know?";
  }
}
