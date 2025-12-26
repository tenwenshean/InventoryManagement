import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cache } from "./cache";
import { auth, db } from "./db"; // ✅ fixed import
import { mlService } from "./ml-service";
import { emailService } from "./email-service";
import { cacheMiddleware } from "./cache-middleware";
import Stripe from "stripe";
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
          companyName: '', // Initialize empty company name
          timezone: 'UTC', // Initialize default timezone
          createdAt: new Date().toISOString(),
        });
      } else {
        // Update email if it changed
        const userData = userDoc.data();
        if (userData?.email !== email) {
          await userRef.set({
            email,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
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
  app.get("/api/categories", isAuthenticated, cacheMiddleware(300000), async (req: any, res) => {
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

  app.delete("/api/categories/:id", isAuthenticated, async (req: any, res) => {
    try {
      const categoryId = req.params.id;
      await storage.deleteCategory(categoryId);
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // ===================== USER SETTINGS ROUTES =====================
  app.put("/api/users/:userId/settings", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { 
        companyName, 
        timezone,
        shopSlug,
        shopDescription,
        shopBannerUrl,
        shopLogoUrl,
        shopEmail,
        shopPhone,
        shopAddress,
        shopWebsite,
        shopFacebook,
        shopInstagram,
        shopTwitter
      } = req.body;
      
      // Ensure user can only update their own settings
      if (userId !== req.user.uid) {
        return res.status(403).json({ message: "Unauthorized to update this user's settings" });
      }
      
      // Update user document in Firestore
      await db.collection('users').doc(userId).set({
        settings: {
          companyName: companyName || '',
          timezone: timezone || 'UTC',
          shopSlug: shopSlug || '',
          shopDescription: shopDescription || '',
          shopBannerUrl: shopBannerUrl || '',
          shopLogoUrl: shopLogoUrl || '',
          shopEmail: shopEmail || '',
          shopPhone: shopPhone || '',
          shopAddress: shopAddress || '',
          shopWebsite: shopWebsite || '',
          shopFacebook: shopFacebook || '',
          shopInstagram: shopInstagram || '',
          shopTwitter: shopTwitter || '',
          updatedAt: new Date()
        },
        companyName: companyName || '',
        shopSlug: shopSlug || '',
        shopDescription: shopDescription || '',
        shopBannerUrl: shopBannerUrl || '',
        shopLogoUrl: shopLogoUrl || '',
        updatedAt: new Date()
      }, { merge: true });
      
      res.json({ message: "Settings updated successfully" });
    } catch (error) {
      console.error("Error updating user settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // Delete all user data (reset account)
  app.delete("/api/users/:userId/data", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;

      // Ensure user can only delete their own data
      if (req.user.uid !== userId) {
        return res.status(403).json({ message: "Forbidden: Cannot delete other user's data" });
      }

      console.log(`[DELETE USER DATA] Deleting all data for user: ${userId}`);

      // Delete all products
      const productsSnapshot = await db.collection("products").where("userId", "==", userId).get();
      const productDeletes = productsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(productDeletes);
      console.log(`[DELETE USER DATA] Deleted ${productsSnapshot.size} products`);

      // Delete all orders where user is the customer
      const customerOrdersSnapshot = await db.collection("orders").where("customerId", "==", userId).get();
      const customerOrderDeletes = customerOrdersSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(customerOrderDeletes);
      console.log(`[DELETE USER DATA] Deleted ${customerOrdersSnapshot.size} orders as customer`);

      // Delete all orders where user is the seller
      // Query by sellerId field directly instead of fetching all orders
      let sellerOrderDeletes: Promise<any>[] = [];
      try {
        const sellerOrdersSnapshot = await db.collection("orders")
          .where("sellerId", "==", userId)
          .get();
        
        // Filter out orders already deleted as customer to avoid duplicates
        const customerOrderIds = new Set(customerOrdersSnapshot.docs.map(doc => doc.id));
        sellerOrderDeletes = sellerOrdersSnapshot.docs
          .filter(doc => !customerOrderIds.has(doc.id))
          .map(doc => doc.ref.delete());
        
        await Promise.all(sellerOrderDeletes);
        console.log(`[DELETE USER DATA] Deleted ${sellerOrderDeletes.length} orders as seller`);
      } catch (error: any) {
        console.log(`[DELETE USER DATA] No seller orders found (index may not exist):`, error.message);
      }

      // Delete all accounting entries
      const accountingSnapshot = await db.collection("accountingEntries").where("userId", "==", userId).get();
      const accountingDeletes = accountingSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(accountingDeletes);
      console.log(`[DELETE USER DATA] Deleted ${accountingSnapshot.size} accounting entries`);

      // Delete all QR codes (if stored separately)
      const qrCodesSnapshot = await db.collection("qrcodes").where("userId", "==", userId).get();
      const qrCodeDeletes = qrCodesSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(qrCodeDeletes);
      console.log(`[DELETE USER DATA] Deleted ${qrCodesSnapshot.size} QR codes`);

      // Delete customer profile
      let customerProfileDeleted = false;
      try {
        const customerProfileDoc = await db.collection("customerProfiles").doc(userId).get();
        if (customerProfileDoc.exists) {
          await customerProfileDoc.ref.delete();
          customerProfileDeleted = true;
          console.log(`[DELETE USER DATA] Deleted customer profile`);
        }
      } catch (error) {
        console.error(`[DELETE USER DATA] Error deleting customer profile:`, error);
      }

      // Reset user settings (keep the user account but clear settings)
      await db.collection("users").doc(userId).update({
        settings: {},
        companyName: "",
        businessAddress: "",
        phoneNumber: "",
        updatedAt: new Date(),
      });
      console.log(`[DELETE USER DATA] Reset user settings`);

      console.log(`[DELETE USER DATA] Successfully deleted all data for user: ${userId}`);
      res.json({ 
        message: "All account data deleted successfully",
        deletedCounts: {
          products: productsSnapshot.size,
          orders: customerOrdersSnapshot.size + sellerOrderDeletes.length,
          accountingEntries: accountingSnapshot.size,
          qrCodes: qrCodesSnapshot.size,
          customerProfile: customerProfileDeleted ? 1 : 0,
        }
      });
    } catch (error) {
      console.error("[DELETE USER DATA] Error deleting user data:", error);
      console.error("[DELETE USER DATA] Error stack:", (error as Error).stack);
      res.status(500).json({ 
        message: "Failed to delete user data",
        error: (error as Error).message 
      });
    }
  });

  // Get user by ID (public endpoint for shop pages)
  app.get("/api/users/:userId", async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      console.log('GET /api/users/:userId - Fetching user:', userId);
      
      const userDoc = await db.collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        console.log('User document not found for userId:', userId);
        return res.status(404).json({ message: 'User not found' });
      }

      const userData = userDoc.data();
      const settings = userData?.settings || {};
      
      console.log('User data retrieved:', {
        id: userDoc.id,
        hasCompanyName: !!userData?.companyName,
        hasSettings: !!userData?.settings
      });
      
      // Return public shop information
      const response = {
        id: userDoc.id,
        companyName: userData?.companyName || 'Shop',
        email: userData?.email,
        shopDescription: userData?.shopDescription || settings.shopDescription || '',
        shopBannerUrl: userData?.shopBannerUrl || settings.shopBannerUrl || '',
        shopLogoUrl: userData?.shopLogoUrl || settings.shopLogoUrl || '',
        shopEmail: settings.shopEmail || '',
        shopPhone: settings.shopPhone || '',
        shopAddress: settings.shopAddress || '',
        shopWebsite: settings.shopWebsite || '',
        shopFacebook: settings.shopFacebook || '',
        shopInstagram: settings.shopInstagram || '',
        shopTwitter: settings.shopTwitter || ''
      };
      
      console.log('Returning user data for shop page');
      res.json(response);
    } catch (error: any) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user', error: error.message });
    }
  });

  // Get shop by slug (company name) - public endpoint
  app.get("/api/shops/by-slug/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      
      console.log('GET /api/shops/by-slug - Fetching shop by slug:', slug);
      
      // Query users by shopSlug
      const usersSnapshot = await db.collection('users')
        .where('shopSlug', '==', slug)
        .limit(1)
        .get();
      
      let matchedUser = null;
      if (!usersSnapshot.empty) {
        const doc = usersSnapshot.docs[0];
        matchedUser = { id: doc.id, ...doc.data() };
      }
      
      if (!matchedUser) {
        console.log('Shop not found for slug:', slug);
        return res.status(404).json({ message: 'Shop not found' });
      }
      
      const userData = matchedUser as any;
      const settings = userData?.settings || {};
      
      const response = {
        id: userData.id,
        companyName: userData.companyName || 'Shop',
        email: userData.email,
        shopSlug: userData.shopSlug || settings.shopSlug || '',
        shopDescription: userData.shopDescription || settings.shopDescription || '',
        shopBannerUrl: userData.shopBannerUrl || settings.shopBannerUrl || '',
        shopLogoUrl: userData.shopLogoUrl || settings.shopLogoUrl || '',
        shopEmail: settings.shopEmail || '',
        shopPhone: settings.shopPhone || '',
        shopAddress: settings.shopAddress || '',
        shopWebsite: settings.shopWebsite || '',
        shopFacebook: settings.shopFacebook || '',
        shopInstagram: settings.shopInstagram || '',
        shopTwitter: settings.shopTwitter || ''
      };
      
      console.log('Shop found:', response.companyName);
      res.json(response);
    } catch (error: any) {
      console.error('Error fetching shop by slug:', error);
      res.status(500).json({ message: 'Failed to fetch shop', error: error.message });
    }
  });

  // Search shops by query - public endpoint
  app.get("/api/shops/search", async (req: any, res) => {
    try {
      const query = (req.query.query as string || '').toLowerCase().trim();
      
      if (!query || query.length < 2) {
        return res.json([]);
      }

      console.log('GET /api/shops/search - Searching for:', query);
      
      // Get all enterprise users
      const usersSnapshot = await db.collection('users')
        .where('userType', '==', 'enterprise')
        .get();
      
      const shops = [];
      for (const doc of usersSnapshot.docs) {
        const userData = doc.data();
        const companyName = (userData.companyName || '').toLowerCase();
        const shopDescription = (userData.shopDescription || userData.settings?.shopDescription || '').toLowerCase();
        const shopSlug = userData.shopSlug || userData.settings?.shopSlug || '';
        
        // Fuzzy search: match if query appears in company name or description
        if (companyName.includes(query) || shopDescription.includes(query)) {
          shops.push({
            id: doc.id,
            companyName: userData.companyName || 'Shop',
            email: userData.email || '',
            shopSlug: shopSlug,
            shopDescription: userData.shopDescription || userData.settings?.shopDescription || '',
            shopLogoUrl: userData.shopLogoUrl || userData.settings?.shopLogoUrl || ''
          });
        }
      }
      
      // Sort by relevance (company name matches first, then by alphabetical)
      shops.sort((a, b) => {
        const aNameMatch = a.companyName.toLowerCase().startsWith(query);
        const bNameMatch = b.companyName.toLowerCase().startsWith(query);
        
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        
        return a.companyName.localeCompare(b.companyName);
      });
      
      console.log(`Found ${shops.length} matching shops`);
      res.json(shops.slice(0, 10)); // Limit to 10 results
    } catch (error: any) {
      console.error('Error searching shops:', error);
      res.status(500).json({ message: 'Failed to search shops', error: error.message });
    }
  });

  // ===================== SUBSCRIPTION ROUTES =====================
  app.post("/api/subscriptions", async (req: any, res) => {
    try {
      const { customerId, sellerId } = req.body;

      // Check if already subscribed
      const existingSubscription = await db.collection('subscriptions')
        .where('customerId', '==', customerId)
        .where('sellerId', '==', sellerId)
        .limit(1)
        .get();

      if (!existingSubscription.empty) {
        return res.status(400).json({ message: 'Already subscribed to this shop' });
      }

      const subRef = db.collection('subscriptions').doc();
      await subRef.set({
        id: subRef.id,
        customerId,
        sellerId,
        createdAt: new Date().toISOString()
      });

      res.status(201).json({ message: 'Subscribed successfully', id: subRef.id });
    } catch (error: any) {
      console.error('Error subscribing:', error);
      res.status(500).json({ message: 'Failed to subscribe' });
    }
  });

  app.delete("/api/subscriptions", async (req: any, res) => {
    try {
      const { customerId, sellerId } = req.body;

      const subscriptionSnapshot = await db.collection('subscriptions')
        .where('customerId', '==', customerId)
        .where('sellerId', '==', sellerId)
        .limit(1)
        .get();

      if (subscriptionSnapshot.empty) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      await db.collection('subscriptions').doc(subscriptionSnapshot.docs[0].id).delete();
      res.json({ message: 'Unsubscribed successfully' });
    } catch (error: any) {
      console.error('Error unsubscribing:', error);
      res.status(500).json({ message: 'Failed to unsubscribe' });
    }
  });

  app.get("/api/subscriptions/check", async (req: any, res) => {
    try {
      const { customerId, sellerId } = req.query;

      const subscriptionSnapshot = await db.collection('subscriptions')
        .where('customerId', '==', customerId as string)
        .where('sellerId', '==', sellerId as string)
        .limit(1)
        .get();

      res.json({ isSubscribed: !subscriptionSnapshot.empty });
    } catch (error: any) {
      console.error('Error checking subscription:', error);
      res.status(500).json({ message: 'Failed to check subscription' });
    }
  });

  app.get("/api/subscriptions/count", async (req: any, res) => {
    try {
      const { sellerId } = req.query;
      
      const subscriptionsSnapshot = await db.collection('subscriptions')
        .where('sellerId', '==', sellerId as string)
        .get();

      res.json({ count: subscriptionsSnapshot.size });
    } catch (error: any) {
      console.error('Error getting subscriber count:', error);
      res.status(500).json({ message: 'Failed to get subscriber count' });
    }
  });

  app.get("/api/subscriptions/list", async (req: any, res) => {
    try {
      const { sellerId } = req.query;
      
      const subscriptionsSnapshot = await db.collection('subscriptions')
        .where('sellerId', '==', sellerId as string)
        .get();

      const subscriptions = await Promise.all(
        subscriptionsSnapshot.docs.map(async (doc) => {
          const subData = doc.data();
          // Fetch customer details
          const userDoc = await db.collection('users').doc(subData.customerId).get();
          const userData = userDoc.data();
          
          return {
            id: doc.id,
            customerId: subData.customerId,
            customerName: userData?.displayName || userData?.email || 'Unknown User',
            customerEmail: userData?.email || '',
            subscribedAt: subData.createdAt
          };
        })
      );

      res.json(subscriptions);
    } catch (error: any) {
      console.error('Error getting subscribers:', error);
      res.status(500).json({ message: 'Failed to get subscribers' });
    }
  });

  // ===================== COUPON ROUTES =====================
  app.get("/api/coupons", async (req: any, res) => {
    try {
      const { sellerId } = req.query;
      
      const couponsSnapshot = await db.collection('coupons')
        .where('sellerId', '==', sellerId as string)
        .get();

      const now = new Date();
      const validCoupons: any[] = [];
      const expiredCouponIds: string[] = [];

      couponsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const expiresAt = data.expiresAt?.toDate?.() || (data.expiresAt ? new Date(data.expiresAt) : null);
        
        // Check if coupon is expired
        if (expiresAt && expiresAt < now) {
          // Mark for deletion
          expiredCouponIds.push(doc.id);
        } else {
          validCoupons.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            expiresAt: expiresAt?.toISOString() || null
          });
        }
      });

      // Delete expired coupons in background
      if (expiredCouponIds.length > 0) {
        console.log(`[COUPONS] Deleting ${expiredCouponIds.length} expired coupons`);
        const batch = db.batch();
        expiredCouponIds.forEach(id => {
          batch.delete(db.collection('coupons').doc(id));
        });
        batch.commit().catch((err: any) => console.error('Error deleting expired coupons:', err));
      }

      // Sort by createdAt descending
      validCoupons.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB.getTime() - dateA.getTime();
      });

      res.json(validCoupons);
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      res.status(500).json({ message: 'Failed to fetch coupons' });
    }
  });

  app.post("/api/coupons", async (req: any, res) => {
    try {
      const { code, sellerId, discountType, discountValue, minPurchase, applicableProducts, maxUses, expiresAt, isActive, notifySubscribers } = req.body;

      // Check if code already exists
      const existingCoupon = await db.collection('coupons')
        .where('code', '==', code.toUpperCase())
        .limit(1)
        .get();

      if (!existingCoupon.empty) {
        return res.status(400).json({ message: 'Coupon code already exists' });
      }

      const couponRef = db.collection('coupons').doc();
      const couponData = {
        id: couponRef.id,
        code: code.toUpperCase(),
        sellerId,
        discountType,
        discountValue,
        minPurchase: minPurchase || null,
        applicableProducts: applicableProducts || null,
        maxUses: maxUses || null,
        usedCount: 0,
        expiresAt: expiresAt || null,
        isActive: isActive !== false,
        createdAt: new Date().toISOString()
      };

      await couponRef.set(couponData);

      // Notify subscribers if requested
      if (notifySubscribers) {
        const subscriptionsSnapshot = await db.collection('subscriptions')
          .where('sellerId', '==', sellerId)
          .get();

        const notifications = subscriptionsSnapshot.docs.map(subDoc => {
          const notifRef = db.collection('notifications').doc();
          return notifRef.set({
            id: notifRef.id,
            userId: subDoc.data().customerId,
            type: 'coupon',
            title: 'New Coupon Available!',
            message: `Use code ${code} to get ${discountType === 'percentage' ? discountValue + '%' : '$' + discountValue} off!`,
            data: JSON.stringify({ couponCode: code, couponId: couponRef.id }),
            isRead: false,
            createdAt: new Date().toISOString()
          });
        });

        await Promise.all(notifications);
      }

      res.status(201).json(couponData);
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      res.status(500).json({ message: 'Failed to create coupon' });
    }
  });

  app.delete("/api/coupons/:couponId", async (req: any, res) => {
    try {
      const { couponId } = req.params;
      await db.collection('coupons').doc(couponId).delete();
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting coupon:', error);
      res.status(500).json({ message: 'Failed to delete coupon' });
    }
  });

  app.patch("/api/coupons/:couponId", async (req: any, res) => {
    try {
      const { couponId } = req.params;
      const { isActive } = req.body;
      
      await db.collection('coupons').doc(couponId).update({ isActive });
      
      const updatedDoc = await db.collection('coupons').doc(couponId).get();
      res.json({ id: couponId, ...updatedDoc.data() });
    } catch (error: any) {
      console.error('Error toggling coupon:', error);
      res.status(500).json({ message: 'Failed to update coupon' });
    }
  });

  app.post("/api/coupons/validate", async (req: any, res) => {
    try {
      const { code, cartTotal, productIds } = req.body;

      const couponSnapshot = await db.collection('coupons')
        .where('code', '==', code.toUpperCase())
        .limit(1)
        .get();

      if (couponSnapshot.empty) {
        return res.status(404).json({ message: 'Invalid coupon code' });
      }

      const couponDoc = couponSnapshot.docs[0];
      const coupon: any = { id: couponDoc.id, ...couponDoc.data() };

      // Check if coupon is active
      if (!coupon.isActive) {
        return res.status(400).json({ message: 'This coupon is no longer active' });
      }

      // Check expiry
      if (coupon.expiresAt) {
        const expiry = coupon.expiresAt.toDate ? coupon.expiresAt.toDate() : new Date(coupon.expiresAt);
        if (expiry < new Date()) {
          return res.status(400).json({ message: 'This coupon has expired' });
        }
      }

      // Check max uses
      if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
        return res.status(400).json({ message: 'This coupon has reached its maximum usage limit' });
      }

      // Check minimum purchase
      if (coupon.minPurchase && parseFloat(cartTotal) < parseFloat(coupon.minPurchase)) {
        return res.status(400).json({ 
          message: `Minimum purchase of $${parseFloat(coupon.minPurchase).toFixed(2)} required` 
        });
      }

      // Check applicable products
      if (coupon.applicableProducts) {
        const applicableProductIds = JSON.parse(coupon.applicableProducts);
        const hasApplicableProduct = productIds.some((id: string) => applicableProductIds.includes(id));
        
        if (!hasApplicableProduct) {
          return res.status(400).json({ message: 'This coupon is not applicable to items in your cart' });
        }
      }

      res.json({
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minPurchase: coupon.minPurchase,
        applicableProducts: coupon.applicableProducts,
        expiresAt: coupon.expiresAt
      });
    } catch (error: any) {
      console.error('Error validating coupon:', error);
      res.status(500).json({ message: 'Failed to validate coupon' });
    }
  });

  // ===================== NOTIFICATION ROUTES =====================
  app.get("/api/notifications", async (req: any, res) => {
    try {
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      const notificationsSnapshot = await db.collection('notifications')
        .where('userId', '==', userId as string)
        .get();

      // Sort by createdAt desc
      const notifications = notificationsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a: any, b: any) => {
          const aDate = new Date(a.createdAt).getTime();
          const bDate = new Date(b.createdAt).getTime();
          return bDate - aDate;
        })
        .slice(0, 50);

      res.json(notifications);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  app.post("/api/notifications/mark-read", async (req: any, res) => {
    try {
      const { notificationIds } = req.body;

      const updates = notificationIds.map((notificationId: string) => 
        db.collection('notifications').doc(notificationId).update({ isRead: true })
      );

      await Promise.all(updates);
      res.json({ message: 'Notifications marked as read' });
    } catch (error: any) {
      console.error('Error marking notifications as read:', error);
      res.status(500).json({ message: 'Failed to mark notifications as read' });
    }
  });

  // Test email endpoint - allows testing in dev mode without auth
  app.post("/api/notifications/test-email", async (req: any, res) => {
    try {
      const { type, email, userId } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email address is required' });
      }

      // In development OR if TEST_SECRET matches, allow testing without auth
      const isDevMode = process.env.NODE_ENV === 'development';
      const hasTestSecret = req.headers['x-test-secret'] === process.env.TEST_SECRET;
      
      let userIdToUse = userId;
      if (!userIdToUse && !isDevMode && !hasTestSecret) {
        // Require authentication
        if (!req.user || !req.user.uid) {
          return res.status(401).json({ message: 'Unauthorized - Missing token or test secret' });
        }
        userIdToUse = req.user.uid;
      }

      console.log('[TEST-EMAIL] Sending test email to:', email, 'for user:', userIdToUse);

      // Get user settings for company name
      const userDoc = await db.collection('users').doc(userIdToUse).get();
      const userData = userDoc.data();
      const companyName = userData?.settings?.companyName || 'Your Company';

      let success = false;

      if (type === 'daily-report') {
        // Fetch real orders data (last 24 hours or all if none)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const ordersSnapshot = await db.collection('orders')
          .where('userId', '==', userIdToUse)
          .where('createdAt', '>=', oneDayAgo)
          .get();

        // If no orders in last 24h, get recent orders
        let orders = ordersSnapshot.docs;
        if (orders.length === 0) {
          const recentOrdersSnapshot = await db.collection('orders')
            .where('userId', '==', userIdToUse)
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();
          orders = recentOrdersSnapshot.docs;
        }

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, doc) => {
          const order = doc.data();
          return sum + (order.totalAmount || 0);
        }, 0);

        // Count unique customers
        const uniqueCustomers = new Set(orders.map(doc => doc.data().customerId)).size;

        // Get top products from orders
        const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        orders.forEach(doc => {
          const order = doc.data();
          (order.items || []).forEach((item: any) => {
            const key = item.productId || item.name;
            if (!productSales[key]) {
              productSales[key] = { name: item.name || 'Unknown', quantity: 0, revenue: 0 };
            }
            productSales[key].quantity += item.quantity || 0;
            productSales[key].revenue += (item.price || 0) * (item.quantity || 0);
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        // Calculate total items sold
        const totalItemsSold = Object.values(productSales).reduce((sum, p) => sum + p.quantity, 0);

        // Fetch real low stock products
        const productsSnapshot = await db.collection('products')
          .where('userId', '==', userIdToUse)
          .get();

        const lowStockProducts = productsSnapshot.docs
          .map(doc => {
            const product = doc.data();
            return {
              name: product.name,
              currentStock: product.stock || 0,
              lowStockThreshold: product.lowStockThreshold || 10
            };
          })
          .filter(p => p.currentStock <= p.lowStockThreshold)
          .sort((a, b) => a.currentStock - b.currentStock)
          .slice(0, 10);

        // Get current date
        const today = new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });

        // Send daily report with real data
        success = await emailService.sendDailyReport(
          email,
          companyName,
          {
            date: today,
            totalSales: totalItemsSold,
            totalOrders: totalOrders || 0,
            totalRevenue: totalRevenue || 0,
            lowStockCount: lowStockProducts.length,
            topProducts: topProducts.length > 0 ? topProducts : [
              { name: 'No sales data yet', quantity: 0, revenue: 0 }
            ],
            lowStockProducts: lowStockProducts
          }
        );
      } else if (type === 'weekly-summary') {
        // Fetch real orders data (last 7 days or all if none)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const ordersSnapshot = await db.collection('orders')
          .where('userId', '==', userIdToUse)
          .where('createdAt', '>=', sevenDaysAgo)
          .get();

        // If no orders in last 7 days, get recent orders
        let orders = ordersSnapshot.docs;
        if (orders.length === 0) {
          const recentOrdersSnapshot = await db.collection('orders')
            .where('userId', '==', userIdToUse)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();
          orders = recentOrdersSnapshot.docs;
        }

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, doc) => {
          const order = doc.data();
          return sum + (order.totalAmount || 0);
        }, 0);

        const uniqueCustomers = new Set(orders.map(doc => doc.data().customerId)).size;

        // Get top products from orders
        const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        orders.forEach(doc => {
          const order = doc.data();
          (order.items || []).forEach((item: any) => {
            const key = item.productId || item.name;
            if (!productSales[key]) {
              productSales[key] = { name: item.name || 'Unknown', quantity: 0, revenue: 0 };
            }
            productSales[key].quantity += item.quantity || 0;
            productSales[key].revenue += (item.price || 0) * (item.quantity || 0);
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        // Fetch inventory data
        const productsSnapshot = await db.collection('products')
          .where('userId', '==', userIdToUse)
          .get();

        const inventoryValue = productsSnapshot.docs.reduce((sum, doc) => {
          const product = doc.data();
          return sum + ((product.stock || 0) * (product.price || 0));
        }, 0);

        const lowStockProducts = productsSnapshot.docs
          .map(doc => {
            const product = doc.data();
            return {
              name: product.name,
              currentStock: product.stock || 0,
              lowStockThreshold: product.lowStockThreshold || 10
            };
          })
          .filter(p => p.currentStock <= p.lowStockThreshold)
          .sort((a, b) => a.currentStock - b.currentStock)
          .slice(0, 10);

        const lowStockCount = lowStockProducts.length;
        const outOfStockCount = productsSnapshot.docs.filter(doc => (doc.data().stock || 0) === 0).length;

        // Calculate week range and average order value for weekly summary
        const now = new Date();
        const lastWeekStart = new Date(now);
        lastWeekStart.setDate(now.getDate() - 7);
        const weekRange = `${lastWeekStart.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} - ${now.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}`;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Calculate total sales (quantity of items sold)
        const totalSales = topProducts.reduce((sum, p) => sum + p.quantity, 0);

        // Send weekly summary with real data
        success = await emailService.sendWeeklySummary(
          email,
          companyName,
          {
            weekRange,
            totalSales: totalSales || 0,
            totalOrders: totalOrders || 0,
            totalRevenue: totalRevenue || 0,
            averageOrderValue: averageOrderValue || 0,
            topProducts: topProducts.length > 0 ? topProducts : [
              { name: 'No sales data yet', quantity: 0, revenue: 0 }
            ],
            inventoryStatus: {
              totalProducts: productsSnapshot.docs.length,
              lowStockCount: lowStockCount,
              outOfStockCount: outOfStockCount
            }
          }
        );
      } else {
        return res.status(400).json({ 
          message: "Invalid email type. Use 'daily-report' or 'weekly-summary'" 
        });
      }

      if (success) {
        res.json({ 
          message: 'Test email sent successfully!', 
          email, 
          type,
          note: 'Check your email inbox (and spam folder)'
        });
      } else {
        res.status(500).json({ 
          message: 'Failed to send test email. Check server logs and email configuration.' 
        });
      }
    } catch (error: any) {
      console.error('[TEST-EMAIL] Error:', error);
      res.status(500).json({ message: 'Failed to send test email: ' + error.message });
    }
  });

  app.delete("/api/notifications/:notificationId", async (req: any, res) => {
    try {
      const { notificationId } = req.params;
      await db.collection('notifications').doc(notificationId).delete();
      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting notification:', error);
      res.status(500).json({ message: 'Failed to delete notification' });
    }
  });

  app.post("/api/notifications/broadcast", async (req: any, res) => {
    try {
      const { sellerId, title, message } = req.body;

      // Get all subscribers
      const subscriptionsSnapshot = await db.collection('subscriptions')
        .where('sellerId', '==', sellerId)
        .get();

      if (subscriptionsSnapshot.empty) {
        return res.status(400).json({ message: 'No subscribers found' });
      }

      // Create notifications for all subscribers
      const notifications = subscriptionsSnapshot.docs.map(subDoc => {
        const notifRef = db.collection('notifications').doc();
        return notifRef.set({
          id: notifRef.id,
          userId: subDoc.data().customerId,
          type: 'broadcast',
          title,
          message,
          data: JSON.stringify({ sellerId }),
          isRead: false,
          createdAt: new Date().toISOString()
        });
      });

      await Promise.all(notifications);

      res.json({ 
        message: `Message sent to ${subscriptionsSnapshot.size} subscriber${subscriptionsSnapshot.size !== 1 ? 's' : ''}`,
        count: subscriptionsSnapshot.size 
      });
    } catch (error: any) {
      console.error('Error broadcasting message:', error);
      res.status(500).json({ message: 'Failed to send message' });
    }
  });

  // ===================== PRODUCT ROUTES =====================
  app.get("/api/products", isAuthenticated, cacheMiddleware(90000), async (req: any, res) => {
    try {
      const search = req.query.search as string;
      const products = await storage.getProducts(search, req.user.uid);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Public endpoint for customer shop - supports filtering by seller
  app.get("/api/public/products", async (req, res) => {
    try {
      const sellerId = req.query.sellerId as string | undefined;
      
      // Fetch products - filter by sellerId at the server level if provided
      let products: any[];
      if (sellerId) {
        // Efficient server-side filtering by seller
        products = await storage.getProducts(undefined, sellerId, 500);
      } else {
        // Limit to 500 products to prevent quota exhaustion
        products = await storage.getProducts(undefined, undefined, 500);
      }
      
      // Filter out inactive products (isActive: false) - these should not be shown to customers
      products = products.filter(product => product.isActive !== false);
      
      // Normalize quantity field - some imported products use 'stock' instead of 'quantity'
      products = products.map(product => ({
        ...product,
        quantity: product.quantity ?? product.stock ?? 0
      }));
      
      // Fetch user settings to get company names and currency for each product
      // Cache user data to avoid repeated lookups for same seller
      const userCache = new Map<string, any>();
      
      const productsWithSellerInfo = await Promise.all(
        products.map(async (product) => {
          if (product.userId) {
            try {
              // Check cache first
              let userData = userCache.get(product.userId);
              if (!userData) {
                const userDoc = await db.collection('users').doc(product.userId).get();
                if (userDoc.exists) {
                  userData = userDoc.data();
                  userCache.set(product.userId, userData);
                }
              }
              
              if (userData) {
                // Priority: companyName > name > email > 'Unknown Seller'
                const companyName = userData?.companyName && userData.companyName.trim() !== '' 
                  ? userData.companyName 
                  : userData?.name && userData.name.trim() !== ''
                  ? userData.name
                  : userData?.email || 'Unknown Seller';
                // Get seller's currency - default to USD if not set
                const sellerCurrency = userData?.currency || userData?.settings?.currency || 'usd';
                return { 
                  ...product, 
                  companyName, 
                  sellerName: companyName,
                  shopSlug: userData?.shopSlug || userData?.settings?.shopSlug || '',
                  sellerCurrency: sellerCurrency.toLowerCase()
                };
              }
            } catch (error) {
              console.error(`Error fetching user data for userId ${product.userId}:`, error);
            }
          }
          return { ...product, companyName: 'Unknown Seller', sellerName: 'Unknown Seller', sellerCurrency: 'usd' };
        })
      );
      
      res.json(productsWithSellerInfo);
    } catch (error) {
      console.error("[public] Error fetching products:", error);
      res.status(500).json({ error: (error as any)?.message || String(error) });
    }
  });
  
  // Dedicated endpoint for fetching products by seller ID - more efficient for shop pages
  app.get("/api/public/products/seller/:sellerId", async (req, res) => {
    try {
      const { sellerId } = req.params;
      
      if (!sellerId) {
        return res.status(400).json({ message: "Seller ID is required" });
      }
      
      // Fetch products directly filtered by seller
      const products: any[] = await storage.getProducts(undefined, sellerId, 500);
      
      // Filter out inactive products
      let activeProducts = products.filter(product => product.isActive !== false);
      
      // Normalize quantity field - some imported products use 'stock' instead of 'quantity'
      activeProducts = activeProducts.map(product => ({
        ...product,
        quantity: product.quantity ?? product.stock ?? 0
      }));
      
      // Fetch seller info once (since all products belong to the same seller)
      let companyName = 'Unknown Seller';
      let shopSlug = '';
      let sellerCurrency = 'usd';
      
      try {
        const userDoc = await db.collection('users').doc(sellerId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          companyName = userData?.companyName && userData.companyName.trim() !== '' 
            ? userData.companyName 
            : userData?.name && userData.name.trim() !== ''
            ? userData.name
            : userData?.email || 'Unknown Seller';
          shopSlug = userData?.shopSlug || userData?.settings?.shopSlug || '';
          // Get seller's currency - default to USD if not set
          sellerCurrency = (userData?.currency || userData?.settings?.currency || 'usd').toLowerCase();
        }
      } catch (error) {
        console.error(`Error fetching seller data for ${sellerId}:`, error);
      }
      
      // Add seller info to all products including currency
      const productsWithSellerInfo = activeProducts.map(product => ({
        ...product,
        companyName,
        sellerName: companyName,
        shopSlug,
        sellerCurrency
      }));
      
      res.json(productsWithSellerInfo);
    } catch (error) {
      console.error("[public] Error fetching seller products:", error);
      res.status(500).json({ error: (error as any)?.message || String(error) });
    }
  });

  // Public categories endpoint (no auth required)
  app.get("/api/public/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("[public] Error fetching categories:", error);
      res.status(500).json({ error: (error as any)?.message || String(error) });
    }
  });

  // Public endpoint to update product location during transfer (requires valid staff PIN)
  app.post("/api/public/transfer-receive", async (req, res) => {
    try {
      const { productId, newLocation, staffPin, staffName } = req.body;
      
      if (!productId || !newLocation || !staffPin) {
        return res.status(400).json({ message: "Missing required fields: productId, newLocation, staffPin" });
      }
      
      // Verify the product exists
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }
      
      // Update the product location
      const updatedProduct = await storage.updateProduct(productId, { 
        location: newLocation 
      });
      
      console.log(`[transfer] Product ${productId} location updated to ${newLocation} by ${staffName || 'Unknown staff'}`);
      
      res.json({ 
        success: true, 
        message: "Product location updated successfully",
        product: updatedProduct 
      });
    } catch (error) {
      console.error("[transfer] Error updating product location:", error);
      res.status(500).json({ message: "Failed to update product location" });
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
  app.get("/api/dashboard/stats", isAuthenticated, cacheMiddleware(120000), async (req: any, res) => {
    try {
      console.log(`[DASHBOARD] Fetching stats for user: ${req.user.uid}`);
      const products = await storage.getProducts(undefined, req.user.uid);
      console.log(`[DASHBOARD] Retrieved ${products.length} products`);
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
      
      console.log(`[DASHBOARD] Stats calculated successfully:`, stats);
      res.json(stats);
    } catch (error) {
      console.error("[DASHBOARD] Error fetching dashboard stats:", error);
      console.error("[DASHBOARD] Error details:", {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        details: (error as any)?.details
      });
      res.status(500).json({ 
        message: "Failed to fetch dashboard stats",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ===================== REPORTS ROUTE =====================
  app.get("/api/reports/data", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.uid;
      
      if (!userId) {
        console.error("[REPORTS] No userId found in request");
        return res.status(401).json({ message: "User ID not found" });
      }
      
      console.log(`[REPORTS] Generating report for user: ${userId}`);
      
      // Get user-specific data only
      const products = await storage.getProducts(undefined, userId);
      const categories = await storage.getCategories(userId);
      
      console.log(`[REPORTS] Fetched ${products.length} products, ${categories.length} categories`);
      
      // Get accounting entries for financial data (already filtered by userId)
      let accountingEntries: any[] = [];
      try {
        accountingEntries = await storage.getAccountingEntries(userId, {
          limit: 10000
        });
        console.log(`[REPORTS] Fetched ${accountingEntries.length} accounting entries`);
      } catch (error: any) {
        console.error(`[REPORTS] Error fetching accounting entries:`, error.message);
        // Continue with empty accounting entries if there's an error
        accountingEntries = [];
      }
      
      console.log(`[REPORTS] User ${userId} has ${products.length} products, ${categories.length} categories, ${accountingEntries.length} accounting entries`);
      
      // Get transactions only for user's products
      const productIds = products.map(p => p.id);
      
      let transactions: any[] = [];
      if (productIds.length > 0) {
        try {
          transactions = await storage.getInventoryTransactionsByProducts(productIds);
        } catch (txError: any) {
          console.error(`[REPORTS] Error fetching transactions:`, txError.message);
          // Continue without transactions if there's an error
          transactions = [];
        }
      }
      
      console.log(`[REPORTS] Found ${transactions.length} transactions for user's products`);

      // Also get orders to supplement data (for Kaggle imports and historical data)
      let orders: any[] = [];
      try {
        const ordersSnapshot = await db.collection("orders")
          .where("sellerId", "==", userId)
          .get();
        orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`[REPORTS] Found ${orders.length} orders for user`);
      } catch (orderError: any) {
        console.error(`[REPORTS] Error fetching orders:`, orderError.message);
        // Continue without orders if there's an error
        orders = [];
      }

      const productById = new Map(products.map((p: any) => [p.id, p]));

      // Calculate metrics from both transactions and orders
      let unitsSold = transactions
        .filter((t) => (t as any).type === "out")
        .reduce((sum, t: any) => sum + (t.quantity || 0), 0);

      let totalRevenueNumber = transactions
        .filter((t: any) => t.type === "out")
        .reduce((sum, t: any) => {
          const product = productById.get(t.productId);
          const price = product ? parseFloat((product.price as any) ?? 0) : 0;
          return sum + price * (t.quantity || 0);
        }, 0);

      // Add order data if available
      for (const order of orders as any[]) {
        if (order.status === 'completed' || order.status === 'paid') {
          const orderAmount = parseFloat(order.totalAmount || 0);
          totalRevenueNumber += orderAmount;
          
          // Count items sold from order
          if (order.items && Array.isArray(order.items)) {
            unitsSold += order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
          }
        }
      }

      const keyMetrics = {
        totalRevenue: `$${totalRevenueNumber.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        unitsSold,
        avgOrderValue: unitsSold > 0 ? `$${(totalRevenueNumber / unitsSold).toFixed(2)}` : "$0",
        returnRate: "0%", // Returns not tracked separately in current model
      };
      
      console.log(`[REPORTS] Key metrics calculated:`, keyMetrics);

      // Group transactions by month for charts
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const byMonth: Record<string, { sales: number; returns: number; inStock: number; outStock: number; revenue: number }> = {};
      
      // Process inventory transactions
      for (const tx of transactions as any[]) {
        const created = (tx.createdAt as any)?.toDate?.() || tx.createdAt || new Date();
        const key = monthKey(new Date(created));
        byMonth[key] ||= { sales: 0, returns: 0, inStock: 0, outStock: 0, revenue: 0 };
        
        if (tx.type === "in") {
          byMonth[key].inStock += tx.quantity || 0;
        }
        if (tx.type === "out") {
          byMonth[key].outStock += tx.quantity || 0;
          byMonth[key].sales += tx.quantity || 0;
          const product = productById.get(tx.productId);
          const price = product ? parseFloat((product.price as any) ?? 0) : 0;
          byMonth[key].revenue += price * (tx.quantity || 0);
        }
      }

      // Process orders to supplement transaction data (important for Kaggle data)
      for (const order of orders as any[]) {
        if (order.status === 'completed' || order.status === 'paid') {
          const created = (order.createdAt as any)?.toDate?.() || order.createdAt || new Date();
          const key = monthKey(new Date(created));
          byMonth[key] ||= { sales: 0, returns: 0, inStock: 0, outStock: 0, revenue: 0 };
          
          const orderAmount = parseFloat(order.totalAmount || 0);
          byMonth[key].revenue += orderAmount;
          
          // Count items sold from order
          if (order.items && Array.isArray(order.items)) {
            const itemCount = order.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
            byMonth[key].sales += itemCount;
            byMonth[key].outStock += itemCount;
          }
        }
      }
      
      const sortedMonths = Object.keys(byMonth).sort();
      const salesData = sortedMonths.map((m) => ({ 
        month: m, 
        sales: byMonth[m].sales, 
        returns: byMonth[m].returns 
      }));
      const inventoryTrends = sortedMonths.map((m) => ({ 
        month: m, 
        inStock: byMonth[m].inStock, 
        outStock: byMonth[m].outStock 
      }));

      // ============= ACCOUNTING DATA =============
      const accountingByMonth: Record<string, { revenue: number; expenses: number; profit: number }> = {};
      
      for (const entry of accountingEntries as any[]) {
        const created = (entry.createdAt as any)?.toDate?.() || entry.createdAt || new Date();
        const key = monthKey(new Date(created));
        accountingByMonth[key] ||= { revenue: 0, expenses: 0, profit: 0 };
        
        const debit = parseFloat(entry.debitAmount || 0);
        const credit = parseFloat(entry.creditAmount || 0);
        
        if (entry.accountType === 'revenue') {
          accountingByMonth[key].revenue += credit;
        } else if (entry.accountType === 'expense') {
          accountingByMonth[key].expenses += debit;
        }
      }
      
      // Add transaction revenue to accounting data
      for (const month in byMonth) {
        accountingByMonth[month] ||= { revenue: 0, expenses: 0, profit: 0 };
        accountingByMonth[month].revenue += byMonth[month].revenue;
      }
      
      // Calculate profit
      for (const month in accountingByMonth) {
        const data = accountingByMonth[month];
        data.profit = data.revenue - data.expenses;
      }
      
      const sortedAccountingMonths = Object.keys(accountingByMonth).sort();
      const accountingData = sortedAccountingMonths.map(m => ({
        month: m,
        revenue: Math.round(accountingByMonth[m].revenue * 100) / 100,
        expenses: Math.round(accountingByMonth[m].expenses * 100) / 100,
        profit: Math.round(accountingByMonth[m].profit * 100) / 100,
      }));

      // ============= CASH FLOW DATA =============
      const cashFlow: Array<{month: string; inflow: number; outflow: number; balance: number}> = [];
      
      for (let index = 0; index < sortedAccountingMonths.length; index++) {
        const m = sortedAccountingMonths[index];
        const data = accountingByMonth[m];
        const previousBalance: number = index > 0 ? (cashFlow[index - 1]?.balance || 0) : 0;
        const balance: number = previousBalance + data.profit;
        
        cashFlow.push({
          month: m,
          inflow: data.revenue,
          outflow: data.expenses,
          balance: Math.round(balance * 100) / 100,
        });
      }

      // ============= ML PREDICTIONS =============
      // Prepare historical data for predictions
      const revenueHistory = sortedAccountingMonths.slice(-12).map((m, index) => ({
        date: new Date(m),
        value: accountingByMonth[m].revenue
      }));
      
      // Generate predictions for next 3 periods with train/test split validation
      const { forecasts, totalPredicted, modelMetrics } = mlService.forecastRevenue(revenueHistory, 3);
      
      console.log(`[REPORTS] ML Model Metrics:`, {
        rSquared: modelMetrics.rSquared,
        mae: modelMetrics.mae,
        mape: modelMetrics.mape,
        split: modelMetrics.splitRatio,
        trainSize: modelMetrics.trainSize,
        testSize: modelMetrics.testSize
      });
      
      const predictions = forecasts.map((f, index) => {
        const lastMonth = sortedAccountingMonths.length > 0 
          ? sortedAccountingMonths[sortedAccountingMonths.length - 1]
          : new Date().toISOString().slice(0, 7); // Use current year-month as fallback
        const [year, month] = lastMonth.split('-');
        // Add (index + 1) to get future months, not current month
        const nextDate = new Date(parseInt(year), parseInt(month) - 1 + (index + 1), 1);
        
        return {
          period: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`,
          predicted: f.value,
          confidence: f.confidence,
          calculation: f.calculation
        };
      });
      
      // ============= ML INSIGHTS =============
      const prediction = mlService.predictNextValue(revenueHistory);
      const anomalyDetection = mlService.detectAnomalies(revenueHistory);
      
      const insights = {
        trend: prediction.trend,
        recommendation: prediction.recommendation,
        anomalies: anomalyDetection.anomalies.length,
        modelMetrics: {
          rSquared: modelMetrics.rSquared,
          mae: modelMetrics.mae,
          mape: modelMetrics.mape,
          trainTestSplit: modelMetrics.splitRatio,
          trainMonths: modelMetrics.trainSize,
          testMonths: modelMetrics.testSize
        }
      };

      // Category distribution by summing quantities of products per category
      const categoryIdToName = new Map(categories.map((c: any) => [c.id, c.name]));
      const categoryTotals: Record<string, number> = {};
      for (const p of products as any[]) {
        const name = categoryIdToName.get(p.categoryId) || "Uncategorized";
        categoryTotals[name] = (categoryTotals[name] || 0) + (p.quantity || 0);
      }
      const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
      
      console.log(`[REPORTS] Category distribution:`, categoryData.length, 'categories');

      // Top products by current quantity sold (approx via transactions and orders)
      const soldByProduct: Record<string, { sales: number; returns: number }> = {};
      
      // Process inventory transactions
      for (const tx of transactions as any[]) {
        if (!soldByProduct[tx.productId]) {
          soldByProduct[tx.productId] = { sales: 0, returns: 0 };
        }
        if (tx.type === "out") {
          soldByProduct[tx.productId].sales += (tx.quantity || 0);
        }
      }

      // Process orders to supplement transaction data (important for Kaggle data)
      for (const order of orders as any[]) {
        if ((order.status === 'completed' || order.status === 'paid') && order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const productId = item.productId;
            if (!soldByProduct[productId]) {
              soldByProduct[productId] = { sales: 0, returns: 0 };
            }
            soldByProduct[productId].sales += (item.quantity || 0);
          }
        }
      }

      // Get refunds from transactions or orders (returns)
      const returnsByProduct: Record<string, number> = {};
      for (const tx of transactions as any[]) {
        if (tx.type === "in" && tx.reason?.toLowerCase().includes('return')) {
          returnsByProduct[tx.productId] = (returnsByProduct[tx.productId] || 0) + (tx.quantity || 0);
        }
      }
      
      // Process refunded orders
      for (const order of orders as any[]) {
        if (order.status === 'refunded' && order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            const productId = item.productId;
            returnsByProduct[productId] = (returnsByProduct[productId] || 0) + (item.quantity || 0);
          }
        }
      }

      // Build top products with full details
      const topProducts = Object.entries(soldByProduct)
        .map(([productId, data]) => {
          const product = productById.get(productId);
          return {
            id: productId,
            name: (product?.name as string) || "Unknown",
            sku: product?.sku || "N/A",
            category: categoryIdToName.get(product?.categoryId) || "Uncategorized",
            supplier: product?.supplier || "N/A",
            price: product?.price || 0,
            costPrice: product?.costPrice || 0,
            quantity: product?.quantity || 0,
            qrCode: product?.qrCode || null,
            sales: data.sales,
            change: Math.floor(Math.random() * 40) - 10, // TODO: Calculate actual change
          };
        })
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);

      // Build top refunded products with full details
      const topRefundedProducts = Object.entries(returnsByProduct)
        .map(([productId, returns]) => {
          const product = productById.get(productId);
          const sales = soldByProduct[productId]?.sales || 0;
          return {
            id: productId,
            name: (product?.name as string) || "Unknown",
            sku: product?.sku || "N/A",
            category: categoryIdToName.get(product?.categoryId) || "Uncategorized",
            supplier: product?.supplier || "N/A",
            price: product?.price || 0,
            costPrice: product?.costPrice || 0,
            quantity: product?.quantity || 0,
            qrCode: product?.qrCode || null,
            returns: returns,
            returnRate: sales > 0 ? ((returns / sales) * 100).toFixed(1) + '%' : '0%',
          };
        })
        .sort((a, b) => b.returns - a.returns)
        .slice(0, 10);
      
      console.log(`[REPORTS] Top products:`, topProducts.length, 'products');
      console.log(`[REPORTS] Top refunded products:`, topRefundedProducts.length, 'products');

      const responseData = { 
        keyMetrics, 
        salesData, 
        inventoryTrends, 
        categoryData, 
        topProducts,
        topRefundedProducts,
        accountingData,
        predictions,
        cashFlow,
        insights,
      };
      
      console.log(`[REPORTS] Sending response for user ${userId} with:`, {
        salesDataPoints: salesData.length,
        inventoryTrendsPoints: inventoryTrends.length,
        accountingDataPoints: accountingData.length,
        predictionsPoints: predictions.length,
        cashFlowPoints: cashFlow.length,
        hasInsights: !!insights,
      });
      
      res.json(responseData);
    } catch (error: any) {
      console.error("[REPORTS] Error building reports data:", error);
      console.error("[REPORTS] Error stack:", error.stack);
      res.status(500).json({ 
        message: "Failed to fetch reports", 
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // ===================== REPORTS CHAT ROUTE (AI) =====================
  app.post("/api/reports/chat", isAuthenticated, async (req: any, res) => {
    try {
      const { message, reportsData, conversationHistory } = req.body;
      
      if (!message || !message.trim()) {
        return res.status(400).json({ message: 'Message is required' });
      }

      const userId = req.user?.uid;
      console.log('[REPORTS CHAT] Processing message for user:', userId);

      // Check for API key
      if (!process.env.GEMINI_API_KEY) {
        console.error('[REPORTS CHAT] Gemini API key not configured');
        return res.status(500).json({ 
          message: 'AI service not configured. Please add GEMINI_API_KEY to environment variables.' 
        });
      }

      // Prepare context from reports data
      const context = `
You are an expert business and financial analyst AI assistant. You have access to the following business data for the user:

KEY METRICS:
- Total Revenue: ${reportsData?.keyMetrics?.totalRevenue || 'N/A'}
- Units Sold: ${reportsData?.keyMetrics?.unitsSold || 0}
- Average Order Value: ${reportsData?.keyMetrics?.avgOrderValue || 'N/A'}
- Return Rate: ${reportsData?.keyMetrics?.returnRate || 'N/A'}

SALES DATA (Monthly):
${JSON.stringify(reportsData?.salesData || [], null, 2)}

INVENTORY TRENDS:
${JSON.stringify(reportsData?.inventoryTrends || [], null, 2)}

ACCOUNTING DATA (Monthly):
${JSON.stringify(reportsData?.accountingData || [], null, 2)}

CASH FLOW:
${JSON.stringify(reportsData?.cashFlow || [], null, 2)}

AI PREDICTIONS:
${JSON.stringify(reportsData?.predictions || [], null, 2)}

TOP PRODUCTS:
${JSON.stringify(reportsData?.topProducts || [], null, 2)}

CATEGORY DISTRIBUTION:
${JSON.stringify(reportsData?.categoryData || [], null, 2)}

${reportsData?.insights ? `CURRENT INSIGHTS:
- Trend: ${reportsData.insights.trend}
- Recommendation: ${reportsData.insights.recommendation}
${reportsData.insights.anomalies ? `- Anomalies Detected: ${reportsData.insights.anomalies}` : ''}
` : ''}

INSTRUCTIONS:
1. Analyze the provided data to answer the user's questions
2. Provide specific, actionable insights based on the actual numbers
3. Highlight trends, patterns, and potential issues
4. Give recommendations for improvement when relevant
5. Be concise but comprehensive
6. Use markdown formatting for better readability
7. Reference specific data points when making observations
8. If asked about inventory management, focus on stock levels, turnover, and optimization
9. If asked about finances, focus on profitability, cash flow, and financial health
10. If the user asks about something not in the data, politely explain what data is available

Remember: You're helping a business owner understand their operations better. Be helpful, professional, and insightful.
`;

      // Build prompt for Gemini
      let fullPrompt = context + '\n\n';
      if (conversationHistory && conversationHistory.length > 0) {
        fullPrompt += conversationHistory.map((msg: any) => 
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
        ).join('\n\n') + '\n\n';
      }
      fullPrompt += `User: ${message}`;

      console.log('[REPORTS CHAT] Calling Gemini API via REST...');

      // Call Gemini REST API directly
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: fullPrompt }]
            }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[REPORTS CHAT] Gemini API error:', errorText);
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

      console.log('[REPORTS CHAT] Response generated successfully');

      return res.json({
        response: aiResponse
      });

    } catch (error: any) {
      console.error('[REPORTS CHAT] Error:', error);
      
      // Handle specific Gemini errors
      if (error.message?.includes('API key')) {
        return res.status(500).json({ 
          message: 'AI service configuration error. Please check your API key.' 
        });
      }
      
      if (error.message?.includes('quota') || error.message?.includes('rate limit')) {
        return res.status(503).json({ 
          message: 'AI service quota exceeded. Please try again later.' 
        });
      }

      return res.status(500).json({ 
        message: 'Failed to process AI request',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  // ===================== ACCOUNTING ROUTES =====================
  // Return raw accounting entries
  app.get("/api/accounting/entries", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const month = (req.query.month as string) || undefined;
      const limitParam = req.query.limit as string | undefined;

      console.log('[GET /api/accounting/entries] userId:', userId, 'month:', month, 'limit:', limitParam);

      let limit: number | undefined;
      if (limitParam) {
        const parsedLimit = Number.parseInt(limitParam, 10);
        if (!Number.isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 1000);
        }
      }

      let startDate: Date | undefined;
      let endDate: Date | undefined;

      if (month) {
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
        }

        const [yearStr, monthStr] = month.split("-");
        const year = Number(yearStr);
        const monthIndex = Number(monthStr) - 1;

        startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
        endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
      }

      if (!month && !limit) {
        limit = 500;
      }

      const cacheKey = [
        "accounting:entries",
        userId,
        month ?? "recent",
        limit ?? "unlimited",
      ].join(":");

      const cached = cache.get(cacheKey);
      if (cached) {
        res.set("Cache-Control", "private, max-age=300");
        res.set("X-Cache", "HIT");
        return res.json(cached);
      }

      const entries = await storage.getAccountingEntries(userId, {
        startDate,
        endDate,
        limit,
      });

      console.log('[GET /api/accounting/entries] Retrieved', entries.length, 'entries from storage for userId:', userId);
      if (entries.length > 0) {
        console.log('[GET /api/accounting/entries] Sample entry userIds:', entries.slice(0, 3).map(e => ({ id: e.id, userId: e.userId })));
      }

      const serializedEntries = entries.map((entry) => ({
        ...entry,
        createdAt:
          entry.createdAt instanceof Date
            ? entry.createdAt.toISOString()
            : (entry.createdAt as any)?.toDate?.()?.toISOString() || entry.createdAt,
      }));

      cache.set(cacheKey, serializedEntries, 300000);

      res.set("Cache-Control", "private, max-age=300");
      res.set("X-Cache", "MISS");
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

      cache.clear(req.user.uid);

      const serializedEntry = {
        ...entry,
        createdAt:
          entry.createdAt instanceof Date
            ? entry.createdAt.toISOString()
            : (entry.createdAt as any)?.toDate?.()?.toISOString() || entry.createdAt,
      };

      res.status(201).json(serializedEntry);
    } catch (error) {
      console.error("Error creating accounting entry:", error);
      res.status(400).json({ message: "Failed to create accounting entry" });
    }
  });

  app.delete("/api/accounting/entries/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: "Missing entry id" });
      }

      await storage.deleteAccountingEntry(id, req.user.uid);
      cache.clear(req.user.uid);
      res.status(204).send();
    } catch (error: any) {
      console.error("Error deleting accounting entry:", error);
      if (error?.message === "ACCOUNTING_ENTRY_NOT_FOUND") {
        return res.status(404).json({ message: "Accounting entry not found" });
      }
      if (error?.message === "FORBIDDEN") {
        return res.status(403).json({ message: "Not allowed to delete this entry" });
      }
      res.status(500).json({ message: "Failed to delete accounting entry" });
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

      const [yearStr, monthStr] = month.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

      const cacheKey = `sales:summary:v2:${userId}:${month}`; // v2 to invalidate old cache
      const cached = cache.get(cacheKey);
      if (cached) {
        res.set("X-Cache", "HIT");
        return res.json(cached);
      }

      const products = await storage.getProducts(undefined, userId);
      if (products.length === 0) {
        return res.json({ totalRevenue: 0, totalCOGS: 0, unitsSold: 0, grossProfit: 0, inventoryValue: 0 });
      }

      const productIds = products.map((p: any) => p.id);
      const monthTransactions = await storage.getInventoryTransactionsByProducts(productIds, {
        startDate,
        endDate,
      });

      let totalRevenue = 0;
      let totalCOGS = 0;
      let unitsSold = 0;

      const productById = new Map(products.map((p: any) => [p.id, p]));

      for (const tx of monthTransactions as any[]) {
        if (tx.type !== "out") continue;
        const product = productById.get(tx.productId);
        const unitPrice = tx.unitPrice
          ? parseFloat(tx.unitPrice as any)
          : product
          ? parseFloat((product.price as any) || 0)
          : 0;
        const costPrice = product && product.costPrice ? parseFloat(product.costPrice as any) : 0;
        const qty = tx.quantity || 0;

        totalRevenue += unitPrice * qty;
        totalCOGS += costPrice * qty;
        unitsSold += qty;
      }

      // Calculate current inventory value (cost price * quantity on hand)
      // If costPrice is not available, use regular price as fallback
      let totalInventoryValue = 0;
      for (const product of products as any[]) {
        const qty = product.quantity || 0;
        const cost = product.costPrice 
          ? parseFloat(product.costPrice as any) 
          : (product.price ? parseFloat(product.price as any) : 0);
        totalInventoryValue += qty * cost;
      }

      console.log('[SALES SUMMARY] Inventory calculation:', {
        productsCount: products.length,
        totalInventoryValue,
        sampleProducts: products.slice(0, 2).map((p: any) => ({
          name: p.name,
          quantity: p.quantity,
          costPrice: p.costPrice,
          price: p.price,
          calculatedValue: (p.quantity || 0) * (p.costPrice ? parseFloat(p.costPrice) : (p.price ? parseFloat(p.price) : 0))
        }))
      });

      const summary = {
        totalRevenue,
        totalCOGS,
        unitsSold,
        grossProfit: totalRevenue - totalCOGS,
        inventoryValue: totalInventoryValue,
      };

      console.log('[SALES SUMMARY] Returning summary with inventoryValue:', summary.inventoryValue);

      cache.set(cacheKey, summary, 300000);
      res.set("X-Cache", "MISS");
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
      const monthParam = (req.query.month as string) || new Date().toISOString().slice(0, 7);

      if (!/^\d{4}-\d{2}$/.test(monthParam)) {
        return res.status(400).json({ message: "Invalid month format. Use YYYY-MM" });
      }

      const [yearStr, monthStr] = monthParam.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      const periodStart = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const periodEnd = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

      const cacheKey = `accounting:report:${userId}:${monthParam}`;

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE HIT] Accounting report for ${monthParam} served from cache in ${Date.now() - startTime}ms`);
        res.set('Cache-Control', 'private, max-age=300');
        res.set('X-Cache', 'HIT');
        return res.json(cached);
      }
      
      console.log(`[CACHE MISS] Generating accounting report for user ${userId} (${monthParam})`);
      
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
          month: monthParam,
        });
      }

      // Get product IDs and fetch only relevant transactions
      const userProductIds = products.map((p: any) => p.id);
      const t2 = Date.now();
      const transactions = await storage.getInventoryTransactionsByProducts(userProductIds, {
        startDate: periodStart,
        endDate: periodEnd,
      });
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
        month: monthParam,
      };

      // Cache the result for 5 minutes
      cache.set(cacheKey, reportData, 300000);
      
      console.log(`[ACCOUNTING REPORT] Generated in ${Date.now() - startTime}ms for ${monthParam} (cached for 5min)`);
      
      // Add cache headers for better performance
      res.set('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
      res.set('X-Cache', 'MISS');
      res.json(reportData);
    } catch (error) {
      console.error("Error building accounting report:", error);
      res.status(500).json({ message: "Failed to build accounting report" });
    }
  });

  // ===================== CHAT / AI ASSISTANT ROUTES =====================
  app.get("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const messages = await storage.getChatMessages();
      // Filter by user in client or add userId filter in storage
      const userMessages = messages.filter((m: any) => m.userId === req.user.uid);
      res.json(userMessages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch chat messages" });
    }
  });

  app.post("/api/chat/messages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { message, isFromUser } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Message is required" });
      }

      // Save user message
      const userMessage = await storage.addChatMessage({
        userId,
        message,
        isFromUser: true,
      });

      // Generate AI response if message is from user
      if (isFromUser) {
        // Get comprehensive context for better responses (limited to prevent quota exhaustion)
        const [products, stats, categories] = await Promise.all([
          storage.getProducts(undefined, undefined, 100),
          storage.getDashboardStats(),
          storage.getCategories()
        ]);

        // Get orders from Firestore directly
        const ordersSnapshot = await db.collection('orders')
          .orderBy('createdAt', 'desc')
          .limit(100)
          .get();
        const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Calculate financial data
        let totalRevenue = 0;
        let totalExpenses = 0;
        let pendingOrders = 0;
        let completedOrders = 0;

        orders.forEach((order: any) => {
          if (order.status === 'pending') pendingOrders++;
          if (order.status === 'completed') {
            completedOrders++;
            totalRevenue += order.total || 0;
          }
        });

        // Calculate expenses from cost prices
        products.forEach((p: any) => {
          totalExpenses += (p.costPrice || 0) * (p.quantity || 0);
        });

        // Count category products
        const categoryData = categories.map((cat: any) => ({
          name: cat.name,
          productCount: products.filter((p: any) => p.category === cat.name).length
        }));

        const context = {
          // Products & Inventory
          totalProducts: products.length,
          lowStockItems: stats.lowStockItems || 0,
          outOfStockItems: products.filter((p: any) => p.quantity === 0).length,
          products: products.slice(0, 20).map((p: any) => ({
            name: p.name,
            sku: p.sku,
            quantity: p.quantity,
            price: p.price,
            location: p.location || 'Warehouse A',
            category: p.category || 'Uncategorized',
            minStockLevel: p.minStockLevel || 10
          })),
          categories: categoryData,

          // Orders
          totalOrders: orders.length,
          pendingOrders,
          completedOrders,
          recentOrders: orders.slice(0, 5).map((o: any) => ({
            id: o.id,
            status: o.status,
            total: o.total,
            date: o.createdAt
          })),

          // Financial
          totalRevenue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses,

          // Settings (these would typically come from user settings/localStorage on client)
          // Providing defaults that match common setup
          branches: ['Warehouse A', 'Warehouse B'],
          currentBranch: 'Warehouse A',
          staffMembers: [],
          companyName: 'My Company',
          currency: 'MYR',
          defaultUnit: 'units',
        };

        // Generate ML-powered response
        const aiResponse = mlService.generateChatbotResponse(message, context);

        // Save AI response
        await storage.addChatMessage({
          userId,
          message: aiResponse,
          isFromUser: false,
        });
      }

      res.json(userMessage);
    } catch (error) {
      console.error("Error sending chat message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ===================== STRIPE PAYMENT ENDPOINTS =====================
  app.post("/api/payment/create-intent", async (req: any, res) => {
    try {
      const { amount, currency = 'usd' } = req.body;

      console.log('[PAYMENT] Create intent request:', { amount, currency });

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid amount' });
      }

      // Initialize Stripe
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      
      if (!stripeSecretKey) {
        console.log('[PAYMENT] Stripe not configured (no secret key), returning mock payment intent');
        // Return a mock response for development
        return res.json({
          clientSecret: `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substr(2, 9)}`,
          paymentIntentId: `pi_mock_${Date.now()}`
        });
      }

      console.log('[PAYMENT] Stripe secret key found, initializing Stripe...');

      const stripe = new Stripe(stripeSecretKey, {} as any);

      console.log('[PAYMENT] Creating payment intent...');

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount), // Amount in cents
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
      });

      console.log('[PAYMENT] Payment intent created:', paymentIntent.id);

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      console.error('[PAYMENT] Error creating payment intent:', error);
      console.error('[PAYMENT] Error details:', error.message, error.stack);
      res.status(500).json({ 
        message: 'Failed to create payment intent',
        error: error.message 
      });
    }
  });

  app.post("/api/payment/webhook", async (req: any, res) => {
    try {
      const sig = req.headers['stripe-signature'];
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.log('[PAYMENT] Webhook secret not configured');
        return res.status(400).json({ message: 'Webhook not configured' });
      }

      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (!stripeSecretKey) {
        return res.status(400).json({ message: 'Stripe not configured' });
      }

      const stripe = new Stripe(stripeSecretKey, {} as any);
      
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err: any) {
        console.error('[PAYMENT] Webhook signature verification failed:', err.message);
        return res.status(400).json({ message: `Webhook Error: ${err.message}` });
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object;
          console.log('[PAYMENT] Payment succeeded:', paymentIntent.id);
          // TODO: Update order status in database
          break;
        case 'payment_intent.payment_failed':
          const failedPayment = event.data.object;
          console.log('[PAYMENT] Payment failed:', failedPayment.id);
          // TODO: Update order status in database
          break;
        default:
          console.log('[PAYMENT] Unhandled event type:', event.type);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(400).json({ message: "Webhook error" });
    }
  });

  // ===================== CHECKOUT ENDPOINT =====================
  app.post("/api/checkout", async (req: any, res) => {
    try {
      const { customerName, customerEmail, customerPhone, shippingAddress, notes, items, totalAmount, customerId } = req.body;

      console.log('[CHECKOUT] Processing order:', { customerName, itemCount: items.length, totalAmount, customerId });

      if (!items || items.length === 0) {
        return res.status(400).json({ message: 'No items in order' });
      }

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const orderDate = new Date();

      // Create order document
      // Get seller currency from first item (assuming single-seller cart)
      const sellerCurrency = items[0]?.sellerCurrency || 'usd';
      
      const orderData = {
        orderNumber,
        customerId: customerId || 'guest',
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        notes: notes || '',
        items: items.map((item: any) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          sellerId: item.userId,
          sellerName: item.sellerName || 'Unknown Seller',
          sellerCurrency: item.sellerCurrency || 'usd'
        })),
        totalAmount,
        sellerCurrency, // Store seller's currency for display
        status: 'pending',
        createdAt: orderDate,
        updatedAt: orderDate
      };

      // Save order to Firestore
      const orderRef = db.collection('orders').doc();
      await orderRef.set({
        ...orderData,
        id: orderRef.id
      });

      console.log('[CHECKOUT] Order saved:', orderRef.id);

      // Process each item
      for (const item of items) {
        const { productId, quantity, unitPrice, userId } = item;

        // Get current product to check stock
        const product = await storage.getProduct(productId);
        
        if (!product) {
          return res.status(404).json({ message: `Product ${productId} not found` });
        }

        // Support both 'quantity' and 'stock' field names (some imported products use 'stock')
        const currentStock = (product as any).quantity ?? (product as any).stock ?? 0;

        // Check stock availability
        if (currentStock < quantity) {
          return res.status(400).json({ 
            message: `Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${quantity}` 
          });
        }

        // Update product quantity (decrease) - update both fields for compatibility
        const newQuantity = currentStock - quantity;
        const updateData: any = { quantity: newQuantity };
        // Also update 'stock' field if the product was using it
        if ((product as any).stock !== undefined) {
          updateData.stock = newQuantity;
        }
        await storage.updateProduct(productId, updateData);

        console.log(`[CHECKOUT] Updated ${product.name}: ${currentStock} -> ${newQuantity}`);

        // Create inventory transaction (out)
        const transaction = await storage.createInventoryTransaction({
          productId,
          type: 'out',
          quantity,
          previousQuantity: currentStock,
          newQuantity,
          unitPrice: unitPrice.toString(),
          totalValue: (unitPrice * quantity).toString(),
          reason: 'Customer purchase',
          reference: orderNumber,
          notes: `Order by ${customerName} (${customerPhone})`,
          createdBy: 'customer'
        });

        console.log(`[CHECKOUT] Created transaction:`, transaction.id);

        // Create accounting entry for revenue (for the product owner)
        const revenue = unitPrice * quantity;
        await storage.addAccountingEntry({
          accountType: 'revenue',
          accountName: 'Sales Revenue',
          debitAmount: '0',
          creditAmount: revenue.toString(),
          description: `Sale of ${quantity}x ${product.name} - Order #${orderNumber}`,
          transactionId: transaction.id
        }, userId); // Use the product owner's userId

        console.log(`[CHECKOUT] Created accounting entry for user ${userId}: $${revenue}`);
      }

      console.log(`[CHECKOUT] Order ${orderNumber} completed successfully`);

      res.status(201).json({
        success: true,
        orderNumber,
        orderId: orderRef.id,
        message: 'Order placed successfully',
        totalAmount
      });

    } catch (error: any) {
      console.error('[CHECKOUT] Error processing order:', error);
      res.status(500).json({ 
        message: 'Failed to process order',
        error: error.message 
      });
    }
  });

  // Get customer orders
  app.get("/api/customer/orders", async (req: any, res) => {
    try {
      const customerId = req.query.customerId;
      
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID required' });
      }

      console.log('[GET ORDERS] Fetching orders for customer:', customerId);

      const ordersSnapshot = await db.collection('orders')
        .where('customerId', '==', customerId)
        .orderBy('createdAt', 'desc')
        .get();

      const orders = ordersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        };
      });

      console.log('[GET ORDERS] Found', orders.length, 'orders');

      res.json(orders);

    } catch (error: any) {
      console.error('[GET ORDERS] Error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch orders',
        error: error.message 
      });
    }
  });

  // Get customer profile
  app.get("/api/customer/profile/:customerId", async (req: any, res) => {
    try {
      const { customerId } = req.params;
      
      console.log('[GET PROFILE] Fetching profile for customer:', customerId);

      const profileDoc = await db.collection('customerProfiles').doc(customerId).get();

      if (!profileDoc.exists) {
        return res.json(null);
      }

      const profile = {
        id: profileDoc.id,
        ...profileDoc.data()
      };

      res.json(profile);

    } catch (error: any) {
      console.error('[GET PROFILE] Error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch profile',
        error: error.message 
      });
    }
  });

  // Save or update customer profile
  app.post("/api/customer/profile", async (req: any, res) => {
    try {
      const { customerId, displayName, phoneNumber, address, city, postalCode, country } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ message: 'Customer ID required' });
      }

      console.log('[SAVE PROFILE] Saving profile for customer:', customerId);

      const { state } = req.body;
      
      const profileData = {
        customerId,
        displayName: displayName || '',
        phoneNumber: phoneNumber || '',
        address: address || '',
        city: city || '',
        state: state || '',
        postalCode: postalCode || '',
        country: country || '',
        updatedAt: new Date()
      };

      const profileRef = db.collection('customerProfiles').doc(customerId);
      const profileDoc = await profileRef.get();

      if (!profileDoc.exists) {
        // Create new profile
        await profileRef.set({
          ...profileData,
          createdAt: new Date()
        });
      } else {
        // Update existing profile
        await profileRef.update(profileData);
      }

      res.json({ 
        message: 'Profile saved successfully',
        profile: profileData 
      });

    } catch (error: any) {
      console.error('[SAVE PROFILE] Error:', error);
      res.status(500).json({ 
        message: 'Failed to save profile',
        error: error.message 
      });
    }
  });

  // Get seller orders
  app.get("/api/seller/orders", async (req: any, res) => {
    try {
      const sellerId = req.query.sellerId;
      
      if (!sellerId) {
        return res.status(400).json({ message: 'Seller ID required' });
      }

      console.log('[GET SELLER ORDERS] Fetching orders for seller:', sellerId);

      // Get all orders
      const ordersSnapshot = await db.collection('orders')
        .orderBy('createdAt', 'desc')
        .get();

      // Filter orders that contain items from this seller
      const sellerOrders = ordersSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            refundRequestedAt: data.refundRequestedAt?.toDate?.()?.toISOString() || data.refundRequestedAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
          };
        })
        .filter((order: any) => {
          // Check if any item in the order belongs to this seller
          return order.items?.some((item: any) => item.sellerId === sellerId);
        });

      console.log('[GET SELLER ORDERS] Found', sellerOrders.length, 'orders for seller');

      res.json(sellerOrders);

    } catch (error: any) {
      console.error('[GET SELLER ORDERS] Error:', error);
      res.status(500).json({ 
        message: 'Failed to fetch orders',
        error: error.message 
      });
    }
  });

  // Request refund for an order
  app.post("/api/orders/:orderId/refund", async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { reason, orderNumber } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Refund reason is required' });
      }

      console.log('[REFUND REQUEST] Processing refund for order:', orderId);

      // Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      // Update order with refund request
      await db.collection('orders').doc(orderId).update({
        refundRequested: true,
        refundReason: reason,
        refundRequestedAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[REFUND REQUEST] Refund request submitted for order:', orderNumber);

      res.json({
        success: true,
        message: 'Refund request submitted successfully'
      });

    } catch (error: any) {
      console.error('[REFUND REQUEST] Error:', error);
      res.status(500).json({ 
        message: 'Failed to submit refund request',
        error: error.message 
      });
    }
  });

  // Approve refund request
  app.post("/api/orders/:orderId/refund/approve", async (req: any, res) => {
    try {
      const { orderId } = req.params;

      console.log('[APPROVE REFUND] Processing approval for order:', orderId);

      // Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderData = orderDoc.data();

      if (!orderData?.refundRequested) {
        return res.status(400).json({ message: 'No refund request found for this order' });
      }

      // Create inventory transactions for returned items
      const items = orderData.items || [];
      console.log('[APPROVE REFUND] Creating return transactions for', items.length, 'items');
      
      for (const item of items) {
        // Add stock back to inventory
        const productRef = db.collection('products').doc(item.productId);
        const productDoc = await productRef.get();
        
        if (productDoc.exists) {
          const currentQuantity = productDoc.data()?.quantity || 0;
          await productRef.update({
            quantity: currentQuantity + item.quantity,
            updatedAt: new Date()
          });

          // Create inventory transaction for the return
          await db.collection('inventoryTransactions').add({
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            reason: `Return from order ${orderData.orderNumber}`,
            notes: `Refund approved - items returned to stock`,
            createdAt: new Date(),
            userId: orderData.userId || orderData.customerId
          });

          console.log('[APPROVE REFUND] Returned', item.quantity, 'units of product', item.productId);
        }
      }

      // Update order status
      await db.collection('orders').doc(orderId).update({
        refundApproved: true,
        refundRejected: false,
        status: 'refunded',
        refundApprovedAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[APPROVE REFUND] Refund approved for order:', orderData.orderNumber);

      res.json({
        success: true,
        message: 'Refund approved successfully'
      });

    } catch (error: any) {
      console.error('[APPROVE REFUND] Error:', error);
      res.status(500).json({ 
        message: 'Failed to approve refund',
        error: error.message 
      });
    }
  });

  // Reject refund request
  app.post("/api/orders/:orderId/refund/reject", async (req: any, res) => {
    try {
      const { orderId } = req.params;
      const { reason } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({ message: 'Rejection reason is required' });
      }

      console.log('[REJECT REFUND] Processing rejection for order:', orderId);

      // Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderData = orderDoc.data();

      if (!orderData?.refundRequested) {
        return res.status(400).json({ message: 'No refund request found for this order' });
      }

      // Update order with rejection
      await db.collection('orders').doc(orderId).update({
        refundRejected: true,
        refundApproved: false,
        rejectionReason: reason,
        refundRejectedAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[REJECT REFUND] Refund rejected for order:', orderData.orderNumber);

      res.json({
        success: true,
        message: 'Refund request rejected'
      });

    } catch (error: any) {
      console.error('[REJECT REFUND] Error:', error);
      res.status(500).json({ 
        message: 'Failed to reject refund request',
        error: error.message 
      });
    }
  });

  // Accept order and add shipment tracking
  app.post("/api/orders/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const { id: orderId } = req.params;
      const { shipmentId } = req.body;

      // Validate shipment ID
      if (!shipmentId || !shipmentId.trim()) {
        return res.status(400).json({ message: 'Shipment tracking ID is required' });
      }

      console.log('[ACCEPT ORDER] Processing acceptance for order:', orderId);

      // Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderData = orderDoc.data();

      // Verify order has items belonging to the seller
      const hasSellerItems = orderData?.items?.some((item: any) => item.sellerId === req.user.uid);
      
      if (!hasSellerItems) {
        return res.status(403).json({ message: 'Unauthorized - This order does not contain your products' });
      }

      // Check if order is in pending status
      if (orderData?.status !== 'pending') {
        return res.status(400).json({ message: 'Only pending orders can be accepted' });
      }

      // Update order with acceptance and shipment tracking
      await db.collection('orders').doc(orderId).update({
        status: 'processing',
        shipmentId: shipmentId.trim(),
        acceptedAt: new Date(),
        updatedAt: new Date()
      });

      console.log('[ACCEPT ORDER] Order accepted:', orderData.orderNumber, 'Tracking:', shipmentId);

      res.json({
        success: true,
        message: 'Order accepted successfully',
        order: {
          ...orderData,
          id: orderId,
          status: 'processing',
          shipmentId: shipmentId.trim()
        }
      });

    } catch (error: any) {
      console.error('[ACCEPT ORDER] Error:', error);
      res.status(500).json({ 
        message: 'Failed to accept order',
        error: error.message 
      });
    }
  });

  // Complete order - Customer marks order as received
  app.post("/api/orders/:id/complete", async (req: any, res) => {
    try {
      const orderId = req.params.id;
      
      console.log('[COMPLETE ORDER] Marking order as completed:', orderId);

      // Get the order
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (!orderDoc.exists) {
        return res.status(404).json({ message: 'Order not found' });
      }

      const orderData = orderDoc.data();

      // Only shipped orders can be marked as completed
      if (orderData?.status !== 'processing' || !orderData?.shipmentId) {
        return res.status(400).json({ 
          message: 'Only shipped orders can be marked as received' 
        });
      }

      // Update order to completed
      await db.collection('orders').doc(orderId).update({
        status: 'completed',
        completedAt: new Date(),
        receivedByCustomer: true,
        updatedAt: new Date()
      });

      console.log('[COMPLETE ORDER] Order completed:', orderData.orderNumber);

      res.json({
        success: true,
        message: 'Order marked as received',
        order: {
          ...orderData,
          id: orderId,
          status: 'completed',
          receivedByCustomer: true
        }
      });

    } catch (error: any) {
      console.error('[COMPLETE ORDER] Error:', error);
      res.status(500).json({ 
        message: 'Failed to complete order',
        error: error.message 
      });
    }
  });

  // ===================== LOCAL / SANDBOX SHIPPING ROUTES =====================
  // These routes implement a simple, free, no-registration "virtual courier"
  // for demo purposes. No external API calls are made.

  // Create shipment and generate internal waybill
  app.post("/api/shipping/create", isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, weight, insuranceValue } = req.body;

      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      console.log("[SHIPPING] Creating LOCAL shipment for order:", orderId);

      // Get order details
      const orderDoc = await db.collection("orders").doc(orderId).get();
      if (!orderDoc.exists) {
        return res.status(404).json({ message: "Order not found" });
      }

      const order = orderDoc.data() as any;

      // Verify order has items for this seller
      const hasSellerItems = order.items?.some((item: any) => item.sellerId === req.user.uid);
      if (!hasSellerItems) {
        return res.status(403).json({ message: "Unauthorized - This order does not contain your products" });
      }

      // Simple internal tracking number
      const trackingNo = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      // Basic shipping cost estimation (purely for demo)
      const totalItems = (order.items || []).reduce(
        (sum: number, item: any) => sum + (item.quantity || 0),
        0
      );
      const effectiveWeight = weight && Number(weight) > 0 ? Number(weight) : Math.max(totalItems * 0.5, 0.5);
      const baseRate = 5; // base currency units
      const perKg = 2;
      const cost = baseRate + perKg * effectiveWeight;

      const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      // Persist shipment details back to order
      await db.collection("orders").doc(orderId).update({
        shipmentId: trackingNo,
        courier: "DemoCourier",
        waybillUrl: null,
        estimatedDelivery,
        shippingCost: cost,
        status: "processing",
        updatedAt: new Date(),
        insuranceValue: insuranceValue ? Number(insuranceValue) : 0,
      });

      return res.json({
        success: true,
        trackingNo,
        orderId,
        waybillUrl: null,
        courier: "DemoCourier",
        estimatedDelivery,
        cost,
      });
    } catch (error: any) {
      console.error("[SHIPPING] Error creating local shipment:", error);
      return res.status(500).json({
        message: "Failed to create shipment",
        error: error?.message || String(error),
      });
    }
  });

  // Track shipment (simple synthetic timeline)
  app.get("/api/shipping/track/:trackingNo", async (req: any, res) => {
    try {
      const trackingNo = req.params.trackingNo;

      // Find order with this shipmentId
      const snapshot = await db
        .collection("orders")
        .where("shipmentId", "==", trackingNo)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return res.status(404).json({ message: "Shipment not found" });
      }

      const doc = snapshot.docs[0];
      const order = doc.data() as any;

      const createdAt = (order.createdAt as any)?.toDate?.() || new Date();
      const estimatedDelivery =
        order.estimatedDelivery ||
        new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const events = [
        {
          timestamp: createdAt.toISOString(),
          status: "Order received",
          location: "Origin Warehouse",
          description: "Seller has received the order and is preparing the shipment.",
        },
        {
          timestamp: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000).toISOString(),
          status: "In transit",
          location: "On the way",
          description: "Your package is on the way with DemoCourier.",
        },
        {
          timestamp: estimatedDelivery,
          status: "Out for delivery",
          location: "Destination City",
          description: "Courier is delivering the package to the customer address.",
        },
      ];

      return res.json({
        status: order.status || "processing",
        tracking_no: trackingNo,
        courier: order.courier || "DemoCourier",
        events,
      });
    } catch (error: any) {
      console.error("[SHIPPING] Error tracking local shipment:", error);
      return res.status(500).json({
        message: "Failed to track shipment",
        error: error?.message || String(error),
      });
    }
  });

  // "Waybill" – return professional HTML template optimized for PDF printing
  // Accepts auth via header (Bearer token) or query param (token) for new window access
  app.get("/api/shipping/waybill/:orderId", async (req: any, res) => {
    try {
      // Check for token in query param (for new window access) or header
      const tokenFromQuery = req.query.token;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      
      let user;
      if (tokenFromQuery) {
        // Authenticate using token from query param
        try {
          const decoded = await auth.verifyIdToken(tokenFromQuery);
          user = decoded;
          console.log("[WAYBILL] Authenticated user via query token:", user.uid);
        } catch (error: any) {
          console.error("[WAYBILL] Token verification failed:", error.message);
          // Return HTML error page instead of JSON for better UX
          return res.status(401).send(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Authentication Error</title>
                <style>
                  body { font-family: sans-serif; padding: 40px; text-align: center; }
                  .error { color: #dc2626; font-size: 18px; margin: 20px; }
                  .message { color: #666; margin: 10px; }
                </style>
              </head>
              <body>
                <h1>⚠️ Authentication Error</h1>
                <div class="error">Your session has expired or the token is invalid.</div>
                <div class="message">Please close this window and try again from the orders page.</div>
              </body>
            </html>
          `);
        }
      } else if (authHeader && authHeader.startsWith('Bearer ')) {
        // Authenticate using token from header
        const token = authHeader.split('Bearer ')[1];
        try {
          const decoded = await auth.verifyIdToken(token);
          user = decoded;
          console.log("[WAYBILL] Authenticated user via header token:", user.uid);
        } catch (error: any) {
          console.error("[WAYBILL] Header token verification failed:", error.message);
          return res.status(401).json({ message: "Unauthorized - Invalid token" });
        }
      } else {
        console.error("[WAYBILL] No authentication token provided");
        return res.status(401).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Authentication Required</title>
              <style>
                body { font-family: sans-serif; padding: 40px; text-align: center; }
                .error { color: #dc2626; font-size: 18px; margin: 20px; }
                .message { color: #666; margin: 10px; }
              </style>
            </head>
            <body>
              <h1>🔒 Authentication Required</h1>
              <div class="error">Please access the waybill from the orders page.</div>
            </body>
          </html>
        `);
      }
      
      const { orderId } = req.params;

      const orderDoc = await db.collection("orders").doc(orderId).get();
      if (!orderDoc.exists) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Order Not Found</title>
              <style>
                body { font-family: sans-serif; padding: 40px; text-align: center; }
                .error { color: #dc2626; font-size: 18px; margin: 20px; }
              </style>
            </head>
            <body>
              <h1>❌ Order Not Found</h1>
              <div class="error">The requested order could not be found.</div>
            </body>
          </html>
        `);
      }

      const order = orderDoc.data() as any;
      
      // Verify order has items belonging to the seller
      const hasSellerItems = order.items?.some((item: any) => item.sellerId === user.uid);
      if (!hasSellerItems) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Access Denied</title>
              <style>
                body { font-family: sans-serif; padding: 40px; text-align: center; }
                .error { color: #dc2626; font-size: 18px; margin: 20px; }
              </style>
            </head>
            <body>
              <h1>🚫 Access Denied</h1>
              <div class="error">This order does not belong to you.</div>
            </body>
          </html>
        `);
      }
      
      // Get seller info for "Ship From" section
      const sellerDoc = await db.collection("users").doc(user.uid).get();
      const seller = sellerDoc.data() as any;
      
      const orderDate = order.createdAt?.toDate?.() || order.createdAt || new Date();
      const formattedDate = new Date(orderDate).toLocaleDateString('en-MY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      const estimatedDelivery = order.estimatedDelivery 
        ? new Date(order.estimatedDelivery).toLocaleDateString('en-MY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'N/A';

      const html = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Waybill - ${order.orderNumber || orderId}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      @page {
        size: A4 portrait;
        margin: 10mm;
      }
      
      @media print {
        html, body {
          width: 210mm;
          height: 297mm;
        }
        body {
          margin: 0;
          padding: 0;
          background: white !important;
        }
        .no-print {
          display: none !important;
        }
        .waybill-container {
          box-shadow: none !important;
          margin: 0 !important;
          padding: 0 !important;
          page-break-after: avoid;
        }
        .waybill {
          border-width: 2px !important;
        }
      }
      
      body {
        font-family: 'Arial', 'Helvetica', sans-serif;
        background: #f0f0f0;
        padding: 15px;
        color: #000;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      
      .waybill-container {
        max-width: 210mm;
        margin: 0 auto;
        background: white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      
      .waybill {
        border: 4px solid #000;
        padding: 15px;
        background: white;
      }
      
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        border-bottom: 4px solid #000;
        padding-bottom: 12px;
        margin-bottom: 15px;
      }
      
      .logo-section h1 {
        font-size: 32px;
        color: #000;
        font-weight: 900;
        margin-bottom: 4px;
        letter-spacing: -1px;
        text-transform: uppercase;
      }
      
      .logo-section .company {
        font-size: 16px;
        color: #333;
        font-weight: 600;
        margin-top: 4px;
      }
      
      .logo-section .subtitle {
        font-size: 11px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        margin-top: 2px;
      }
      
      .order-info {
        text-align: right;
        background: #000;
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
      }
      
      .order-info .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        opacity: 0.8;
        margin-bottom: 4px;
      }
      
      .order-info .value {
        font-size: 20px;
        font-weight: 900;
        letter-spacing: 0.5px;
      }
      
      .order-info .date-section {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid rgba(255,255,255,0.3);
      }
      
      .tracking-section {
        background: #000;
        color: white;
        padding: 18px 20px;
        margin: 18px 0;
        border-radius: 0;
        text-align: center;
        border: 3px solid #000;
      }
      
      .tracking-section .label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 2px;
        font-weight: 700;
        margin-bottom: 10px;
      }
      
      .tracking-section .tracking-number {
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 4px;
        font-family: 'Courier New', 'Courier', monospace;
        background: white;
        color: #000;
        padding: 12px 20px;
        border-radius: 4px;
        display: inline-block;
        margin: 8px 0;
      }
      
      .two-column {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin: 18px 0;
      }
      
      .section {
        border: 3px solid #000;
        padding: 12px;
        background: white;
        min-height: 140px;
      }
      
      .section-title {
        font-size: 13px;
        font-weight: 900;
        text-transform: uppercase;
        color: white;
        background: #000;
        letter-spacing: 1.5px;
        padding: 8px 12px;
        margin: -12px -12px 12px -12px;
      }
      
      .section-content {
        font-size: 13px;
        line-height: 1.6;
      }
      
      .section-content .name {
        font-weight: 900;
        font-size: 16px;
        margin-bottom: 6px;
        color: #000;
        text-transform: uppercase;
      }
      
      .section-content .detail {
        color: #333;
        margin: 4px 0;
        padding-left: 0;
      }
      
      .section-content .address {
        color: #000;
        margin-top: 8px;
        font-weight: 600;
        border-left: 4px solid #000;
        padding-left: 8px;
        line-height: 1.5;
      }
      
      .barcode-area {
        margin-top: 20px;
        padding: 25px 20px;
        border: 4px solid #000;
        text-align: center;
        background: white;
      }
      
      .barcode-label {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #000;
        margin-bottom: 15px;
      }
      
      .barcode {
        width: 100%;
        max-width: 400px;
        margin: 0 auto;
      }
      
      .barcode-lines {
        display: flex;
        justify-content: center;
        align-items: flex-end;
        height: 80px;
        background: white;
        margin: 10px 0;
        gap: 2px;
      }
      
      .barcode-line {
        background: #000;
        height: 100%;
        flex-shrink: 0;
      }
      
      .barcode-line.thin {
        width: 2px;
      }
      
      .barcode-line.medium {
        width: 3px;
      }
      
      .barcode-line.thick {
        width: 4px;
      }
      
      .barcode-line.short {
        height: 60%;
      }
      
      .barcode-number {
        font-family: 'Courier New', 'Courier', monospace;
        font-size: 16px;
        font-weight: 900;
        letter-spacing: 6px;
        color: #000;
        margin-top: 8px;
        text-align: center;
      }
      
      .tracking-ref {
        font-size: 12px;
        color: #666;
        margin-top: 10px;
        font-weight: 600;
      }
      
      .qr-placeholder {
        width: 100px;
        height: 100px;
        background: white;
        border: 2px solid #000;
        margin: 12px auto;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: #666;
      }
      
      .footer {
        margin-top: 18px;
        padding-top: 12px;
        border-top: 3px solid #000;
        text-align: center;
        font-size: 10px;
        color: #666;
        line-height: 1.6;
      }
      
      .footer .important {
        color: #000;
        font-weight: 700;
        margin-bottom: 6px;
      }
      
      .print-controls {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 1000;
        display: flex;
        gap: 10px;
      }
      
      .print-button {
        background: #000;
        color: white;
        border: none;
        padding: 14px 28px;
        font-size: 15px;
        font-weight: 700;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .print-button:hover {
        background: #333;
        transform: translateY(-2px);
        box-shadow: 0 6px 16px rgba(0,0,0,0.4);
      }
      
      .print-button:active {
        transform: translateY(0);
      }
      
      .print-button.secondary {
        background: white;
        color: #000;
        border: 2px solid #000;
      }
      
      .print-button.secondary:hover {
        background: #f5f5f5;
      }
    </style>
  </head>
  <body>
    <div class="print-controls no-print">
      <button class="print-button secondary" onclick="window.close()">✕ Close</button>
      <button class="print-button" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>
    
    <div class="waybill-container">
      <div class="waybill">
        <!-- Header -->
        <div class="header">
          <div class="logo-section">
            <h1>Shipping Waybill</h1>
            <div class="company">${seller?.settings?.shopName || seller?.companyName || seller?.displayName || 'Your Store'}</div>
            <div class="subtitle">Commercial Invoice & Packing List</div>
          </div>
          <div class="order-info">
            <div class="label">Order Number</div>
            <div class="value">${order.orderNumber || orderId}</div>
            <div class="date-section">
              <div class="label">Order Date</div>
              <div class="value" style="font-size: 14px;">${formattedDate}</div>
            </div>
          </div>
        </div>
        
        <!-- Tracking Number -->
        <div class="tracking-section">
          <div class="label">● Tracking Number ●</div>
          <div class="tracking-number">${order.shipmentId || "PENDING-ASSIGNMENT"}</div>
        </div>
        
        <!-- Ship From / Ship To -->
        <div class="two-column">
          <div class="section">
            <div class="section-title">📦 Ship From (Sender)</div>
            <div class="section-content">
              <div class="name">${seller?.settings?.shopName || seller?.companyName || seller?.displayName || 'Seller'}</div>
              <div class="detail">📞 ${seller?.settings?.shopPhone || seller?.phoneNumber || 'N/A'}</div>
              <div class="detail">📧 ${seller?.email || 'N/A'}</div>
              <div class="address">${seller?.settings?.shopAddress || seller?.businessAddress || 'Address not configured'}</div>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">📍 Ship To (Recipient)</div>
            <div class="section-content">
              <div class="name">${order.customerName || 'N/A'}</div>
              <div class="detail">📞 ${order.customerPhone || 'N/A'}</div>
              <div class="detail">📧 ${order.customerEmail || 'N/A'}</div>
              <div class="address">${order.shippingAddress || 'N/A'}</div>
            </div>
          </div>
        </div>
        
        <!-- Barcode Area -->
        <div class="barcode-area">
          <div class="barcode-label">Tracking Barcode</div>
          <div class="barcode">
            <div class="barcode-lines">
              <!-- Simulated barcode pattern -->
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium short"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin short"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thick"></div>
              <div class="barcode-line thin"></div>
              <div class="barcode-line medium"></div>
              <div class="barcode-line thin"></div>
            </div>
            <div class="barcode-number">${order.shipmentId || 'PENDING'}</div>
            <div class="tracking-ref">Order: ${order.orderNumber || 'N/A'}</div>
          </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
          <div class="important">⚠️ IMPORTANT NOTICE</div>
          <p>This is a computer-generated waybill and serves as proof of shipment.</p>
          <p>For order tracking, please use the tracking number above on the courier's website.</p>
          <p style="margin-top: 8px; font-weight: 700;">Generated: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p>
          <p style="margin-top: 4px; font-size: 9px;">Order ID: ${orderId}</p>
        </div>
      </div>
    </div>
    
    <script>
      // Instructions for saving as PDF
      console.log('%c📄 SAVE AS PDF INSTRUCTIONS:', 'font-size: 16px; font-weight: bold; color: #000;');
      console.log('1. Click the Print button above');
      console.log('2. In the print dialog, select "Save as PDF" or "Microsoft Print to PDF"');
      console.log('3. Choose your destination and save');
      console.log('');
      console.log('The page is optimized for A4 paper size.');
    </script>
  </body>
</html>`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (error: any) {
      console.error("[SHIPPING] Error generating local waybill:", error);
      return res.status(500).json({
        message: "Failed to generate waybill",
        error: error?.message || String(error),
      });
    }
  });

  // ML Predictions endpoint
  app.get("/api/ml/predictions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const type = req.query.type || 'sales';

      const accountingEntries = await storage.getAccountingEntries(userId);
      
      // Prepare historical data
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const revenueByMonth: Record<string, number> = {};
      
      for (const entry of accountingEntries as any[]) {
        const created = (entry.createdAt as any)?.toDate?.() || entry.createdAt || new Date();
        const key = monthKey(new Date(created));
        const credit = parseFloat(entry.creditAmount || 0);
        
        if (entry.accountType === 'revenue') {
          revenueByMonth[key] = (revenueByMonth[key] || 0) + credit;
        }
      }

      const sortedMonths = Object.keys(revenueByMonth).sort();
      const historicalData = sortedMonths.map(m => ({
        date: new Date(m),
        value: revenueByMonth[m]
      }));

      let result;
      if (type === 'forecast') {
        result = mlService.forecastRevenue(historicalData, 6);
      } else if (type === 'anomalies') {
        result = mlService.detectAnomalies(historicalData);
      } else {
        result = mlService.predictNextValue(historicalData);
      }

      res.json(result);
    } catch (error) {
      console.error("Error generating ML predictions:", error);
      res.status(500).json({ message: "Failed to generate predictions" });
    }
  });

  // ===================== EMAIL NOTIFICATION ROUTES =====================
  
  // Test endpoint to send a test email notification
  app.post("/api/notifications/test-email", isAuthenticated, async (req: any, res) => {
    try {
      const { type, email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email address is required" });
      }

      const user = await storage.getUser(req.user.uid);
      const userRef = db.collection("users").doc(req.user.uid);
      const userDoc = await userRef.get();
      const settings = userDoc.data()?.settings || {};
      const companyName = settings.companyName || "Your Company";

      let success = false;

      if (type === "low-stock") {
        // Fetch actual low stock products for this user
        const productsRef = db.collection("products");
        const snapshot = await productsRef.where("userId", "==", req.user.uid).get();
        
        const lowStockProducts = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              name: data.name,
              currentStock: data.quantity || 0,
              lowStockThreshold: data.lowStockThreshold || 10,
            };
          })
          .filter((p) => p.currentStock <= p.lowStockThreshold);

        if (lowStockProducts.length === 0) {
          // If no actual low stock products, use sample data
          lowStockProducts.push(
            { name: "Sample Product (No low stock items found)", currentStock: 5, lowStockThreshold: 10 }
          );
        }

        success = await emailService.sendLowStockAlert(email, companyName, lowStockProducts);
      } else if (type === "daily-report") {
        // Fetch actual user data for daily report
        const productsRef = db.collection("products");
        const productsSnapshot = await productsRef.where("userId", "==", req.user.uid).get();
        
        const lowStockCount = productsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          const quantity = data.quantity || 0;
          const threshold = data.lowStockThreshold || 10;
          return quantity <= threshold;
        }).length;

        // Get recent orders (last 24 hours)
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const ordersRef = db.collection("orders");
        const ordersSnapshot = await ordersRef
          .where("userId", "==", req.user.uid)
          .where("createdAt", ">=", yesterday.toISOString())
          .get();

        const orders = ordersSnapshot.docs.map((doc) => doc.data());
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalSales = orders.reduce((sum, order) => {
          return sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);

        // Calculate top products from orders
        const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        orders.forEach((order) => {
          order.items?.forEach((item: any) => {
            if (!productSales[item.productId]) {
              productSales[item.productId] = { name: item.name || "Unknown", quantity: 0, revenue: 0 };
            }
            productSales[item.productId].quantity += item.quantity || 0;
            productSales[item.productId].revenue += (item.price || 0) * (item.quantity || 0);
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        if (topProducts.length === 0) {
          topProducts.push({ name: "No sales today", quantity: 0, revenue: 0 });
        }

        success = await emailService.sendDailyReport(email, companyName, {
          date: new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
          totalSales,
          totalOrders,
          totalRevenue,
          lowStockCount,
          topProducts,
        });
      } else if (type === "weekly-summary") {
        // Fetch actual user data for weekly summary
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Get products
        const productsRef = db.collection("products");
        const productsSnapshot = await productsRef.where("userId", "==", req.user.uid).get();
        
        const totalProducts = productsSnapshot.size;
        const lowStockCount = productsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          const quantity = data.quantity || 0;
          const threshold = data.lowStockThreshold || 10;
          return quantity <= threshold && quantity > 0;
        }).length;
        
        const outOfStockCount = productsSnapshot.docs.filter((doc) => {
          const data = doc.data();
          return (data.quantity || 0) === 0;
        }).length;

        // Get orders from last week
        const ordersRef = db.collection("orders");
        const ordersSnapshot = await ordersRef
          .where("userId", "==", req.user.uid)
          .where("createdAt", ">=", lastWeek.toISOString())
          .get();

        const orders = ordersSnapshot.docs.map((doc) => doc.data());
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalSales = orders.reduce((sum, order) => {
          return sum + (order.items?.reduce((itemSum: number, item: any) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Calculate top products from weekly orders
        const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
        orders.forEach((order) => {
          order.items?.forEach((item: any) => {
            if (!productSales[item.productId]) {
              productSales[item.productId] = { name: item.name || "Unknown", quantity: 0, revenue: 0 };
            }
            productSales[item.productId].quantity += item.quantity || 0;
            productSales[item.productId].revenue += (item.price || 0) * (item.quantity || 0);
          });
        });

        const topProducts = Object.values(productSales)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        if (topProducts.length === 0) {
          topProducts.push({ name: "No sales this week", quantity: 0, revenue: 0 });
        }
        
        success = await emailService.sendWeeklySummary(email, companyName, {
          weekRange: `${lastWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          totalSales,
          totalOrders,
          totalRevenue,
          averageOrderValue,
          topProducts,
          inventoryStatus: {
            totalProducts,
            lowStockCount,
            outOfStockCount,
          },
        });
      } else {
        return res.status(400).json({ message: "Invalid email type. Use 'low-stock', 'daily-report', or 'weekly-summary'" });
      }

      if (success) {
        res.json({ message: "Test email sent successfully", email, type });
      } else {
        res.status(500).json({ message: "Failed to send test email. Check server logs and email configuration." });
      }
    } catch (error) {
      console.error("Error sending test email:", error);
      res.status(500).json({ message: "Failed to send test email" });
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
