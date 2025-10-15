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
    return doc.exists ? ({ id: doc.id, ...doc.data() } as User) : null;
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
    return { id, ...(updated.data() as User) };
  }

  // ===============================
  // CATEGORIES
  // ===============================
  async getCategories(): Promise<Category[]> {
    const snapshot = await db.collection("categories").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Category));
  }

  async addCategory(data: InsertCategory): Promise<Category> {
    const ref = db.collection("categories").doc();
    const newData = { ...data, id: ref.id, createdAt: new Date() };
    await ref.set(newData);
    return newData as Category;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.collection("categories").doc(id).delete();
  }

  // ===============================
  // PRODUCTS
  // ===============================
  async getProducts(): Promise<Product[]> {
    const snapshot = await db.collection("products").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Product));
  }

  async addProduct(data: InsertProduct): Promise<Product> {
    const ref = db.collection("products").doc();
    const newProduct = {
      ...data,
      id: ref.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: data.isActive ?? true,
      quantity: data.quantity ?? 0,
    };
    await ref.set(newProduct);
    return newProduct as Product;
  }

  async updateProduct(id: string, data: Partial<Product>): Promise<void> {
    await db.collection("products").doc(id).update({
      ...data,
      updatedAt: new Date(),
    });
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
    return { id: doc.id, ...(doc.data() as Product) } as Product;
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
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as InventoryTransaction));
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

  // ===============================
  // ACCOUNTING ENTRIES
  // ===============================
  async getAccountingEntries(): Promise<AccountingEntry[]> {
    const snapshot = await db.collection("accountingEntries").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as AccountingEntry));
  }

  async addAccountingEntry(data: InsertAccountingEntry): Promise<AccountingEntry> {
    const ref = db.collection("accountingEntries").doc();
    const newEntry = {
      ...data,
      id: ref.id,
      createdAt: new Date(),
    };
    await ref.set(newEntry);
    return newEntry as AccountingEntry;
  }

  // ===============================
  // CHAT MESSAGES
  // ===============================
  async getChatMessages(): Promise<ChatMessage[]> {
    const snapshot = await db.collection("chatMessages").orderBy("createdAt", "asc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage));
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

