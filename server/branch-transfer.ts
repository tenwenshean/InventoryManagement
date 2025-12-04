import { db } from "./db";
import crypto from "crypto";
import QRCode from "qrcode";

/**
 * Branch Transfer Service
 * Handles all branch transfer operations including PIN validation,
 * transfer slip generation, and product location updates
 */
export class BranchTransferService {
  /**
   * Hash a PIN for secure storage
   */
  hashPin(pin: string): string {
    return crypto.createHash("sha256").update(pin).digest("hex");
  }

  /**
   * Verify a PIN against a hashed PIN
   */
  verifyPin(pin: string, hashedPin: string): boolean {
    const hash = this.hashPin(pin);
    return hash === hashedPin;
  }

  /**
   * Generate a unique transfer ID
   */
  generateTransferId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TRF-${timestamp}-${random}`;
  }

  /**
   * Get all branches
   */
  async getBranches(): Promise<any[]> {
    const snapshot = await db.collection("branches")
      .get();

    // Filter active branches in memory
    return snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((branch: any) => branch.isActive !== false)
      .sort((a: any, b: any) => a.name?.localeCompare(b.name) || 0);
  }

  /**
   * Create a new branch
   */
  async createBranch(data: {
    name: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    contactNumber?: string;
  }): Promise<any> {
    const ref = db.collection("branches").doc();
    const branchData = {
      ...data,
      id: ref.id,
      isActive: true,
      createdAt: new Date(),
    };
    await ref.set(branchData);
    return branchData;
  }

  /**
   * Update a branch
   */
  async updateBranch(branchId: string, data: {
    name?: string;
    address?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    contactNumber?: string;
  }): Promise<any> {
    const ref = db.collection("branches").doc(branchId);
    const doc = await ref.get();
    
    if (!doc.exists) {
      throw new Error("Branch not found");
    }

    await ref.update({
      ...data,
      updatedAt: new Date(),
    });

    const updated = await ref.get();
    return {
      id: updated.id,
      ...updated.data(),
    };
  }

  /**
   * Delete a branch (soft delete)
   */
  async deleteBranch(branchId: string): Promise<void> {
    const ref = db.collection("branches").doc(branchId);
    const doc = await ref.get();
    
    if (!doc.exists) {
      throw new Error("Branch not found");
    }

    await ref.update({
      isActive: false,
      deletedAt: new Date(),
    });
  }

  /**
   * Get staff by user ID
   */
  async getStaffByUserId(userId: string): Promise<any | null> {
    const snapshot = await db.collection("staff")
      .where("userId", "==", userId)
      .where("isActive", "==", true)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const staffData: any = {
      id: doc.id,
      ...doc.data(),
    };
    
    // Return staff data including PIN hash for internal use
    return staffData;
  }

  /**
   * Get staff by user ID (public version without PIN)
   */
  async getStaffByUserIdPublic(userId: string): Promise<any | null> {
    const staff = await this.getStaffByUserId(userId);
    if (!staff) return null;
    
    // Remove sensitive data before returning
    const { staffPin, ...publicData } = staff;
    return publicData;
  }

  /**
   * Get all staff members (without PINs)
   */
  async getAllStaff(): Promise<any[]> {
    const snapshot = await db.collection("staff")
      .where("isActive", "==", true)
      .get();

    return snapshot.docs.map((doc) => {
      const data: any = {
        id: doc.id,
        ...doc.data(),
      };
      // Remove sensitive data
      const { staffPin, ...publicData } = data;
      return publicData;
    });
  }

  /**
   * Delete staff (soft delete)
   */
  async deleteStaff(staffId: string): Promise<void> {
    const ref = db.collection("staff").doc(staffId);
    const doc = await ref.get();
    
    if (!doc.exists) {
      throw new Error("Staff not found");
    }

    await ref.update({
      isActive: false,
      deletedAt: new Date(),
    });
  }

  /**
   * Create or update staff member
   */
  async createStaff(data: {
    userId: string;
    staffName: string;
    staffPin: string;
    role: string;
    branchId?: string;
  }): Promise<any> {
    const hashedPin = this.hashPin(data.staffPin);
    const ref = db.collection("staff").doc();
    
    const staffData = {
      ...data,
      staffPin: hashedPin,
      id: ref.id,
      isActive: true,
      createdAt: new Date(),
    };
    
    await ref.set(staffData);
    
    // Return without the hashed PIN
    const { staffPin, ...returnData } = staffData;
    return returnData;
  }

  /**
   * Update staff PIN
   */
  async updateStaffPin(staffId: string, newPin: string): Promise<void> {
    const hashedPin = this.hashPin(newPin);
    await db.collection("staff").doc(staffId).update({
      staffPin: hashedPin,
    });
  }

  /**
   * Update staff profile
   */
  async updateStaffProfile(staffId: string, data: {
    staffName?: string;
    role?: string;
    branchId?: string | null;
  }): Promise<any> {
    const ref = db.collection("staff").doc(staffId);
    const doc = await ref.get();
    
    if (!doc.exists) {
      throw new Error("Staff profile not found");
    }

    await ref.update({
      ...data,
      updatedAt: new Date(),
    });

    const updated = await ref.get();
    const updatedData: any = {
      id: updated.id,
      ...updated.data(),
    };
    
    // Remove sensitive data before returning
    const { staffPin, ...returnData } = updatedData;
    return returnData;
  }

  /**
   * Verify staff PIN
   */
  async verifyStaffPin(userId: string, pin: string): Promise<boolean> {
    const staff = await this.getStaffByUserId(userId);
    if (!staff) return false;
    return this.verifyPin(pin, staff.staffPin);
  }

  /**
   * Verify PIN against all staff members and return the matching staff
   */
  async verifyAnyStaffPin(pin: string): Promise<any | null> {
    const staffSnapshot = await db.collection("staff")
      .where("isActive", "==", true)
      .get();

    const hashedPin = this.hashPin(pin);
    
    for (const doc of staffSnapshot.docs) {
      const staffData = doc.data();
      if (staffData.staffPin === hashedPin) {
        return {
          id: doc.id,
          ...staffData,
        };
      }
    }
    
    return null;
  }

  /**
   * Initiate a branch transfer
   * Creates a transfer slip and generates QR code
   */
  async initiateTransfer(data: {
    productId: string;
    quantity: number;
    fromBranch: string;
    toBranch: string;
    requestedBy: string; // Staff ID
    pin: string;
    notes?: string;
  }): Promise<any> {
    // Validate that from and to branches are different
    if (data.fromBranch === data.toBranch) {
      throw new Error("Cannot transfer to the same branch");
    }

    // Verify staff exists and PIN
    const staffDoc = await db.collection("staff").doc(data.requestedBy).get();
    if (!staffDoc.exists) {
      throw new Error("Staff not found");
    }

    const staffData = staffDoc.data();
    if (!this.verifyPin(data.pin, staffData!.staffPin)) {
      throw new Error("Invalid PIN");
    }

    // Get product details
    const productDoc = await db.collection("products").doc(data.productId).get();
    if (!productDoc.exists) {
      throw new Error("Product not found");
    }

    const product = productDoc.data();

    // Check if enough quantity is available
    if ((product!.quantity || 0) < data.quantity) {
      throw new Error("Insufficient quantity available for transfer");
    }

    // Generate transfer ID
    const transferId = this.generateTransferId();

    // Create transfer slip
    const transferRef = db.collection("transferSlips").doc();
    const transferData: any = {
      id: transferRef.id,
      transferId,
      productId: data.productId,
      productName: product!.name,
      quantity: data.quantity,
      fromBranch: data.fromBranch,
      toBranch: data.toBranch,
      requestedBy: data.requestedBy,
      requestedTimestamp: new Date(),
      status: "in_transit",
      notes: data.notes || null,
      createdAt: new Date(),
    };

    // Generate QR code for transfer slip
    const qrCodeData = JSON.stringify({
      type: "transfer_slip",
      transferId,
      slipId: transferRef.id,
    });

    const qrCode = await QRCode.toDataURL(qrCodeData, {
      width: 300,
      margin: 2,
    });

    transferData.qrCode = qrCode;

    await transferRef.set(transferData);
    console.log("Transfer slip created in Firestore:", {
      id: transferRef.id,
      productId: transferData.productId,
      status: transferData.status,
      fromBranch: transferData.fromBranch,
      toBranch: transferData.toBranch,
    });

    // Deduct quantity from source branch (but don't update currentBranch yet - it will update on receive)
    await db.collection("products").doc(data.productId).update({
      quantity: (product!.quantity || 0) - data.quantity,
      updatedAt: new Date(),
    });

    // Log the transfer initiation (but not as a location change - that happens on receive)
    const logRef = db.collection("productLocationLogs").doc();
    await logRef.set({
      id: logRef.id,
      productId: data.productId,
      previousBranch: data.fromBranch,
      newBranch: data.toBranch,
      quantity: data.quantity,
      transferSlipId: transferRef.id,
      changedBy: data.requestedBy,
      reason: "transfer_initiated",
      timestamp: new Date(),
    });

    return {
      ...transferData,
      qrCodeImage: qrCode,
    };
  }

  /**
   * Get transfer slips with optional filters
   */
  async getTransferSlips(filters?: {
    status?: string;
    fromBranch?: string;
    toBranch?: string;
    productId?: string;
  }): Promise<any[]> {
    try {
      let query: FirebaseFirestore.Query = db.collection("transferSlips");

      if (filters?.status) {
        query = query.where("status", "==", filters.status);
      }
      if (filters?.fromBranch) {
        query = query.where("fromBranch", "==", filters.fromBranch);
      }
      if (filters?.toBranch) {
        query = query.where("toBranch", "==", filters.toBranch);
      }
      if (filters?.productId) {
        query = query.where("productId", "==", filters.productId);
      }

      // Try to order by createdAt, but if it fails due to missing index, fetch without ordering
      let snapshot;
      try {
        snapshot = await query.orderBy("createdAt", "desc").get();
      } catch (indexError: any) {
        console.warn("Firestore index missing for compound query, fetching without orderBy:", indexError.message);
        // Fallback: fetch without orderBy
        snapshot = await query.get();
      }

      // Enrich with staff and branch names
      const transfers = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
        
        // Get requested by staff name
        let requestedByName = "Unknown";
        if (data.requestedBy) {
          try {
            const staffDoc = await db.collection("staff").doc(data.requestedBy).get();
            if (staffDoc.exists) {
              requestedByName = staffDoc.data()?.staffName || "Unknown";
            }
          } catch (e) {
            console.error("Error fetching staff:", e);
          }
        }

        // Get received by staff name
        let receivedByName = null;
        if (data.receivedBy) {
          try {
            const staffDoc = await db.collection("staff").doc(data.receivedBy).get();
            if (staffDoc.exists) {
              receivedByName = staffDoc.data()?.staffName || "Unknown";
            }
          } catch (e) {
            console.error("Error fetching staff:", e);
          }
        }

        // Get branch names
        let fromBranchName = "Unknown";
        let toBranchName = "Unknown";
        
        try {
          if (data.fromBranch) {
            const fromBranchDoc = await db.collection("branches").doc(data.fromBranch).get();
            if (fromBranchDoc.exists) {
              fromBranchName = fromBranchDoc.data()?.name || "Unknown";
            }
          }
          
          if (data.toBranch) {
            const toBranchDoc = await db.collection("branches").doc(data.toBranch).get();
            if (toBranchDoc.exists) {
              toBranchName = toBranchDoc.data()?.name || "Unknown";
            }
          }
        } catch (e) {
          console.error("Error fetching branches:", e);
        }

        return {
          id: doc.id,
          ...data,
          requestedByName,
          receivedByName,
          fromBranchName,
          toBranchName,
        };
      })
    );

    // Sort by createdAt in memory if we couldn't do it in the query
    transfers.sort((a: any, b: any) => {
      const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt);
      const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt);
      return bTime.getTime() - aTime.getTime();
    });

    console.log(`getTransferSlips: Found ${transfers.length} transfers with filters:`, filters);
    return transfers;
    } catch (error) {
      console.error("Error in getTransferSlips:", error);
      throw error;
    }
  }

  /**
   * Get transfer slip by ID
   */
  async getTransferSlipById(slipId: string): Promise<any | null> {
    const doc = await db.collection("transferSlips").doc(slipId).get();
    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  /**
   * Get transfer slip by transfer ID
   */
  async getTransferSlipByTransferId(transferId: string): Promise<any | null> {
    const snapshot = await db.collection("transferSlips")
      .where("transferId", "==", transferId)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    };
  }

  /**
   * Receive a transfer (complete the transfer)
   */
  async receiveTransfer(data: {
    slipId: string;
    receivedBy: string; // Staff ID
    pin: string;
  }): Promise<any> {
    // Verify staff exists and PIN
    const staffDoc = await db.collection("staff").doc(data.receivedBy).get();
    if (!staffDoc.exists) {
      throw new Error("Staff not found");
    }

    const staffData = staffDoc.data();
    if (!this.verifyPin(data.pin, staffData!.staffPin)) {
      throw new Error("Invalid PIN");
    }

    // Get transfer slip
    const transferDoc = await db.collection("transferSlips").doc(data.slipId).get();
    if (!transferDoc.exists) {
      throw new Error("Transfer slip not found");
    }

    const transfer = transferDoc.data();

    // Check if already completed
    if (transfer!.status === "completed") {
      throw new Error("Transfer already completed");
    }

    if (transfer!.status === "cancelled") {
      throw new Error("Transfer has been cancelled");
    }

    // Verify receiving staff is from the destination branch
    if (staffData!.branchId !== transfer!.toBranch) {
      throw new Error("Staff must be from the destination branch to receive transfer");
    }

    // Get product
    const productDoc = await db.collection("products").doc(transfer!.productId).get();
    if (!productDoc.exists) {
      throw new Error("Product not found");
    }

    const product = productDoc.data();

    // Update transfer slip status
    await db.collection("transferSlips").doc(data.slipId).update({
      status: "completed",
      receivedBy: data.receivedBy,
      receivedTimestamp: new Date(),
    });

    // Update product: add quantity and update currentBranch to destination
    await db.collection("products").doc(transfer!.productId).update({
      quantity: (product!.quantity || 0) + transfer!.quantity,
      currentBranch: transfer!.toBranch,
      updatedAt: new Date(),
    });

    // Log the completion
    const logRef = db.collection("productLocationLogs").doc();
    await logRef.set({
      id: logRef.id,
      productId: transfer!.productId,
      previousBranch: transfer!.fromBranch,
      newBranch: transfer!.toBranch,
      quantity: transfer!.quantity,
      transferSlipId: data.slipId,
      changedBy: data.receivedBy,
      reason: "transfer_complete",
      timestamp: new Date(),
    });

    return {
      success: true,
      message: "Transfer completed successfully",
      transfer: {
        id: transferDoc.id,
        ...transfer,
        status: "completed",
        receivedBy: data.receivedBy,
        receivedTimestamp: new Date(),
      },
    };
  }

  /**
   * Cancel a transfer
   */
  async cancelTransfer(slipId: string, cancelledBy: string, pin: string): Promise<any> {
    // Verify staff exists and PIN
    const staffDoc = await db.collection("staff").doc(cancelledBy).get();
    if (!staffDoc.exists) {
      throw new Error("Staff not found");
    }

    const staffData = staffDoc.data();
    if (!this.verifyPin(pin, staffData!.staffPin)) {
      throw new Error("Invalid PIN");
    }

    // Get transfer slip
    const transferDoc = await db.collection("transferSlips").doc(slipId).get();
    if (!transferDoc.exists) {
      throw new Error("Transfer slip not found");
    }

    const transfer = transferDoc.data();

    if (transfer!.status === "completed") {
      throw new Error("Cannot cancel completed transfer");
    }

    if (transfer!.status === "cancelled") {
      throw new Error("Transfer already cancelled");
    }

    // Restore product quantity
    const productDoc = await db.collection("products").doc(transfer!.productId).get();
    const product = productDoc.data();

    await db.collection("products").doc(transfer!.productId).update({
      quantity: (product!.quantity || 0) + transfer!.quantity,
      updatedAt: new Date(),
    });

    // Update transfer slip
    await db.collection("transferSlips").doc(slipId).update({
      status: "cancelled",
    });

    return {
      success: true,
      message: "Transfer cancelled successfully",
    };
  }

  /**
   * Get product location history
   */
  async getProductLocationHistory(productId: string): Promise<any[]> {
    const snapshot = await db.collection("productLocationLogs")
      .where("productId", "==", productId)
      .orderBy("timestamp", "desc")
      .get();

    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with staff names and branch names
    const enrichedLogs = await Promise.all(logs.map(async (log: any) => {
      const enriched: any = { ...log };

      // Get staff name for changedBy
      if (log.changedBy) {
        try {
          const staffDoc = await db.collection("staff").doc(log.changedBy).get();
          if (staffDoc.exists) {
            const staffData = staffDoc.data();
            enriched.staffName = staffData?.staffName || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching staff:", e);
          enriched.staffName = "Unknown";
        }
      }

      // Get branch names for previousBranch
      if (log.previousBranch) {
        try {
          const branchDoc = await db.collection("branches").doc(log.previousBranch).get();
          if (branchDoc.exists) {
            enriched.previousBranchName = branchDoc.data()?.name || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching previous branch:", e);
          enriched.previousBranchName = "Unknown";
        }
      }

      // Get branch names for newBranch
      if (log.newBranch) {
        try {
          const branchDoc = await db.collection("branches").doc(log.newBranch).get();
          if (branchDoc.exists) {
            enriched.newBranchName = branchDoc.data()?.name || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching new branch:", e);
          enriched.newBranchName = "Unknown";
        }
      }

      return enriched;
    }));

    return enrichedLogs;
  }

  /**
   * Get all location history across all products
   */
  async getAllLocationHistory(): Promise<any[]> {
    const snapshot = await db.collection("productLocationLogs")
      .orderBy("timestamp", "desc")
      .limit(500) // Limit to recent 500 records
      .get();

    const logs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Enrich with staff names, branch names, and product names
    const enrichedLogs = await Promise.all(logs.map(async (log: any) => {
      const enriched: any = { ...log };

      // Get product name
      if (log.productId) {
        try {
          const productDoc = await db.collection("products").doc(log.productId).get();
          if (productDoc.exists) {
            enriched.productName = productDoc.data()?.name || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching product:", e);
          enriched.productName = "Unknown";
        }
      }

      // Get staff name for changedBy
      if (log.changedBy) {
        try {
          const staffDoc = await db.collection("staff").doc(log.changedBy).get();
          if (staffDoc.exists) {
            const staffData = staffDoc.data();
            enriched.staffName = staffData?.staffName || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching staff:", e);
          enriched.staffName = "Unknown";
        }
      }

      // Get branch names for previousBranch
      if (log.previousBranch) {
        try {
          const branchDoc = await db.collection("branches").doc(log.previousBranch).get();
          if (branchDoc.exists) {
            enriched.previousBranchName = branchDoc.data()?.name || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching previous branch:", e);
          enriched.previousBranchName = "Unknown";
        }
      }

      // Get branch names for newBranch
      if (log.newBranch) {
        try {
          const branchDoc = await db.collection("branches").doc(log.newBranch).get();
          if (branchDoc.exists) {
            enriched.newBranchName = branchDoc.data()?.name || "Unknown";
          }
        } catch (e) {
          console.error("Error fetching new branch:", e);
          enriched.newBranchName = "Unknown";
        }
      }

      return enriched;
    }));

    return enrichedLogs;
  }

  /**
   * Clear product location history
   */
  async clearProductLocationHistory(productId: string): Promise<void> {
    const snapshot = await db.collection("productLocationLogs")
      .where("productId", "==", productId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  /**
   * Clear all transfer history (transfer slips and location logs)
   */
  async clearAllTransferHistory(): Promise<void> {
    // Clear all transfer slips
    const transfersSnapshot = await db.collection("transferSlips").get();
    const transfersBatch = db.batch();
    transfersSnapshot.docs.forEach((doc) => {
      transfersBatch.delete(doc.ref);
    });
    await transfersBatch.commit();

    // Clear all location logs
    const logsSnapshot = await db.collection("productLocationLogs").get();
    const logsBatch = db.batch();
    logsSnapshot.docs.forEach((doc) => {
      logsBatch.delete(doc.ref);
    });
    await logsBatch.commit();
  }
}

export const branchTransferService = new BranchTransferService();
