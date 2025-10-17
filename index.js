// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/db.ts
import admin from "firebase-admin";
import fs from "fs";
var serviceAccount = JSON.parse(
  fs.readFileSync("firebase-key.json", "utf8")
);
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
var db = admin.firestore();
var auth = admin.auth();
console.log("\u2705 Connected to Firebase Firestore successfully.");

// server/storage.ts
var DatabaseStorage = class {
  // ===============================
  // USERS
  // ===============================
  async getUser(id) {
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data();
    data.id = doc.id;
    return data;
  }
  async upsertUser(id, data) {
    const userRef = db.collection("users").doc(id);
    const existing = await userRef.get();
    const newData = {
      ...data,
      updatedAt: /* @__PURE__ */ new Date(),
      createdAt: existing.exists ? existing.data()?.createdAt : /* @__PURE__ */ new Date()
    };
    await userRef.set(newData, { merge: true });
    const updated = await userRef.get();
    const u = updated.data();
    u.id = id;
    return u;
  }
  // ===============================
  // CATEGORIES
  // ===============================
  async getCategories() {
    const snapshot = await db.collection("categories").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      d.id = doc.id;
      return d;
    });
  }
  async addCategory(data) {
    const ref = db.collection("categories").doc();
    const newData = { ...data, id: ref.id, createdAt: /* @__PURE__ */ new Date() };
    await ref.set(newData);
    return newData;
  }
  // Backwards-compatible alias used by routes
  async createCategory(data) {
    return this.addCategory(data);
  }
  async deleteCategory(id) {
    await db.collection("categories").doc(id).delete();
  }
  // ===============================
  // PRODUCTS
  // ===============================
  // Wrapper to support optional search parameter expected by routes
  async getProducts(search) {
    return this.getProductsBySearch(search);
  }
  // Support optional search parameter
  async getProductsBySearch(search) {
    let query = db.collection("products").orderBy("createdAt", "desc");
    if (search) {
      const snapshot2 = await query.get();
      const all = snapshot2.docs.map((d) => {
        const dd = d.data();
        dd.id = d.id;
        return dd;
      });
      const s = search.toLowerCase();
      return all.filter((p) => (p.name ?? "").toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      d.id = doc.id;
      return d;
    });
  }
  async addProduct(data) {
    const ref = db.collection("products").doc();
    const newProduct = {
      ...data,
      id: ref.id,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date(),
      isActive: data.isActive ?? true,
      quantity: data.quantity ?? 0
    };
    await ref.set(newProduct);
    return newProduct;
  }
  // Backwards-compatible alias used by routes
  async createProduct(data) {
    return this.addProduct(data);
  }
  async getProduct(id) {
    const doc = await db.collection("products").doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data();
    d.id = doc.id;
    return d;
  }
  async updateProduct(id, data) {
    await db.collection("products").doc(id).update({
      ...data,
      updatedAt: /* @__PURE__ */ new Date()
    });
  }
  async setProductQrCode(id, qrCode) {
    const ref = db.collection("products").doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("PRODUCT_NOT_FOUND");
    await ref.set({ qrCode, updatedAt: /* @__PURE__ */ new Date() }, { merge: true });
  }
  async getProductByQrCode(qrCode) {
    const snap = await db.collection("products").where("qrCode", "==", qrCode).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data();
    d.id = doc.id;
    return d;
  }
  async decrementQuantityAndRecordSale(productId) {
    const ref = db.collection("products").doc(productId);
    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const data = doc.data();
      const currentQty = data.quantity ?? 0;
      const newQty = Math.max(0, currentQty - 1);
      tx.update(ref, { quantity: newQty, updatedAt: /* @__PURE__ */ new Date() });
      const txRef = db.collection("inventoryTransactions").doc();
      tx.set(txRef, {
        id: txRef.id,
        productId,
        type: "out",
        quantity: 1,
        previousQuantity: currentQty,
        newQuantity: newQty,
        unitPrice: data.price ?? null,
        totalValue: data.price ? String(parseFloat(data.price) * 1) : null,
        reason: "QR sale",
        reference: `qr:${data.qrCode ?? "unknown"}`,
        createdBy: null,
        createdAt: /* @__PURE__ */ new Date()
      });
      return { updated: { ...data, id: productId, quantity: newQty } };
    });
  }
  async deleteProduct(id) {
    await db.collection("products").doc(id).delete();
  }
  // ===============================
  // INVENTORY TRANSACTIONS
  // ===============================
  async getInventoryTransactions(productId) {
    let query = db.collection("inventoryTransactions");
    if (productId) {
      query = query.where("productId", "==", productId);
    }
    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      d.id = doc.id;
      return d;
    });
  }
  async addInventoryTransaction(data) {
    const ref = db.collection("inventoryTransactions").doc();
    const newTx = {
      ...data,
      id: ref.id,
      createdAt: /* @__PURE__ */ new Date()
    };
    await ref.set(newTx);
    return newTx;
  }
  // Backwards-compatible alias
  async createInventoryTransaction(data) {
    return this.addInventoryTransaction(data);
  }
  // ===============================
  // ACCOUNTING ENTRIES
  // ===============================
  async getAccountingEntries() {
    const snapshot = await db.collection("accountingEntries").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      d.id = doc.id;
      return d;
    });
  }
  async addAccountingEntry(data) {
    const ref = db.collection("accountingEntries").doc();
    const newEntry = {
      ...data,
      id: ref.id,
      createdAt: /* @__PURE__ */ new Date()
    };
    await ref.set(newEntry);
    return newEntry;
  }
  // Backwards-compatible alias
  async createAccountingEntry(data) {
    return this.addAccountingEntry(data);
  }
  // ===============================
  // CHAT MESSAGES
  // ===============================
  async getChatMessages() {
    const snapshot = await db.collection("chatMessages").orderBy("createdAt", "asc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data();
      d.id = doc.id;
      return d;
    });
  }
  async addChatMessage(data) {
    const ref = db.collection("chatMessages").doc();
    const newMsg = {
      ...data,
      id: ref.id,
      createdAt: /* @__PURE__ */ new Date()
    };
    await ref.set(newMsg);
    return newMsg;
  }
  // ===============================
  // DASHBOARD STATS (computed manually)
  // ===============================
  async getDashboardStats() {
    const productsSnap = await db.collection("products").get();
    const products2 = productsSnap.docs.map((doc) => doc.data());
    const totalProducts = products2.length;
    const lowStockItems = products2.filter((p) => (p.quantity ?? 0) <= (p.minStockLevel ?? 0)).length;
    const totalValue = products2.reduce(
      (sum, p) => sum + parseFloat(p.price) * (p.quantity ?? 0),
      0
    );
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const txSnap = await db.collection("inventoryTransactions").where("type", "==", "out").get();
    const ordersToday = txSnap.docs.filter((d) => {
      const createdAt = d.data().createdAt?.toDate?.() || d.data().createdAt;
      const dateStr = new Date(createdAt).toISOString().split("T")[0];
      return dateStr === today;
    }).length;
    return {
      totalProducts,
      lowStockItems,
      totalValue: `$${totalValue.toLocaleString()}`,
      ordersToday
    };
  }
};
var storage = new DatabaseStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});
var products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  sku: varchar("sku").notNull().unique(),
  categoryId: varchar("category_id").references(() => categories.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  costPrice: decimal("cost_price", { precision: 10, scale: 2 }),
  quantity: integer("quantity").default(0),
  minStockLevel: integer("min_stock_level").default(0),
  maxStockLevel: integer("max_stock_level"),
  barcode: varchar("barcode"),
  qrCode: varchar("qr_code"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id).notNull(),
  type: varchar("type").notNull(),
  // 'in', 'out', 'adjustment'
  quantity: integer("quantity").notNull(),
  previousQuantity: integer("previous_quantity").notNull(),
  newQuantity: integer("new_quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }),
  reason: varchar("reason"),
  reference: varchar("reference"),
  notes: text("notes"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var accountingEntries = pgTable("accounting_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionId: varchar("transaction_id").references(() => inventoryTransactions.id),
  accountType: varchar("account_type").notNull(),
  // 'asset', 'liability', 'equity', 'revenue', 'expense'
  accountName: varchar("account_name").notNull(),
  debitAmount: decimal("debit_amount", { precision: 10, scale: 2 }).default("0"),
  creditAmount: decimal("credit_amount", { precision: 10, scale: 2 }).default("0"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow()
});
var chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  message: text("message").notNull(),
  response: text("response"),
  isFromUser: boolean("is_from_user").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true
});
var insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  qrCode: true
});
var insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({
  id: true,
  createdAt: true
});
var insertAccountingEntrySchema = createInsertSchema(accountingEntries).omit({
  id: true,
  createdAt: true
});
var insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true
});

// server/routes.ts
async function isAuthenticated(req, res, next) {
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
async function registerRoutes(app2) {
  app2.post("/api/auth/login", async (req, res) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "Missing token" });
    }
    try {
      const decoded = await auth.verifyIdToken(token);
      const { uid, email, name, picture } = decoded;
      const userRef = db.collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        await userRef.set({
          uid,
          email,
          name: name || "Unnamed User",
          picture: picture || null,
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const userData = (await userRef.get()).data();
      res.json({ message: "Login successful", user: userData });
    } catch (error) {
      console.error("Login error:", error);
      res.status(401).json({ message: "Invalid or expired token" });
    }
  });
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      res.json(user || { uid: req.user.uid, email: req.user.email });
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.get("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categories2 = await storage.getCategories();
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app2.post("/api/categories", isAuthenticated, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(400).json({ message: "Failed to create category" });
    }
  });
  app2.get("/api/products", isAuthenticated, async (req, res) => {
    try {
      const search = req.query.search;
      const products2 = await storage.getProducts(search);
      res.json(products2);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });
  app2.get("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) return res.status(404).json({ message: "Product not found" });
      res.json(product);
    } catch (error) {
      console.error("Error fetching product:", error);
      res.status(500).json({ message: "Failed to fetch product" });
    }
  });
  app2.post("/api/products", isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      if (productData.costPrice && productData.quantity) {
        const totalValue = parseFloat(productData.costPrice) * productData.quantity;
        await storage.createAccountingEntry({
          accountType: "asset",
          accountName: "Inventory",
          debitAmount: totalValue.toString(),
          creditAmount: "0",
          description: `Inventory addition: ${product.name}`
        });
      }
      res.status(201).json(product);
    } catch (error) {
      console.error("Error creating product:", error);
      res.status(400).json({ message: "Failed to create product" });
    }
  });
  app2.put("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, productData);
      res.json(product);
    } catch (error) {
      console.error("Error updating product:", error);
      res.status(400).json({ message: "Failed to update product" });
    }
  });
  app2.delete("/api/products/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting product:", error);
      res.status(500).json({ message: "Failed to delete product" });
    }
  });
  app2.post("/api/products/:id/qr", isAuthenticated, async (req, res) => {
    try {
      const productId = req.params.id;
      const uniqueCode = `${productId}:${Date.now()}`;
      await storage.setProductQrCode(productId, uniqueCode);
      res.json({ productId, qrCode: uniqueCode });
    } catch (error) {
      console.error("Error generating QR:", error);
      const message = error?.message === "PRODUCT_NOT_FOUND" ? "Product not found" : "Failed to generate QR code";
      res.status(message === "Product not found" ? 404 : 500).json({ message });
    }
  });
  app2.get("/api/qr/:code", async (req, res) => {
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
  app2.post("/api/qr/:code/confirm-sale", async (req, res) => {
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
  app2.get("/api/reports/data", isAuthenticated, async (_req, res) => {
    try {
      const products2 = await storage.getProducts();
      const categories2 = await storage.getCategories();
      const transactions = await storage.getInventoryTransactions();
      const unitsSold = transactions.filter((t) => t.type === "out").reduce((sum, t) => sum + (t.quantity || 0), 0);
      const productById = new Map(products2.map((p) => [p.id, p]));
      const totalRevenueNumber = transactions.filter((t) => t.type === "out").reduce((sum, t) => {
        const product = productById.get(t.productId);
        const price = product ? parseFloat(product.price ?? 0) : 0;
        return sum + price * (t.quantity || 0);
      }, 0);
      const keyMetrics = {
        totalRevenue: `$${totalRevenueNumber.toLocaleString(void 0, { maximumFractionDigits: 2 })}`,
        unitsSold,
        avgOrderValue: unitsSold > 0 ? `$${(totalRevenueNumber / unitsSold).toFixed(2)}` : "$0",
        returnRate: "0%"
        // Returns not tracked separately in current model
      };
      const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const byMonth = {};
      for (const tx of transactions) {
        const created = tx.createdAt?.toDate?.() || tx.createdAt || /* @__PURE__ */ new Date();
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
      const categoryIdToName = new Map(categories2.map((c) => [c.id, c.name]));
      const categoryTotals = {};
      for (const p of products2) {
        const name = categoryIdToName.get(p.categoryId) || "Uncategorized";
        categoryTotals[name] = (categoryTotals[name] || 0) + (p.quantity || 0);
      }
      const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
      const soldByProduct = {};
      for (const tx of transactions) {
        if (tx.type === "out") {
          soldByProduct[tx.productId] = (soldByProduct[tx.productId] || 0) + (tx.quantity || 0);
        }
      }
      const topProducts = Object.entries(soldByProduct).map(([productId, sales]) => ({
        name: productById.get(productId)?.name || "Unknown",
        sales,
        change: 0
      })).sort((a, b) => b.sales - a.sales).slice(0, 10);
      res.json({ keyMetrics, salesData, inventoryTrends, categoryData, topProducts });
    } catch (error) {
      console.error("Error building reports data:", error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs2 from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
var vite_config_default = defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    },
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false
      }
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, async () => {
    log(`serving on port ${port}`);
    try {
    } catch (error) {
      log(`Error seeding sample data: ${error}`);
    }
  });
})();
