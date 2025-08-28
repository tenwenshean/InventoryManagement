import {
  users,
  categories,
  products,
  inventoryTransactions,
  accountingEntries,
  chatMessages,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Product,
  type InsertProduct,
  type InventoryTransaction,
  type InsertInventoryTransaction,
  type AccountingEntry,
  type InsertAccountingEntry,
  type ChatMessage,
  type InsertChatMessage,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, like, and } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT - mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Product operations
  getProducts(search?: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  getLowStockProducts(): Promise<Product[]>;
  generateQRCode(productId: string): Promise<string>;

  // Inventory transaction operations
  getInventoryTransactions(productId?: string): Promise<InventoryTransaction[]>;
  createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;
  
  // Accounting operations
  getAccountingEntries(): Promise<AccountingEntry[]>;
  createAccountingEntry(entry: InsertAccountingEntry): Promise<AccountingEntry>;

  // Chat operations
  getChatMessages(userId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  // Dashboard statistics
  getDashboardStats(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    totalValue: string;
    ordersToday: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT - mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const [updatedCategory] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updatedCategory;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Product operations
  async getProducts(search?: string): Promise<Product[]> {
    let query = db.select().from(products).where(eq(products.isActive, true));
    
    if (search) {
      query = query.where(
        and(
          eq(products.isActive, true),
          like(products.name, `%${search}%`)
        )
      );
    }
    
    return await query.orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const [newProduct] = await db
      .insert(products)
      .values({ ...product, qrCode })
      .returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const [updatedProduct] = await db
      .update(products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();
    return updatedProduct;
  }

  async deleteProduct(id: string): Promise<void> {
    await db.update(products).set({ isActive: false }).where(eq(products.id, id));
  }

  async getLowStockProducts(): Promise<Product[]> {
    return await db
      .select()
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.quantity} <= ${products.minStockLevel}`
        )
      );
  }

  async generateQRCode(productId: string): Promise<string> {
    const qrCode = `QR-${productId}-${Date.now()}`;
    await db.update(products).set({ qrCode }).where(eq(products.id, productId));
    return qrCode;
  }

  // Inventory transaction operations
  async getInventoryTransactions(productId?: string): Promise<InventoryTransaction[]> {
    let query = db.select().from(inventoryTransactions);
    
    if (productId) {
      query = query.where(eq(inventoryTransactions.productId, productId));
    }
    
    return await query.orderBy(desc(inventoryTransactions.createdAt));
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [newTransaction] = await db
      .insert(inventoryTransactions)
      .values(transaction)
      .returning();
    
    // Update product quantity
    const product = await this.getProduct(transaction.productId);
    if (product) {
      await this.updateProduct(transaction.productId, {
        quantity: transaction.newQuantity,
      });
    }
    
    return newTransaction;
  }

  // Accounting operations
  async getAccountingEntries(): Promise<AccountingEntry[]> {
    return await db
      .select()
      .from(accountingEntries)
      .orderBy(desc(accountingEntries.createdAt));
  }

  async createAccountingEntry(entry: InsertAccountingEntry): Promise<AccountingEntry> {
    const [newEntry] = await db.insert(accountingEntries).values(entry).returning();
    return newEntry;
  }

  // Chat operations
  async getChatMessages(userId: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    totalValue: string;
    ordersToday: number;
  }> {
    const [totalProductsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.isActive, true));

    const lowStockProducts = await this.getLowStockProducts();

    const [totalValueResult] = await db
      .select({
        totalValue: sql<string>`COALESCE(SUM(${products.price} * ${products.quantity}), 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true));

    const [ordersResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryTransactions)
      .where(
        and(
          eq(inventoryTransactions.type, 'out'),
          sql`DATE(${inventoryTransactions.createdAt}) = CURRENT_DATE`
        )
      );

    return {
      totalProducts: totalProductsResult.count,
      lowStockItems: lowStockProducts.length,
      totalValue: `$${parseFloat(totalValueResult.totalValue).toLocaleString()}`,
      ordersToday: ordersResult.count,
    };
  }
}

export const storage = new DatabaseStorage();
