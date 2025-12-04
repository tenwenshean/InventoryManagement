// frontend/src/types.ts
import { z } from "zod";
import { Timestamp } from "firebase/firestore";

// ===== PRODUCT TYPES =====
export const insertProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().min(1, "Description is required"),
  sku: z.string().min(1, "SKU is required"),
  categoryId: z.string().min(1, "Category is required"),
  price: z.string().refine((val) => parseFloat(val) > 0, "Selling price must be greater than 0"),
  costPrice: z.string().refine((val) => parseFloat(val) > 0, "Cost price must be greater than 0"),
  quantity: z.number().min(1, "Quantity must be at least 1"),
  minStockLevel: z.number().min(0).optional().default(0),
  maxStockLevel: z.number().min(0).optional().default(100),
  location: z.string().min(1, "Storage location is required"),
  supplier: z.string().min(1, "Supplier is required"),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;

export interface Product extends InsertProduct {
  id: string;
  userId?: string; // Owner of the product
  imageUrl?: string;
  qrCode?: string;
  notes?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
}

// ===== CATEGORY TYPES =====
export const insertCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  description: z.string().optional(),
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;

export interface Category extends InsertCategory {
  id: string;
  createdAt: Date | Timestamp;
}

// ===== USER TYPES =====
export interface User {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: Date | Timestamp;
}

// ===== INVENTORY TRANSACTION TYPES =====
export interface InventoryTransaction {
  id: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  unitPrice?: number;
  totalValue?: number;
  reason?: string;
  reference?: string;
  notes?: string;
  createdBy: string;
  createdAt: Date | Timestamp;
}

// ===== ACCOUNTING ENTRY TYPES =====
export interface AccountingEntry {
  id: string;
  transactionId?: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  accountName: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
  createdAt: Date | Timestamp;
}

// ===== COUPON TYPES =====
export const insertCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required"),
  sellerId: z.string().min(1, "Seller ID is required"),
  discountType: z.enum(['percentage', 'fixed']),
  discountValue: z.string().min(0, "Discount value must be positive"),
  minPurchase: z.string().optional(),
  applicableProducts: z.string().optional(), // JSON array of product IDs
  maxUses: z.number().min(1).optional(),
  expiresAt: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertCoupon = z.infer<typeof insertCouponSchema>;

export interface Coupon extends Omit<InsertCoupon, 'expiresAt'> {
  id: string;
  usedCount: number;
  expiresAt?: Date | Timestamp | null;
  createdAt: Date | Timestamp;
}

// ===== SUBSCRIPTION TYPES =====
export interface Subscription {
  id: string;
  customerId: string;
  sellerId: string;
  createdAt: Date | Timestamp;
}

// ===== NOTIFICATION TYPES =====
export interface Notification {
  id: string;
  userId: string;
  type: 'coupon' | 'order' | 'general';
  title: string;
  message: string;
  data?: string; // JSON data
  isRead: boolean;
  createdAt: Date | Timestamp;
}
