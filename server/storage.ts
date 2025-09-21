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
    let query = db.select().from(products);
    
    if (search) {
      query = query.where(
        and(
          eq(products.isActive, true),
          like(products.name, `%${search}%`)
        )
      );
    } else {
      query = query.where(eq(products.isActive, true));
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
    const query = productId 
      ? db.select().from(inventoryTransactions).where(eq(inventoryTransactions.productId, productId))
      : db.select().from(inventoryTransactions);
    
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

// Temporary in-memory storage for development
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private categories = new Map<string, Category>();
  private products = new Map<string, Product>();
  private inventoryTransactions = new Map<string, InventoryTransaction>();
  private accountingEntries = new Map<string, AccountingEntry>();
  private chatMessages = new Map<string, ChatMessage[]>();

  // User operations (IMPORTANT - mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const user: User = {
      id: userData.id || this.generateId(),
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: userData.profileImageUrl || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const newCategory: Category = {
      id: this.generateId(),
      name: category.name,
      description: category.description || null,
      createdAt: new Date(),
    };
    this.categories.set(newCategory.id, newCategory);
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    const existing = this.categories.get(id);
    if (!existing) throw new Error('Category not found');
    
    const updated: Category = { ...existing, ...category };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  // Product operations
  async getProducts(search?: string): Promise<Product[]> {
    let products = Array.from(this.products.values()).filter(p => p.isActive);
    
    if (search) {
      products = products.filter(p => 
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase())
      );
    }
    
    return products.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const qrCode = `QR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newProduct: Product = {
      id: this.generateId(),
      name: product.name,
      description: product.description || null,
      sku: product.sku,
      categoryId: product.categoryId || null,
      price: product.price,
      costPrice: product.costPrice || null,
      quantity: product.quantity || 0,
      minStockLevel: product.minStockLevel || 0,
      maxStockLevel: product.maxStockLevel || null,
      barcode: product.barcode || null,
      qrCode,
      isActive: product.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product> {
    const existing = this.products.get(id);
    if (!existing) throw new Error('Product not found');
    
    const updated: Product = { ...existing, ...product, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    const product = this.products.get(id);
    if (product) {
      product.isActive = false;
      this.products.set(id, product);
    }
  }

  async getLowStockProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => 
      p.isActive && (p.quantity || 0) <= (p.minStockLevel || 0)
    );
  }

  async generateQRCode(productId: string): Promise<string> {
    const product = this.products.get(productId);
    if (!product) throw new Error('Product not found');
    
    const qrCode = `QR-${productId}-${Date.now()}`;
    product.qrCode = qrCode;
    this.products.set(productId, product);
    return qrCode;
  }

  // Inventory transaction operations
  async getInventoryTransactions(productId?: string): Promise<InventoryTransaction[]> {
    let transactions = Array.from(this.inventoryTransactions.values());
    
    if (productId) {
      transactions = transactions.filter(t => t.productId === productId);
    }
    
    return transactions.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const newTransaction: InventoryTransaction = {
      id: this.generateId(),
      productId: transaction.productId,
      type: transaction.type,
      quantity: transaction.quantity,
      previousQuantity: transaction.previousQuantity,
      newQuantity: transaction.newQuantity,
      unitPrice: transaction.unitPrice || null,
      totalValue: transaction.totalValue || null,
      reason: transaction.reason || null,
      reference: transaction.reference || null,
      notes: transaction.notes || null,
      createdBy: transaction.createdBy || null,
      createdAt: new Date(),
    };
    
    this.inventoryTransactions.set(newTransaction.id, newTransaction);
    
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
    return Array.from(this.accountingEntries.values()).sort((a, b) => 
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  async createAccountingEntry(entry: InsertAccountingEntry): Promise<AccountingEntry> {
    const newEntry: AccountingEntry = {
      id: this.generateId(),
      transactionId: entry.transactionId || null,
      accountType: entry.accountType,
      accountName: entry.accountName,
      debitAmount: entry.debitAmount || "0",
      creditAmount: entry.creditAmount || "0",
      description: entry.description || null,
      createdAt: new Date(),
    };
    
    this.accountingEntries.set(newEntry.id, newEntry);
    return newEntry;
  }

  // Chat operations
  async getChatMessages(userId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(userId) || [];
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      id: this.generateId(),
      userId: message.userId,
      message: message.message,
      response: message.response || null,
      isFromUser: message.isFromUser,
      createdAt: new Date(),
    };
    
    const userMessages = this.chatMessages.get(message.userId) || [];
    userMessages.push(newMessage);
    this.chatMessages.set(message.userId, userMessages);
    
    return newMessage;
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<{
    totalProducts: number;
    lowStockItems: number;
    totalValue: string;
    ordersToday: number;
  }> {
    const products = Array.from(this.products.values()).filter(p => p.isActive);
    const lowStockProducts = await this.getLowStockProducts();
    
    const totalValue = products.reduce((sum, product) => {
      return sum + (parseFloat(product.price) * (product.quantity || 0));
    }, 0);

    const today = new Date().toDateString();
    const ordersToday = Array.from(this.inventoryTransactions.values()).filter(t => 
      t.type === 'out' && new Date(t.createdAt || 0).toDateString() === today
    ).length;

    return {
      totalProducts: products.length,
      lowStockItems: lowStockProducts.length,
      totalValue: `$${totalValue.toLocaleString()}`,
      ordersToday,
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

export const storage = new MemStorage();

// Sample data seeding function
export async function seedSampleData() {
  // Check if data already exists
  const existingProducts = await storage.getProducts();
  if (existingProducts.length > 0) {
    return; // Data already seeded
  }

  console.log('Seeding sample data...');

  // Create categories
  const categories = [
    { name: "Electronics", description: "Electronic devices and accessories" },
    { name: "Office Supplies", description: "Office and business supplies" },
    { name: "Books", description: "Books and educational materials" },
    { name: "Home & Garden", description: "Home and garden products" }
  ];

  const createdCategories = [];
  for (const category of categories) {
    const created = await storage.createCategory(category);
    createdCategories.push(created);
  }

  // Create sample products with suppliers and realistic data
  const products = [
    {
      name: "Wireless Bluetooth Headphones",
      description: "Premium wireless headphones with noise cancellation",
      sku: "WBH-001",
      categoryId: createdCategories[0].id,
      price: "89.99",
      costPrice: "45.00",
      quantity: 45,
      minStockLevel: 10,
      maxStockLevel: 100,
      barcode: "1234567890123",
      supplier: "TechSound Corp"
    },
    {
      name: "USB-C Cable 6ft",
      description: "High-speed USB-C charging and data cable",
      sku: "USB-C-6FT",
      categoryId: createdCategories[0].id,
      price: "12.99",
      costPrice: "6.50",
      quantity: 125,
      minStockLevel: 25,
      maxStockLevel: 200,
      barcode: "1234567890124",
      supplier: "Cable Solutions Ltd"
    },
    {
      name: "Wireless Mouse",
      description: "Ergonomic wireless optical mouse",
      sku: "WM-2024",
      categoryId: createdCategories[0].id,
      price: "24.99",
      costPrice: "12.00",
      quantity: 8,
      minStockLevel: 15,
      maxStockLevel: 75,
      barcode: "1234567890125",
      supplier: "Input Devices Inc"
    },
    {
      name: "Office Desk Organizer",
      description: "Bamboo desk organizer with multiple compartments",
      sku: "ODO-BAM-01",
      categoryId: createdCategories[1].id,
      price: "34.99",
      costPrice: "18.00",
      quantity: 32,
      minStockLevel: 10,
      maxStockLevel: 50,
      barcode: "1234567890126",
      supplier: "Office Pro Supply"
    },
    {
      name: "Sticky Notes Pack",
      description: "Multi-color sticky notes, 12 pads per pack",
      sku: "SN-PACK-12",
      categoryId: createdCategories[1].id,
      price: "8.99",
      costPrice: "4.25",
      quantity: 78,
      minStockLevel: 20,
      maxStockLevel: 100,
      barcode: "1234567890127",
      supplier: "Paper Solutions Co"
    },
    {
      name: "JavaScript Programming Guide",
      description: "Complete guide to modern JavaScript programming",
      sku: "JS-GUIDE-2024",
      categoryId: createdCategories[2].id,
      price: "49.99",
      costPrice: "28.00",
      quantity: 23,
      minStockLevel: 5,
      maxStockLevel: 30,
      barcode: "1234567890128",
      supplier: "Educational Books Ltd"
    },
    {
      name: "LED Desk Lamp",
      description: "Adjustable LED desk lamp with USB charging port",
      sku: "LED-LAMP-USB",
      categoryId: createdCategories[3].id,
      price: "42.99",
      costPrice: "22.50",
      quantity: 18,
      minStockLevel: 8,
      maxStockLevel: 40,
      barcode: "1234567890129",
      supplier: "Home Lighting Solutions"
    },
    {
      name: "Bluetooth Speaker",
      description: "Portable waterproof Bluetooth speaker",
      sku: "BT-SPK-W01",
      categoryId: createdCategories[0].id,
      price: "67.99",
      costPrice: "35.00",
      quantity: 28,
      minStockLevel: 12,
      maxStockLevel: 60,
      barcode: "1234567890130",
      supplier: "Audio Tech Corp"
    }
  ];

  const createdProducts = [];
  for (const product of products) {
    const created = await storage.createProduct(product);
    createdProducts.push(created);
  }

  // Create sample inventory transactions (sales and restocks)
  const transactions = [
    // Recent sales
    { productId: createdProducts[0].id, type: 'out', quantity: 5, previousQuantity: 50, newQuantity: 45, unitPrice: "89.99", totalValue: "449.95", reason: "Sale", reference: "ORD-001", notes: "Online order" },
    { productId: createdProducts[1].id, type: 'out', quantity: 15, previousQuantity: 140, newQuantity: 125, unitPrice: "12.99", totalValue: "194.85", reason: "Sale", reference: "ORD-002", notes: "Bulk order" },
    { productId: createdProducts[2].id, type: 'out', quantity: 12, previousQuantity: 20, newQuantity: 8, unitPrice: "24.99", totalValue: "299.88", reason: "Sale", reference: "ORD-003", notes: "Retail sales" },
    { productId: createdProducts[3].id, type: 'out', quantity: 3, previousQuantity: 35, newQuantity: 32, unitPrice: "34.99", totalValue: "104.97", reason: "Sale", reference: "ORD-004", notes: "Office supply order" },
    { productId: createdProducts[4].id, type: 'out', quantity: 22, previousQuantity: 100, newQuantity: 78, unitPrice: "8.99", totalValue: "197.78", reason: "Sale", reference: "ORD-005", notes: "School order" },
    { productId: createdProducts[5].id, type: 'out', quantity: 7, previousQuantity: 30, newQuantity: 23, unitPrice: "49.99", totalValue: "349.93", reason: "Sale", reference: "ORD-006", notes: "Bookstore order" },
    { productId: createdProducts[6].id, type: 'out', quantity: 2, previousQuantity: 20, newQuantity: 18, unitPrice: "42.99", totalValue: "85.98", reason: "Sale", reference: "ORD-007", notes: "Home office setup" },
    { productId: createdProducts[7].id, type: 'out', quantity: 7, previousQuantity: 35, newQuantity: 28, unitPrice: "67.99", totalValue: "475.93", reason: "Sale", reference: "ORD-008", notes: "Electronics sale" },
    
    // Restocks
    { productId: createdProducts[0].id, type: 'in', quantity: 30, previousQuantity: 20, newQuantity: 50, unitPrice: "45.00", totalValue: "1350.00", reason: "Restock", reference: "PO-101", notes: "Monthly restock from TechSound Corp" },
    { productId: createdProducts[1].id, type: 'in', quantity: 50, previousQuantity: 90, newQuantity: 140, unitPrice: "6.50", totalValue: "325.00", reason: "Restock", reference: "PO-102", notes: "Bulk purchase from Cable Solutions" }
  ];

  for (const transaction of transactions) {
    await storage.createInventoryTransaction(transaction);
  }

  // Create corresponding accounting entries for each transaction
  const accountingEntries = [
    // Sales entries
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "449.95", debitAmount: "0", description: "Sale of Wireless Bluetooth Headphones" },
    { accountType: "asset", accountName: "Cash", debitAmount: "449.95", creditAmount: "0", description: "Cash from headphones sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "194.85", debitAmount: "0", description: "Sale of USB-C Cables" },
    { accountType: "asset", accountName: "Cash", debitAmount: "194.85", creditAmount: "0", description: "Cash from cable sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "299.88", debitAmount: "0", description: "Sale of Wireless Mouse" },
    { accountType: "asset", accountName: "Cash", debitAmount: "299.88", creditAmount: "0", description: "Cash from mouse sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "104.97", debitAmount: "0", description: "Sale of Office Desk Organizer" },
    { accountType: "asset", accountName: "Cash", debitAmount: "104.97", creditAmount: "0", description: "Cash from organizer sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "197.78", debitAmount: "0", description: "Sale of Sticky Notes Pack" },
    { accountType: "asset", accountName: "Cash", debitAmount: "197.78", creditAmount: "0", description: "Cash from notes sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "349.93", debitAmount: "0", description: "Sale of JavaScript Programming Guide" },
    { accountType: "asset", accountName: "Cash", debitAmount: "349.93", creditAmount: "0", description: "Cash from book sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "85.98", debitAmount: "0", description: "Sale of LED Desk Lamp" },
    { accountType: "asset", accountName: "Cash", debitAmount: "85.98", creditAmount: "0", description: "Cash from lamp sale" },
    { accountType: "revenue", accountName: "Product Sales", creditAmount: "475.93", debitAmount: "0", description: "Sale of Bluetooth Speaker" },
    { accountType: "asset", accountName: "Cash", debitAmount: "475.93", creditAmount: "0", description: "Cash from speaker sale" },
    
    // Purchase entries
    { accountType: "asset", accountName: "Inventory", debitAmount: "1350.00", creditAmount: "0", description: "Purchase of Wireless Bluetooth Headphones inventory" },
    { accountType: "liability", accountName: "Accounts Payable", creditAmount: "1350.00", debitAmount: "0", description: "Payment due to TechSound Corp" },
    { accountType: "asset", accountName: "Inventory", debitAmount: "325.00", creditAmount: "0", description: "Purchase of USB-C Cables inventory" },
    { accountType: "liability", accountName: "Accounts Payable", creditAmount: "325.00", debitAmount: "0", description: "Payment due to Cable Solutions" }
  ];

  for (const entry of accountingEntries) {
    await storage.createAccountingEntry(entry);
  }

  console.log('Sample data seeded successfully!');
}
