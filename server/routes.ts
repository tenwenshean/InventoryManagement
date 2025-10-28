// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cache } from "./cache";
import { auth, db } from "./db"; // ✅ fixed import
import {
  insertProductSchema,
  insertCategorySchema,
  insertInventoryTransactionSchema,
  insertAccountingEntrySchema,
  insertChatMessageSchema,
} from "@shared/schema";

// ✅ Middleware to check Firebase Auth
async function isAuthenticated(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized - Missing token" });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth error:", error);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
}

// ✅ Add Google Login route
export async function registerRoutes(app: Express): Promise<Server> {
  app.post("/api/auth/login", async (req, res) => {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }

    try {
      // Verify Firebase token
      const decoded = await auth.verifyIdToken(token);
      const { uid, email, name, picture } = decoded;

      // Check if user exists in Firestore
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create new user if not exists
        await userRef.set({
          uid,
          email,
          name: name || "Unnamed User",
          picture: picture || null,
          createdAt: new Date().toISOString(),
        });
      }

      const userData = (await userRef.get()).data();
      res.json({ message: "Login successful", user: userData });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ message: "Invalid or expired token" });
    }
  });

  // ===================== AUTH TEST =====================
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      res.json(user || { uid: req.user.uid, email: req.user.email });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // ===================== CATEGORY ROUTES =====================
  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const categories = await storage.getCategories(req.user.uid);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req: any, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData, req.user.uid);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // ===================== PRODUCT ROUTES =====================
  app.get("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const search = req.query.search as string;
      const products = await storage.getProducts(search, req.user.uid);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Temporary public endpoint to verify server -> Firestore connectivity (no auth)
  app.get("/api/public/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("[public] Error fetching products:", error);
      res.status(500).json({ error: (error as any)?.message || String(error) });
    }
  });

  app.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });

  app.post("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData, req.user.uid, req.user.email);

      // Create accounting entry
      if (productData.costPrice && productData.quantity) {
        const totalValue = parseFloat(productData.costPrice) * productData.quantity;
        await storage.createAccountingEntry({
          accountType: "asset",
          accountName: "Inventory",
          debitAmount: totalValue.toString(),
          creditAmount: "0",
          description: `Inventory addition: ${product.name}`,
        }, req.user.uid);
      }

      // Invalidate accounting cache for this user
      cache.clear(req.user.uid);

      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      
      // Invalidate accounting cache for this user
      cache.clear(req.user.uid);
      
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      
      // Invalidate accounting cache for this user
      cache.clear(req.user.uid);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  // ===================== QR CODE ROUTES =====================
  // Generate or regenerate a unique QR code for a product
  app.post("/api/products/:id/qr", isAuthenticated, async (req, res) => {
    try {
      const productId = req.params.id;
      // First verify the product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Use product id + timestamp to ensure uniqueness; clients render the value into an image
      const uniqueCode = `${productId}:${Date.now()}`;
      await storage.setProductQrCode(productId, uniqueCode);
      
      // Get the updated product to return
      const updatedProduct = await storage.getProduct(productId);
      res.json({ 
        productId, 
        qrCode: uniqueCode,
        product: updatedProduct 
      });
    } catch (error) {
      console.error("Error generating QR:", error);
      res.status(500).json({ 
        message: "Failed to generate QR code",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Resolve a QR code to product details (public, no auth)
  app.get("/api/qr/:code", async (req, res) => {
    try {
      const code = decodeURIComponent(req.params.code);
      const product = await storage.getProductByQrCode(code);
      if (!product) return res.status(404).json({ message: "QR not found" });
      res.json({ product });
    } catch (error) {
      console.error("Error resolving QR:", error);
      res.status(500).json({ message: "Failed to resolve QR" });
    }
  });

  // Confirm sale for a QR code (public, guarded by user confirmation on client)
  app.post("/api/qr/:code/confirm-sale", async (req, res) => {
    try {
      const code = decodeURIComponent(req.params.code);
      const product = await storage.getProductByQrCode(code);
      if (!product) return res.status(404).json({ message: "QR not found" });

      const result = await storage.decrementQuantityAndRecordSale(product.id);
      if (!result) return res.status(404).json({ message: "Product not found" });

      res.json({ success: true, product: result.updated });
    } catch (error) {
      console.error("Error confirming sale via QR:", error);
      res.status(500).json({ message: "Failed to confirm sale" });
    }
  });

  // ===================== DASHBOARD STATS ROUTE =====================
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const products = await storage.getProducts(undefined, req.user.uid);
      const totalProducts = products.length;
      
      // Count low stock items (quantity <= minStockLevel)
      const lowStockItems = products.filter((p: any) => {
        const qty = parseInt(p.quantity) || 0;
        const minStock = parseInt(p.minStockLevel) || 0;
        return qty <= minStock && minStock > 0;
      }).length;
      
      // Calculate total value (price * quantity)
      const totalValue = products.reduce((sum, p: any) => {
        const price = parseFloat(p.price) || 0;
        const quantity = parseInt(p.quantity) || 0;
        return sum + (price * quantity);
      }, 0);
      
      const stats = {
        totalProducts,
        lowStockItems,
        totalValue: `$${totalValue.toFixed(2)}`,
        ordersToday: 0
      };
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ 
        message: "Failed to fetch dashboard stats",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===================== REPORTS ROUTE =====================
  app.get("/api/reports/data", isAuthenticated, async (_req, res) => {
    try {
      // Basic reports derived from existing collections
      const products = await storage.getProducts();
      const categories = await storage.getCategories();
      const transactions = await storage.getInventoryTransactions();

      const unitsSold = transactions
        .filter((t) => (t as any).type === "out")
        .reduce((sum, t: any) => sum + (t.quantity || 0), 0);

      // Approximate revenue using product price * quantity for 'out' transactions
      const productById = new Map(products.map((p: any) => [p.id, p]));
      const totalRevenueNumber = transactions
        .filter((t: any) => t.type === "out")
        .reduce((sum, t: any) => {
          const product = productById.get(t.productId);
          const price = product ? parseFloat((product.price as any) ?? 0) : 0;
          return sum + price * (t.quantity || 0);
        }, 0);

      const keyMetrics = {
        totalRevenue: `$${totalRevenueNumber.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        unitsSold,
        avgOrderValue: unitsSold > 0 ? `$${(totalRevenueNumber / unitsSold).toFixed(2)}` : "$0",
        returnRate: "0%", // Returns not tracked separately in current model
      };

      // Group transactions by month for charts
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const byMonth: Record<string, { sales: number; returns: number; inStock: number; outStock: number }> = {};
      for (const tx of transactions as any[]) {
        const created = (tx.createdAt as any)?.toDate?.() || tx.createdAt || new Date();
        const key = monthKey(new Date(created));
        byMonth[key] ||= { sales: 0, returns: 0, inStock: 0, outStock: 0 };
        if (tx.type === "in") byMonth[key].inStock += tx.quantity || 0;
        if (tx.type === "out") {
          byMonth[key].outStock += tx.quantity || 0;
          byMonth[key].sales += tx.quantity || 0;
        }
      }
      const sortedMonths = Object.keys(byMonth).sort();
      const salesData = sortedMonths.map((m) => ({ month: m, sales: byMonth[m].sales, returns: byMonth[m].returns }));
      const inventoryTrends = sortedMonths.map((m) => ({ month: m, inStock: byMonth[m].inStock, outStock: byMonth[m].outStock }));

      // Category distribution by summing quantities of products per category
      const categoryIdToName = new Map(categories.map((c: any) => [c.id, c.name]));
      const categoryTotals: Record<string, number> = {};
      for (const p of products as any[]) {
        const name = categoryIdToName.get(p.categoryId) || "Uncategorized";
        categoryTotals[name] = (categoryTotals[name] || 0) + (p.quantity || 0);
      }
      const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

      // Top products by current quantity sold (approx via transactions)
      const soldByProduct: Record<string, number> = {};
      for (const tx of transactions as any[]) {
        if (tx.type === "out") {
          soldByProduct[tx.productId] = (soldByProduct[tx.productId] || 0) + (tx.quantity || 0);
        }
      }
      const topProducts = Object.entries(soldByProduct)
        .map(([productId, sales]) => ({
          name: (productById.get(productId)?.name as string) || "Unknown",
          sales,
          change: 0,
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      res.json({ keyMetrics, salesData, inventoryTrends, categoryData, topProducts });
    } catch (error) {
      console.error("Error building reports data:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // ===================== ACCOUNTING ROUTES =====================
  // Return raw accounting entries
  app.get("/api/accounting/entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const cacheKey = `accounting:entries:${userId}`;
      
      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        res.set('Cache-Control', 'private, max-age=300');
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      const entries = await storage.getAccountingEntries(userId);
      
      // Serialize dates properly
      const serializedEntries = entries.map(entry => ({
        ...entry,
        createdAt: entry.createdAt instanceof Date 
          ? entry.createdAt.toISOString() 
          : (entry.createdAt as any)?.toDate?.()?.toISOString() || entry.createdAt,
      }));
      
      // Cache the result for 5 minutes
      cache.set(cacheKey, serializedEntries, 300000);
      
      // Add cache headers for better performance
      res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
      res.set('X-Cache', 'MISS');
      res.json(serializedEntries);
    } catch (error) {
      console.error("Error fetching accounting entries:", error);
      res.status(500).json({ message: "Failed to fetch accounting entries" });
    }
  });

  // Create new accounting entry
  app.post("/api/accounting/entries", isAuthenticated, async (req: any, res) => {
    try {
      const entryData = insertAccountingEntrySchema.parse(req.body);
      const entry = await storage.createAccountingEntry(entryData, req.user.uid);
      
      // Invalidate cache
      cache.clear(req.user.uid);
      
      // Serialize dates properly
      const serializedEntry = {
        ...entry,
        createdAt: entry.createdAt instanceof Date 
          ? entry.createdAt.toISOString() 
          : (entry.createdAt as any)?.toDate?.()?.toISOString() || entry.createdAt,
      };
      
      res.status(201).json(serializedEntry);
    } catch (error) {
      console.error("Error creating accounting entry:", error);
      res.status(400).json({ message: "Failed to create accounting entry" });
    }
  });

  // Get sales summary for a specific month
  app.get("/api/accounting/sales-summary", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const month = req.query.month as string; // Format: YYYY-MM
      
      if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
      }

      const cacheKey = `sales:summary:${userId}:${month}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }

      // Get user's products
      const products = await storage.getProducts(undefined, userId);
      if (products.length === 0) {
        return res.json({ totalRevenue: 0, totalCOGS: 0, unitsSold: 0, grossProfit: 0 });
      }

      // Get transactions for the month
      const productIds = products.map((p: any) => p.id);
      const allTransactions = await storage.getInventoryTransactionsByProducts(productIds);
      
      // Filter by month
      const startDate = new Date(month + "-01");
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59);
      
      const monthTransactions = allTransactions.filter((tx: any) => {
        const txDate = tx.createdAt?.toDate?.() || new Date(tx.createdAt);
        return txDate >= startDate && txDate <= endDate && tx.type === "out";
      });

      // Calculate summary
      let totalRevenue = 0;
      let totalCOGS = 0;
      let unitsSold = 0;

      const productById = new Map(products.map((p: any) => [p.id, p]));

      for (const tx of monthTransactions as any[]) {
        const product = productById.get(tx.productId);
        const unitPrice = tx.unitPrice ? parseFloat(tx.unitPrice) : (product ? parseFloat(product.price || 0) : 0);
        const costPrice = product?.costPrice ? parseFloat(product.costPrice) : 0;
        const qty = tx.quantity || 0;

        totalRevenue += unitPrice * qty;
        totalCOGS += costPrice * qty;
        unitsSold += qty;
      }

      const summary = {
        totalRevenue,
        totalCOGS,
        unitsSold,
        grossProfit: totalRevenue - totalCOGS,
      };

      cache.set(cacheKey, summary, 300000);
      res.set('X-Cache', 'MISS');
      res.json(summary);
    } catch (error) {
      console.error("Error fetching sales summary:", error);
      res.status(500).json({ message: "Failed to fetch sales summary" });
    }
  });

  // Compute a balance-sheet style report (inventory unsold, sold summary, totals)
  app.get("/api/accounting/report", isAuthenticated, async (req: any, res) => {
    const startTime = Date.now();
    try {
      const userId = req.user.uid;
      const cacheKey = `accounting:report:${userId}`;
      
      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE HIT] Accounting report served from cache in ${Date.now() - startTime}ms`);
        res.set('Cache-Control', 'private, max-age=300');
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      console.log(`[CACHE MISS] Generating accounting report for user ${userId}`);
      
      // Fetch only user's products first
      const t1 = Date.now();
      const products = await storage.getProducts(undefined, userId);
      console.log(`  → Fetched ${products.length} products in ${Date.now() - t1}ms`);

      // Early return if no products
      if (products.length === 0) {
        return res.json({
          inventorySummary: [],
          soldSummary: [],
          totals: {
            totalInventoryValue: 0,
            totalRevenue: 0,
            totalCOGS: 0,
            grossProfit: 0,
          },
        });
      }

      // Get product IDs and fetch only relevant transactions
      const userProductIds = products.map((p: any) => p.id);
      const t2 = Date.now();
      const transactions = await storage.getInventoryTransactionsByProducts(userProductIds);
      console.log(`  → Fetched ${transactions.length} transactions in ${Date.now() - t2}ms`);

      // Map product id -> product
      const productById = new Map(products.map((p: any) => [p.id, p]));

      // Sold summary: aggregate 'out' transactions by product
      const soldByProduct: Record<string, { soldQuantity: number; revenue: number; cogs: number }> = {};
      for (const tx of transactions as any[]) {
        if (tx.type !== "out") continue;
        const pid = tx.productId;
        
        const product = productById.get(pid) || null;
        const unitPrice = tx.unitPrice ? parseFloat(tx.unitPrice as any) : (product ? parseFloat(product.price as any || 0) : 0);
        const qty = tx.quantity || 0;
        const cost = product && product.costPrice ? parseFloat(product.costPrice as any) : 0;

        soldByProduct[pid] ||= { soldQuantity: 0, revenue: 0, cogs: 0 };
        soldByProduct[pid].soldQuantity += qty;
        soldByProduct[pid].revenue += unitPrice * qty;
        soldByProduct[pid].cogs += cost * qty;
      }

      const soldSummary = Object.entries(soldByProduct).map(([pid, s]) => ({
        productId: pid,
        name: (productById.get(pid)?.name as string) || "Unknown",
        sku: (productById.get(pid)?.sku as string) || "",
        soldQuantity: s.soldQuantity,
        revenue: s.revenue,
        cogs: s.cogs,
      }));

      // Inventory (unsold) summary using current product quantity
      const inventorySummary = products.map((p: any) => {
        const qty = p.quantity || 0;
        const cost = p.costPrice ? parseFloat(p.costPrice as any) : 0;
        return {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          quantity: qty,
          costPrice: cost,
          inventoryValue: qty * cost,
        };
      });

      const totalInventoryValue = inventorySummary.reduce((sum: number, i: any) => sum + (i.inventoryValue || 0), 0);
      const totalRevenue = soldSummary.reduce((sum: number, s: any) => sum + (s.revenue || 0), 0);
      const totalCOGS = soldSummary.reduce((sum: number, s: any) => sum + (s.cogs || 0), 0);
      const grossProfit = totalRevenue - totalCOGS;

      const reportData = {
        inventorySummary,
        soldSummary,
        totals: {
          totalInventoryValue,
          totalRevenue,
          totalCOGS,
          grossProfit,
        },
      };

      // Cache the result for 5 minutes
      cache.set(cacheKey, reportData, 300000);
      
      console.log(`[ACCOUNTING REPORT] Generated in ${Date.now() - startTime}ms (cached for 5min)`);
      
      // Add cache headers for better performance
      res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
      res.set('X-Cache', 'MISS');
      res.json(reportData);
    } catch (error) {
      console.error("Error building accounting report:", error);
      res.status(500).json({ message: "Failed to build accounting report" });
    }
  });

  // ===================== REMAINING ROUTES (inventory, accounting, chat, report) =====================
  // ⬆ keep your existing code unchanged below this point

  const httpServer = createServer(app);
  return httpServer;
}

// ===================== SIMPLE AI RESPONSE =====================
function generateAIResponse(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("stock")) return "You can check stock or low-stock alerts.";
  if (lower.includes("product")) return "I can help manage products and QR codes.";
  if (lower.includes("report")) return "I can generate sales or accounting reports.";
  return "I'm your inventory assistant — ask me about stock, products, or reports!";
}
