// server/routes.ts
import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { cache } from "./cache";
import { auth, db } from "./db"; // ✅ fixed import
import { mlService } from "./ml-service";
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
  app.get("/api/categories", isAuthenticated, async (req: any, res) => {
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
      await storage.deleteCategory(categoryId, req.user.uid);
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

      const coupons = couponsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      res.json(coupons);
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
  app.get("/api/products", isAuthenticated, async (req: any, res) => {
    try {
      const search = req.query.search as string;
      const products = await storage.getProducts(search, req.user.uid);
      res.json(products);
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Temporary public endpoint to verify server -> Firestore connectivity (no auth)
  app.get("/api/public/products", async (_req, res) => {
    try {
      const products = await storage.getProducts();
      
      // Fetch user settings to get company names for each product
      const productsWithCompanyNames = await Promise.all(
        products.map(async (product) => {
          if (product.userId) {
            try {
              const userDoc = await db.collection('users').doc(product.userId).get();
              if (userDoc.exists) {
                const userData = userDoc.data();
                // Priority: companyName > name > email > 'Unknown Seller'
                const companyName = userData?.companyName && userData.companyName.trim() !== '' 
                  ? userData.companyName 
                  : userData?.name && userData.name.trim() !== ''
                  ? userData.name
                  : userData?.email || 'Unknown Seller';
                return { 
                  ...product, 
                  companyName, 
                  sellerName: companyName,
                  shopSlug: userData?.shopSlug || userData?.settings?.shopSlug || ''
                };
              }
            } catch (error) {
              console.error(`Error fetching user data for userId ${product.userId}:`, error);
            }
          }
          return { ...product, companyName: 'Unknown Seller', sellerName: 'Unknown Seller' };
        })
      );
      
      res.json(productsWithCompanyNames);
    } catch (error) {
      console.error("[public] Error fetching products:", error);
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
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const products = await storage.getProducts(undefined, req.user.uid);
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
      
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
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
        accountingEntries = await storage.getAccountingEntries(userId);
        console.log(`[REPORTS] Fetched ${accountingEntries.length} accounting entries`);
      } catch (error: any) {
        console.error(`[REPORTS] Error fetching accounting entries:`, error.message);
        // Continue with empty accounting entries if there's an error
        accountingEntries = [];
      }
      
      console.log(`[REPORTS] User ${userId} has ${products.length} products, ${categories.length} categories, ${accountingEntries.length} accounting entries`);
      
      // Get transactions only for user's products
      const productIds = products.map(p => p.id);
      const transactions = productIds.length > 0 
        ? await storage.getInventoryTransactionsByProducts(productIds)
        : [];
      
      console.log(`[REPORTS] Found ${transactions.length} transactions for user's products`);

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
      
      console.log(`[REPORTS] Key metrics calculated:`, keyMetrics);

      // Group transactions by month for charts
      const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const byMonth: Record<string, { sales: number; returns: number; inStock: number; outStock: number; revenue: number }> = {};
      
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
      
      // Generate predictions for next 3 periods
      const { forecasts, totalPredicted } = mlService.forecastRevenue(revenueHistory, 3);
      const predictions = forecasts.map((f, index) => {
        const lastMonth = sortedAccountingMonths[sortedAccountingMonths.length - 1];
        const [year, month] = lastMonth.split('-');
        const nextDate = new Date(parseInt(year), parseInt(month) + index, 1);
        
        return {
          period: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`,
          predicted: f.value,
          confidence: f.confidence
        };
      });
      
      // ============= ML INSIGHTS =============
      const prediction = mlService.predictNextValue(revenueHistory);
      const anomalyDetection = mlService.detectAnomalies(revenueHistory);
      
      const insights = {
        trend: prediction.trend,
        recommendation: prediction.recommendation,
        anomalies: anomalyDetection.anomalies.length,
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
          change: Math.floor(Math.random() * 40) - 10, // TODO: Calculate actual change
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 10);
      
      console.log(`[REPORTS] Top products:`, topProducts.length, 'products');

      const responseData = { 
        keyMetrics, 
        salesData, 
        inventoryTrends, 
        categoryData, 
        topProducts,
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

      const cacheKey = `sales:summary:${userId}:${month}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        res.set("X-Cache", "HIT");
        return res.json(cached);
      }

      const products = await storage.getProducts(undefined, userId);
      if (products.length === 0) {
        return res.json({ totalRevenue: 0, totalCOGS: 0, unitsSold: 0, grossProfit: 0 });
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

      const summary = {
        totalRevenue,
        totalCOGS,
        unitsSold,
        grossProfit: totalRevenue - totalCOGS,
      };

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
        // Get context for better responses
        const [products, stats] = await Promise.all([
          storage.getProducts(),
          storage.getDashboardStats()
        ]);

        const context = {
          totalProducts: products.length,
          lowStockItems: stats.lowStockItems || 0,
          totalRevenue: 0, // Calculate from products if needed
          recentSales: 0, // Calculate from transactions if needed
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
          sellerName: item.sellerName || 'Unknown Seller'
        })),
        totalAmount,
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

        const currentStock = product.quantity || 0;

        // Check stock availability
        if (currentStock < quantity) {
          return res.status(400).json({ 
            message: `Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${quantity}` 
          });
        }

        // Update product quantity (decrease)
        const newQuantity = currentStock - quantity;
        await storage.updateProduct(productId, { quantity: newQuantity });

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
