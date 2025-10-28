import { db } from "./db";
import {
  User,
  Category,
  Product,
  InventoryTransaction,
  AccountingEntry,
  ChatMessage,
  InsertCategory,
  InsertProduct,
  InsertInventoryTransaction,
  InsertAccountingEntry,
  InsertChatMessage,
} from "@shared/schema";

/**
 * Firestore-based database storage class
 * Replaces all SQL/Drizzle ORM operations with Firestore CRUD
 */
export class DatabaseStorage {
  // ===============================
  // USERS
  // ===============================
  async getUser(id: string): Promise<User | null> {
    const doc = await db.collection("users").doc(id).get();
    if (!doc.exists) return null;
    const data = doc.data() as User;
    (data as any).id = doc.id;
    return data as User;
  }

  async upsertUser(id: string, data: Partial<User>): Promise<User> {
    const userRef = db.collection("users").doc(id);
    const existing = await userRef.get();

    const newData = {
      ...data,
      updatedAt: new Date(),
      createdAt: existing.exists ? existing.data()?.createdAt : new Date(),
    };

    await userRef.set(newData, { merge: true });
    const updated = await userRef.get();
    const u = updated.data() as User;
    (u as any).id = id;
    return u;
  }

  // ===============================
  // CATEGORIES
  // ===============================
  async getCategories(userId?: string): Promise<Category[]> {
    let query: FirebaseFirestore.Query = db.collection("categories");
    if (userId) {
      query = query.where("userId", "==", userId);
    }
    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data() as Category;
      (d as any).id = doc.id;
      return d as Category;
    });
  }

  async addCategory(data: InsertCategory, userId?: string): Promise<Category> {
    const ref = db.collection("categories").doc();
    const newData = { ...data, id: ref.id, userId, createdAt: new Date() };
    await ref.set(newData);
    return newData as Category;
  }

  // Backwards-compatible alias used by routes
  async createCategory(data: InsertCategory, userId?: string): Promise<Category> {
    return this.addCategory(data, userId);
  }

  async deleteCategory(id: string): Promise<void> {
    await db.collection("categories").doc(id).delete();
  }

  // ===============================
  // PRODUCTS
  // ===============================
  // Wrapper to support optional search parameter expected by routes
  async getProducts(search?: string, userId?: string): Promise<Product[]> {
    return this.getProductsBySearch(search, userId);
  }

  // Support optional search parameter
  async getProductsBySearch(search?: string, userId?: string): Promise<Product[]> {
    let query: FirebaseFirestore.Query = db.collection("products");
    
    if (userId) {
      query = query.where("userId", "==", userId);
    }
    query = query.orderBy("createdAt", "desc");
    
    const snapshot = await query.get();
    
    if (search) {
      // Simple search: match name or sku (case-insensitive)
      // Firestore doesn't support OR or contains easily; for now, fallback to client-side filter
      const all = snapshot.docs.map((d) => {
        const dd = d.data() as Product;
        (dd as any).id = d.id;
        return dd as Product;
      });
      const s = search.toLowerCase();
      return all.filter((p) => (p.name ?? "").toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s));
    }
    
    return snapshot.docs.map((doc) => {
      const d = doc.data() as Product;
      (d as any).id = doc.id;
      return d as Product;
    });
  }

  async addProduct(data: InsertProduct, userId?: string, userEmail?: string): Promise<Product> {
    const ref = db.collection("products").doc();
    const newProduct = {
      ...data,
      id: ref.id,
      userId,
      userEmail,
      qrCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: data.isActive ?? true,
      quantity: data.quantity ?? 0,
    };
    await ref.set(newProduct);
    return newProduct as Product;
  }

  // Backwards-compatible alias used by routes
  async createProduct(data: InsertProduct, userId?: string, userEmail?: string): Promise<Product> {
    return this.addProduct(data, userId, userEmail);
  }

  async getProduct(id: string): Promise<Product | null> {
    const doc = await db.collection("products").doc(id).get();
    if (!doc.exists) return null;
    const d = doc.data() as Product;
    (d as any).id = doc.id;
    return d as Product;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<Product> {
    const ref = db.collection("products").doc(id);
    
    // Handle imageUrl explicitly - if it's an empty string, remove the field
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };
    
    // Simply allow empty string for imageUrl (frontend will handle display)
    if (data.hasOwnProperty('imageUrl') && (data.imageUrl === '' || data.imageUrl === null)) {
      console.log("🗑️ Setting imageUrl to empty string for product:", id);
      updateData.imageUrl = '';
    }
    
    await ref.update(updateData);
    
    // Fetch and return the updated product
    const updatedDoc = await ref.get();
    if (!updatedDoc.exists) {
      throw new Error("Product not found after update");
    }
    
    const productData = updatedDoc.data();
    const product = {
      ...productData,
      id,
    } as Product;
    return product;
  }

  async setProductQrCode(id: string, qrCode: string): Promise<void> {
    const ref = db.collection("products").doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new Error("PRODUCT_NOT_FOUND");
    await ref.set({ qrCode, updatedAt: new Date() } as any, { merge: true });
  }

  async getProductByQrCode(qrCode: string): Promise<Product | null> {
    const snap = await db.collection("products").where("qrCode", "==", qrCode).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    const d = doc.data() as Product;
    (d as any).id = doc.id;
    return d as Product;
  }

  async decrementQuantityAndRecordSale(productId: string): Promise<{ updated: Product } | null> {
    const ref = db.collection("products").doc(productId);
    return await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) return null;
      const data = doc.data() as any as Product;
      const currentQty = (data.quantity as any) ?? 0;
      const newQty = Math.max(0, (currentQty as number) - 1);

      tx.update(ref, { quantity: newQty, updatedAt: new Date() });

      const txRef = db.collection("inventoryTransactions").doc();
      tx.set(txRef, {
        id: txRef.id,
        productId,
        type: "out",
        quantity: 1,
        previousQuantity: currentQty,
        newQuantity: newQty,
        unitPrice: (data.price as any) ?? null,
        totalValue: data.price ? String(parseFloat(data.price as any) * 1) : null,
        reason: "QR sale",
        reference: `qr:${(data as any).qrCode ?? "unknown"}`,
        createdBy: null,
        createdAt: new Date(),
      });

      return { updated: { ...(data as any), id: productId, quantity: newQty } as Product };
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await db.collection("products").doc(id).delete();
  }

  // ===============================
  // INVENTORY TRANSACTIONS
  // ===============================
  async getInventoryTransactions(productId?: string): Promise<InventoryTransaction[]> {
    let query: FirebaseFirestore.Query = db.collection("inventoryTransactions");
    if (productId) {
      query = query.where("productId", "==", productId);
    }
    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data() as InventoryTransaction;
      (d as any).id = doc.id;
      return d as InventoryTransaction;
    });
  }

  // Get transactions for multiple products (optimized for accounting reports)
  async getInventoryTransactionsByProducts(productIds: string[]): Promise<InventoryTransaction[]> {
    if (productIds.length === 0) return [];
    
    // Firestore 'in' operator is limited to 10 items, so batch the queries
    const batchSize = 10;
    const batchPromises: Promise<InventoryTransaction[]>[] = [];
    
    // Run all batches in parallel for better performance
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const batchPromise = db.collection("inventoryTransactions")
        .where("productId", "in", batch)
        .get()
        .then(snapshot => 
          snapshot.docs.map(doc => {
            const d = doc.data() as InventoryTransaction;
            (d as any).id = doc.id;
            return d as InventoryTransaction;
          })
        );
      
      batchPromises.push(batchPromise);
    }
    
    // Wait for all batches to complete
    const batchResults = await Promise.all(batchPromises);
    const allTransactions = batchResults.flat();
    
    // Sort by createdAt descending
    return allTransactions.sort((a, b) => {
      const aDate = (a.createdAt as any)?.toDate?.() || a.createdAt || new Date(0);
      const bDate = (b.createdAt as any)?.toDate?.() || b.createdAt || new Date(0);
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });
  }

  async addInventoryTransaction(data: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const ref = db.collection("inventoryTransactions").doc();
    const newTx = {
      ...data,
      id: ref.id,
      createdAt: new Date(),
    };
    await ref.set(newTx);
    return newTx as InventoryTransaction;
  }

  // Backwards-compatible alias
  async createInventoryTransaction(data: InsertInventoryTransaction): Promise<InventoryTransaction> {
    return this.addInventoryTransaction(data);
  }

  // ===============================
  // ACCOUNTING ENTRIES
  // ===============================
  async getAccountingEntries(userId?: string): Promise<AccountingEntry[]> {
    if (userId) {
      // Use where clause directly - simpler and faster
      const snapshot = await db.collection("accountingEntries")
        .where("userId", "==", userId)
        .get();
      
      const entries = snapshot.docs.map(doc => {
        const d = doc.data() as AccountingEntry;
        (d as any).id = doc.id;
        return d as AccountingEntry;
      });
      
      // Sort by createdAt descending
      return entries.sort((a, b) => {
        const aDate = (a.createdAt as any)?.toDate?.() || a.createdAt || new Date(0);
        const bDate = (b.createdAt as any)?.toDate?.() || b.createdAt || new Date(0);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    } else {
      // No userId filter, fetch all with ordering
      const snapshot = await db.collection("accountingEntries")
        .orderBy("createdAt", "desc")
        .get();
      
      return snapshot.docs.map((doc) => {
        const d = doc.data() as AccountingEntry;
        (d as any).id = doc.id;
        return d as AccountingEntry;
      });
    }
  }

  async addAccountingEntry(data: InsertAccountingEntry, userId?: string): Promise<AccountingEntry> {
    const ref = db.collection("accountingEntries").doc();
    const newEntry = {
      ...data,
      id: ref.id,
      userId,
      createdAt: new Date(),
    };
    await ref.set(newEntry);
    return newEntry as AccountingEntry;
  }

  // Backwards-compatible alias
  async createAccountingEntry(data: InsertAccountingEntry, userId?: string): Promise<AccountingEntry> {
    return this.addAccountingEntry(data, userId);
  }

  // ===============================
  // CHAT MESSAGES
  // ===============================
  async getChatMessages(): Promise<ChatMessage[]> {
    const snapshot = await db.collection("chatMessages").orderBy("createdAt", "asc").get();
    return snapshot.docs.map((doc) => {
      const d = doc.data() as ChatMessage;
      (d as any).id = doc.id;
      return d as ChatMessage;
    });
  }

  async addChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const ref = db.collection("chatMessages").doc();
    const newMsg = {
      ...data,
      id: ref.id,
      createdAt: new Date(),
    };
    await ref.set(newMsg);
    return newMsg as ChatMessage;
  }

  // ===============================
  // DASHBOARD STATS (computed manually)
  // ===============================
  async getDashboardStats() {
    const productsSnap = await db.collection("products").get();
    const products = productsSnap.docs.map((doc) => doc.data() as Product);

    const totalProducts = products.length;
    const lowStockItems = products.filter((p) => (p.quantity ?? 0) <= (p.minStockLevel ?? 0)).length;
    const totalValue = products.reduce(
      (sum, p) => sum + (parseFloat(p.price as any) * (p.quantity ?? 0)),
      0
    );

    const today = new Date().toISOString().split("T")[0];
    const txSnap = await db.collection("inventoryTransactions").where("type", "==", "out").get();
    const ordersToday = txSnap.docs.filter((d) => {
      const createdAt = (d.data().createdAt as any)?.toDate?.() || d.data().createdAt;
      const dateStr = new Date(createdAt).toISOString().split("T")[0];
      return dateStr === today;
    }).length;

    return {
      totalProducts,
      lowStockItems,
      totalValue: `$${totalValue.toLocaleString()}`,
      ordersToday,
    };
  }
}
export const storage = new DatabaseStorage();

