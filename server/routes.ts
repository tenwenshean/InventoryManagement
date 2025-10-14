// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  app.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });

  // ===================== PRODUCT ROUTES =====================
  app.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search as string;
      const products = await storage.getProducts(search);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
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
      const product = await storage.createProduct(productData);

      // Create accounting entry
      if (productData.costPrice && productData.quantity) {
        const totalValue = parseFloat(productData.costPrice) * productData.quantity;
        await storage.createAccountingEntry({
          accountType: "asset",
          accountName: "Inventory",
          debitAmount: totalValue.toString(),
          creditAmount: "0",
          description: `Inventory addition: ${product.name}`,
        });
      }

      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
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
