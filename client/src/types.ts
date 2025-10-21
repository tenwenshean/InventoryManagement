// frontend/src/types.ts
import { z } from "zod";
import { Timestamp } from "firebase/firestore";

// ===== PRODUCT TYPES =====
export const insertProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  sku: z.string().min(1, "SKU is required"),
  categoryId: z.string().min(1, "Category is required"),
  price: z.string().min(0, "Price must be positive"),
  costPrice: z.string().optional(),
  quantity: z.number().min(0, "Quantity cannot be negative").default(0),
  minStockLevel: z.number().min(0).default(0),
  maxStockLevel: z.number().min(0).optional(),
  barcode: z.string().optional(),
  imageUrl: z.string().optional(),
  isActive: z.boolean().default(true),
});

export type InsertProduct = z.infer<typeof insertProductSchema>;

export interface Product extends InsertProduct {
  id: string;
  imageUrl?: string;
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