// Initialize Firebase Admin for Vercel Serverless
let admin, db, auth;

async function initializeFirebase() {
  if (db && auth) return { db, auth };

  // Dynamic import for serverless
  if (!admin) {
    admin = await import('firebase-admin');
  }

  if (admin.default.apps.length) {
    db = admin.default.firestore();
    auth = admin.default.auth();
    return { db, auth };
  }

  let serviceAccount;
  
  // Try to load from individual env vars first (preferred for Vercel)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    console.log('[Firebase Init] Using individual environment variables');
    
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;
    
    // Check if the key is base64 encoded (no BEGIN/END markers)
    if (!privateKey.includes('BEGIN PRIVATE KEY')) {
      console.log('[Firebase Init] Decoding base64-encoded private key');
      try {
        privateKey = Buffer.from(privateKey, 'base64').toString('utf8');
      } catch (e) {
        console.error('[Firebase Init] Failed to decode base64 private key:', e.message);
      }
    } else {
      // Replace escaped newlines with actual newlines
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    
    serviceAccount = {
      project_id: process.env.FIREBASE_PROJECT_ID,
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      private_key: privateKey,
    };
  } 
  // Fallback to FIREBASE_SERVICE_ACCOUNT JSON string
  else {
    const firebaseEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    
    if (!firebaseEnv || firebaseEnv === 'undefined' || firebaseEnv.trim() === '') {
      console.error('[Firebase Init] No Firebase credentials found in environment');
      console.error('[Firebase Init] Please set either:');
      console.error('[Firebase Init]   1. FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY (recommended)');
      console.error('[Firebase Init]   2. FIREBASE_SERVICE_ACCOUNT (JSON string)');
      throw new Error('Firebase credentials not configured. Please add Firebase environment variables in Vercel project settings.');
    }
    
    try {
      console.log('[Firebase Init] Parsing FIREBASE_SERVICE_ACCOUNT JSON');
      serviceAccount = JSON.parse(firebaseEnv);
      
      // Validate required fields
      if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
        throw new Error('Firebase service account is missing required fields (project_id, private_key, client_email)');
      }
    } catch (e) {
      console.error('[Firebase Init] Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
      throw new Error(`Invalid Firebase credentials: ${e.message}`);
    }
  }

  console.log('[Firebase Init] Initializing Firebase Admin with project:', serviceAccount.project_id);

  try {
    admin.default.initializeApp({
      credential: admin.default.credential.cert(serviceAccount)
    });

    db = admin.default.firestore();
    auth = admin.default.auth();
    
    console.log('[Firebase Init] ✅ Firebase initialized successfully');
    return { db, auth };
  } catch (error) {
    console.error('[Firebase Init] Failed to initialize Firebase:', error);
    throw new Error(`Firebase initialization failed: ${error.message}`);
  }
}

// CORS headers helper
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// Parse request body
async function parseBody(req) {
  if (req.body) return req.body;
  
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyText = Buffer.concat(chunks).toString();
    try {
      return JSON.parse(bodyText);
    } catch (e) {
      return {};
    }
  }
  return {};
}

// Parse query parameters
function parseQuery(url) {
  const urlParts = url.split('?');
  if (urlParts.length < 2) return {};
  
  const params = new URLSearchParams(urlParts[1]);
  const query = {};
  for (const [key, value] of params) {
    query[key] = value;
  }
  return query;
}

// Authentication middleware
async function authenticate(req) {
  const { auth } = await initializeFirebase();
  
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw { status: 401, message: 'Unauthorized - Missing token' };
  }
  
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    return decoded;
  } catch (error) {
    console.error('Auth error:', error);
    throw { status: 401, message: 'Unauthorized - Invalid token' };
  }
}

// Flexible authentication middleware that supports both query params and headers
async function authenticateFlexible(req) {
  const { auth } = await initializeFirebase();
  
  // Check for token in query param first (for new window access like waybills)
  const tokenFromQuery = req.query?.token;
  
  // Check for token in Authorization header
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  let token;
  if (tokenFromQuery) {
    token = tokenFromQuery;
    console.log('[Auth] Using token from query parameter');
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1];
    console.log('[Auth] Using token from Authorization header');
  } else {
    throw { status: 401, message: 'Unauthorized - Missing token' };
  }
  
  try {
    const decoded = await auth.verifyIdToken(token);
    console.log('[Auth] Token verified for user:', decoded.uid);
    return decoded;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    throw { status: 401, message: 'Unauthorized - Invalid token' };
  }
}

// Main handler
export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Initialize Firebase
    await initializeFirebase();

    // Parse body and query
    req.body = await parseBody(req);
    req.query = parseQuery(req.url);

    // Parse the path after /api/
    const urlPath = req.url.split('?')[0];
    const path = urlPath.replace(/^\/api\/?/, '');
    const pathParts = path.split('/').filter(Boolean);

    // ===== AUTH ROUTES (public) =====
    if (pathParts[0] === 'auth' && pathParts[1] === 'login' && req.method === 'POST') {
      return await handleLogin(req, res);
    }

    // ===== AUTH USER ROUTE (protected) =====
    if (pathParts[0] === 'auth' && pathParts[1] === 'user' && req.method === 'GET') {
      const user = await authenticate(req);
      return await handleGetUser(req, res, user);
    }

    // ===== USER SETTINGS ROUTES (protected) =====
    if (pathParts[0] === 'users' && pathParts[2] === 'settings' && req.method === 'PUT') {
      const user = await authenticate(req);
      const userId = pathParts[1];
      // Ensure user can only update their own settings
      if (user.uid !== userId) {
        return res.status(403).json({ message: 'Forbidden: Cannot update other user settings' });
      }
      return await handleUpdateUserSettings(req, res, user, userId);
    }

    // ===== DELETE USER DATA ROUTE (protected) =====
    if (pathParts[0] === 'users' && pathParts[2] === 'data' && req.method === 'DELETE') {
      const user = await authenticate(req);
      const userId = pathParts[1];
      // Ensure user can only delete their own data
      if (user.uid !== userId) {
        return res.status(403).json({ message: 'Forbidden: Cannot delete other user data' });
      }
      return await handleDeleteUserData(req, res, user, userId);
    }

    // ===== GET USER BY ID ROUTE (public) =====
    if (pathParts[0] === 'users' && pathParts.length === 2 && req.method === 'GET') {
      console.log('GET USER route matched, userId:', pathParts[1]);
      return await handleGetUserById(req, res, pathParts[1]);
    }

    // ===== GET SHOP BY SLUG ROUTE (public) =====
    if (pathParts[0] === 'shops' && pathParts[1] === 'by-slug' && pathParts.length === 3 && req.method === 'GET') {
      return await handleGetShopBySlug(req, res, pathParts[2]);
    }

    // ===== SEARCH SHOPS ROUTE (public) =====
    if (pathParts[0] === 'shops' && pathParts[1] === 'search' && req.method === 'GET') {
      return await handleSearchShops(req, res);
    }

    // ===== DASHBOARD ROUTES (protected) =====
    if (pathParts[0] === 'dashboard' && pathParts[1] === 'stats' && req.method === 'GET') {
      const user = await authenticate(req);
      return await handleDashboardStats(req, res, user);
    }

    // ===== PRODUCTS ROUTES (protected) =====
    if (pathParts[0] === 'products') {
      const user = await authenticate(req);

      // GET /api/products
      if (pathParts.length === 1 && req.method === 'GET') {
        return await handleGetProducts(req, res, user);
      }

      // POST /api/products
      if (pathParts.length === 1 && req.method === 'POST') {
        return await handleCreateProduct(req, res, user);
      }

      // GET /api/products/:id
      if (pathParts.length === 2 && req.method === 'GET') {
        return await handleGetProduct(req, res, user, pathParts[1]);
      }

      // PUT /api/products/:id
      if (pathParts.length === 2 && req.method === 'PUT') {
        return await handleUpdateProduct(req, res, user, pathParts[1]);
      }

      // DELETE /api/products/:id
      if (pathParts.length === 2 && req.method === 'DELETE') {
        return await handleDeleteProduct(req, res, user, pathParts[1]);
      }

      // POST /api/products/:id/qr
      if (pathParts.length === 3 && pathParts[2] === 'qr' && req.method === 'POST') {
        return await handleGenerateQR(req, res, user, pathParts[1]);
      }
    }

    // ===== PUBLIC PRODUCTS ROUTE (no auth) =====
    if (pathParts[0] === 'public' && pathParts[1] === 'products' && req.method === 'GET') {
      return await handleGetPublicProducts(req, res);
    }

    // ===== PUBLIC CATEGORIES ROUTE (no auth) =====
    if (pathParts[0] === 'public' && pathParts[1] === 'categories' && req.method === 'GET') {
      return await handleGetPublicCategories(req, res);
    }

    // ===== CATEGORIES ROUTES (protected) =====
    if (pathParts[0] === 'categories') {
      const user = await authenticate(req);
      
      if (req.method === 'GET') {
        return await handleGetCategories(req, res, user);
      }
      if (req.method === 'POST') {
        return await handleCreateCategory(req, res, user);
      }
    }

    // ===== QR ROUTES (public) =====
    if (pathParts[0] === 'qr' && pathParts.length >= 2) {
      const code = decodeURIComponent(pathParts.slice(1).join('/'));
      
      if (req.method === 'GET') {
        return await handleResolveQR(req, res, code);
      }
      
      if (pathParts.includes('confirm-sale') && req.method === 'POST') {
        const qrCode = pathParts.slice(1, pathParts.indexOf('confirm-sale')).join('/');
        return await handleConfirmSale(req, res, decodeURIComponent(qrCode));
      }
    }

    // ===== ACCOUNTING ROUTES (protected) =====
    if (pathParts[0] === 'accounting') {
      const user = await authenticate(req);

      // GET /api/accounting/entries
      if (pathParts[1] === 'entries' && pathParts.length === 2 && req.method === 'GET') {
        return await handleGetAccountingEntries(req, res, user);
      }

      // POST /api/accounting/entries
      if (pathParts[1] === 'entries' && pathParts.length === 2 && req.method === 'POST') {
        return await handleCreateAccountingEntry(req, res, user);
      }

      // DELETE /api/accounting/entries/:id
      if (pathParts[1] === 'entries' && pathParts.length === 3 && req.method === 'DELETE') {
        return await handleDeleteAccountingEntry(req, res, user, pathParts[2]);
      }

      // GET /api/accounting/sales-summary
      if (pathParts[1] === 'sales-summary' && req.method === 'GET') {
        return await handleGetSalesSummary(req, res, user);
      }
    }

    // ===== REPORTS ROUTE (protected) =====
    if (pathParts[0] === 'reports' && pathParts[1] === 'data' && req.method === 'GET') {
      const user = await authenticate(req);
      return await handleGetReportsData(req, res, user);
    }

    // ===== REPORTS CHAT ROUTE (protected) =====
    if (pathParts[0] === 'reports' && pathParts[1] === 'chat' && req.method === 'POST') {
      const user = await authenticate(req);
      return await handleReportsChat(req, res, user);
    }

    // ===== CHECKOUT ROUTE (public - no auth required) =====
    if (pathParts[0] === 'checkout' && req.method === 'POST') {
      return await handleCheckout(req, res);
    }

    // ===== CUSTOMER ORDERS ROUTE (public - no auth required) =====
    if (pathParts[0] === 'customer' && pathParts[1] === 'orders' && req.method === 'GET') {
      return await handleGetCustomerOrders(req, res);
    }

    // ===== CUSTOMER PROFILE ROUTES (public - no auth required) =====
    // GET /api/customer/profile/:customerId
    if (pathParts[0] === 'customer' && pathParts[1] === 'profile' && pathParts.length === 3 && req.method === 'GET') {
      return await handleGetCustomerProfile(req, res, pathParts[2]);
    }

    // POST /api/customer/profile
    if (pathParts[0] === 'customer' && pathParts[1] === 'profile' && pathParts.length === 2 && req.method === 'POST') {
      return await handleSaveCustomerProfile(req, res);
    }

    // ===== SELLER ORDERS ROUTE (public - no auth required) =====
    if (pathParts[0] === 'seller' && pathParts[1] === 'orders' && req.method === 'GET') {
      return await handleGetSellerOrders(req, res);
    }

    // ===== ORDER REFUND REQUEST ROUTE (public - no auth required) =====
    if (pathParts[0] === 'orders' && pathParts[2] === 'refund' && req.method === 'POST') {
      const orderId = pathParts[1];
      
      // Check if it's approve or reject
      if (pathParts[3] === 'approve') {
        return await handleApproveRefund(req, res, orderId);
      } else if (pathParts[3] === 'reject') {
        return await handleRejectRefund(req, res, orderId);
      } else {
        return await handleRefundRequest(req, res, orderId);
      }
    }

    // ===== ORDER ACCEPT ROUTE (requires auth) =====
    if (pathParts[0] === 'orders' && pathParts[2] === 'accept' && req.method === 'POST') {
      const orderId = pathParts[1];
      const user = await verifyAuth(req, res);
      if (!user) return;
      return await handleAcceptOrder(req, res, user, orderId);
    }

    // ===== EASY PARCEL / SHIPPING ROUTES =====
    // POST /api/shipping/create - Create shipment and get waybill
    if (pathParts[0] === 'shipping' && pathParts[1] === 'create' && req.method === 'POST') {
      console.log('[API ROUTE] Shipping create route matched');
      const user = await authenticate(req);
      console.log('[API ROUTE] User authenticated:', user.uid);
      console.log('[API ROUTE] Calling handleCreateShipment...');
      const result = await handleCreateShipment(req, res, user);
      console.log('[API ROUTE] handleCreateShipment completed');
      return result;
    }

    // GET /api/shipping/track/:trackingNo - Track shipment
    if (pathParts[0] === 'shipping' && pathParts[1] === 'track' && pathParts.length === 3 && req.method === 'GET') {
      return await handleTrackShipment(req, res, pathParts[2]);
    }

    // GET /api/shipping/waybill/:orderId - Download waybill PDF
    if (pathParts[0] === 'shipping' && pathParts[1] === 'waybill' && pathParts.length === 3 && req.method === 'GET') {
      console.log('[API ROUTE] Waybill route matched for orderId:', pathParts[2]);
      const user = await authenticateFlexible(req);
      console.log('[API ROUTE] User authenticated for waybill:', user.uid);
      return await handleDownloadWaybill(req, res, user, pathParts[2]);
    }

    // GET /api/shipping/services - Get available courier services
    if (pathParts[0] === 'shipping' && pathParts[1] === 'services' && req.method === 'GET') {
      const user = await authenticate(req);
      return await handleGetShippingServices(req, res);
    }

    // POST /api/shipping/bulk-waybill - Get bulk waybill for multiple orders
    if (pathParts[0] === 'shipping' && pathParts[1] === 'bulk-waybill' && req.method === 'POST') {
      const user = await authenticate(req);
      return await handleBulkWaybill(req, res, user);
    }

    // ===== COUPON ROUTES =====
    if (pathParts[0] === 'coupons') {
      if (req.method === 'GET') {
        return await handleGetCoupons(req, res);
      }
      if (req.method === 'POST') {
        return await handleCreateCoupon(req, res);
      }
      if (pathParts.length === 2 && req.method === 'DELETE') {
        return await handleDeleteCoupon(req, res, pathParts[1]);
      }
      if (pathParts.length === 2 && req.method === 'PATCH') {
        return await handleToggleCoupon(req, res, pathParts[1]);
      }
      if (pathParts[1] === 'validate' && req.method === 'POST') {
        return await handleValidateCoupon(req, res);
      }
    }

    // ===== SUBSCRIPTION ROUTES =====
    if (pathParts[0] === 'subscriptions') {
      if (req.method === 'POST') {
        return await handleSubscribe(req, res);
      }
      if (req.method === 'DELETE') {
        return await handleUnsubscribe(req, res);
      }
      if (req.method === 'GET' && pathParts[1] === 'check') {
        return await handleCheckSubscription(req, res);
      }
      if (req.method === 'GET' && pathParts[1] === 'count') {
        return await handleGetSubscriberCount(req, res);
      }
      if (req.method === 'GET' && pathParts[1] === 'list') {
        return await handleGetSubscriberList(req, res);
      }
    }

    // ===== NOTIFICATION ROUTES =====
    if (pathParts[0] === 'notifications') {
      if (req.method === 'GET') {
        return await handleGetNotifications(req, res);
      }
      if (pathParts.length === 2 && pathParts[1] === 'mark-read' && req.method === 'POST') {
        return await handleMarkNotificationsRead(req, res);
      }
      if (pathParts.length === 2 && pathParts[1] === 'broadcast' && req.method === 'POST') {
        return await handleBroadcastMessage(req, res);
      }
      if (pathParts.length === 2 && req.method === 'DELETE') {
        return await handleDeleteNotification(req, res, pathParts[1]);
      }
    }

    // ===== SHOP SEARCH ROUTE =====
    if (pathParts[0] === 'shops' && pathParts[1] === 'search' && req.method === 'GET') {
      return await handleSearchShops(req, res);
    }

    // ===== PAYMENT ROUTES (public - no auth required) =====
    if (pathParts[0] === 'payment') {
      // POST /api/payment/create-intent
      if (pathParts[1] === 'create-intent' && req.method === 'POST') {
        return await handleCreatePaymentIntent(req, res);
      }

      // POST /api/payment/webhook
      if (pathParts[1] === 'webhook' && req.method === 'POST') {
        return await handlePaymentWebhook(req, res);
      }
    }

    // ===== EMAIL NOTIFICATION ROUTES (protected, or dev mode) =====
    if (pathParts[0] === 'notifications' && pathParts[1] === 'test-email' && req.method === 'POST') {
      console.log('[TEST-EMAIL] Request received');
      console.log('[TEST-EMAIL] NODE_ENV:', process.env.NODE_ENV);
      console.log('[TEST-EMAIL] req.body:', req.body);
      console.log('[TEST-EMAIL] userId from body:', req.body.userId);
      
      // In development, allow testing without auth if userId is provided
      if (process.env.NODE_ENV === 'development' && req.body.userId) {
        console.log('[TEST-EMAIL] Using dev mode with userId:', req.body.userId);
        const mockUser = { uid: req.body.userId };
        return await handleTestEmail(req, res, mockUser);
      }
      console.log('[TEST-EMAIL] Requiring authentication');
      const user = await authenticate(req);
      return await handleTestEmail(req, res, user);
    }

    // ===== CRON JOB ROUTES (public with secret) =====
    if (pathParts[0] === 'cron') {
      if (pathParts[1] === 'daily-report' && req.method === 'POST') {
        return await handleDailyReportCron(req, res);
      }
      if (pathParts[1] === 'weekly-summary' && req.method === 'POST') {
        return await handleWeeklySummaryCron(req, res);
      }
      // If cron path matched but method isn't POST
      if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed. Use POST.' });
      }
      // Unknown cron job
      return res.status(404).json({ 
        message: 'Unknown cron job', 
        available: ['daily-report', 'weekly-summary'] 
      });
    }

    // ===== HEALTH CHECK ROUTE (for debugging) =====
    if (pathParts[0] === 'health' && req.method === 'GET') {
      return await handleHealthCheck(req, res);
    }

    // Route not found
    return res.status(404).json({ message: 'Route not found', path: pathParts.join('/') });

  } catch (error) {
    console.error('[API Error] Handler error:', error);
    console.error('[API Error] Request URL:', req.url);
    console.error('[API Error] Request method:', req.method);
    console.error('[API Error] Stack:', error.stack);
    
    // Check if it's a Firebase initialization error
    if (error.message && error.message.includes('Firebase')) {
      console.error('[API Error] Firebase initialization failed - check environment variables');
      return res.status(500).json({ 
        message: 'Database connection failed',
        details: 'Firebase credentials not configured properly. Please contact administrator.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: error.message || 'Internal server error',
      details: 'An unexpected error occurred. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ===== HANDLER FUNCTIONS =====

async function handleLogin(req, res) {
  const { auth } = await initializeFirebase();
  const { db } = await initializeFirebase();
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ message: 'Missing token' });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    const { uid, email, name, picture } = decoded;
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        uid,
        email,
        name: name || 'Unnamed User',
        picture: picture || null,
        companyName: '', // Initialize empty company name
        timezone: 'UTC', // Initialize default timezone
        createdAt: new Date().toISOString()
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
    return res.json({ message: 'Login successful', user: userData });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

async function handleGetUser(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userData = userDoc.exists ? userDoc.data() : { uid: user.uid, email: user.email };
    return res.json(userData);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user' });
  }
}

async function handleUpdateUserSettings(req, res, user, userId) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
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
    
    const userRef = db.collection('users').doc(userId);
    const updateData = {
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
        updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      },
      // Also store key fields at top level for easier querying
      companyName: companyName || '',
      shopSlug: shopSlug || '',
      shopDescription: shopDescription || '',
      shopBannerUrl: shopBannerUrl || '',
      shopLogoUrl: shopLogoUrl || '',
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    };
    
    await userRef.set(updateData, { merge: true });
    
    return res.json({ 
      success: true, 
      message: 'Settings updated successfully',
      data: updateData.settings
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return res.status(500).json({ message: 'Failed to update settings', error: error.message });
  }
}

async function handleDeleteUserData(req, res, user, userId) {
  const { db } = await initializeFirebase();
  
  try {
    console.log(`[DELETE USER DATA] Deleting all data for user: ${userId}`);

    // Delete all products
    const productsSnapshot = await db.collection('products').where('userId', '==', userId).get();
    const productDeletes = productsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(productDeletes);
    console.log(`[DELETE USER DATA] Deleted ${productsSnapshot.size} products`);

    // Delete all orders - need to check all orders since we need to check both customerId and sellerId in items
    const allOrdersSnapshot = await db.collection('orders').get();
    const orderDeletes = [];
    
    for (const doc of allOrdersSnapshot.docs) {
      const order = doc.data();
      // Delete if user is customer OR if user is seller in any item
      if (order.customerId === userId || (order.items && Array.isArray(order.items) && order.items.some(item => item.sellerId === userId))) {
        orderDeletes.push(doc.ref.delete());
      }
    }
    
    await Promise.all(orderDeletes);
    console.log(`[DELETE USER DATA] Deleted ${orderDeletes.length} orders`);

    // Delete all accounting entries
    const accountingSnapshot = await db.collection('accountingEntries').where('userId', '==', userId).get();
    const accountingDeletes = accountingSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(accountingDeletes);
    console.log(`[DELETE USER DATA] Deleted ${accountingSnapshot.size} accounting entries`);

    // Delete all QR codes (if stored separately)
    const qrCodesSnapshot = await db.collection('qrcodes').where('userId', '==', userId).get();
    const qrCodeDeletes = qrCodesSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(qrCodeDeletes);
    console.log(`[DELETE USER DATA] Deleted ${qrCodesSnapshot.size} QR codes`);

    // Reset user settings (keep the user account but clear settings)
    await db.collection('users').doc(userId).update({
      settings: {},
      companyName: '',
      businessAddress: '',
      phoneNumber: '',
      shopDescription: '',
      shopBannerUrl: '',
      shopLogoUrl: '',
      updatedAt: new Date(),
    });
    console.log(`[DELETE USER DATA] Reset user settings`);

    console.log(`[DELETE USER DATA] Successfully deleted all data for user: ${userId}`);
    return res.json({ 
      message: 'All account data deleted successfully',
      deletedCounts: {
        products: productsSnapshot.size,
        orders: orderDeletes.length,
        accountingEntries: accountingSnapshot.size,
        qrCodes: qrCodesSnapshot.size,
      }
    });
  } catch (error) {
    console.error('Error deleting user data:', error);
    return res.status(500).json({ message: 'Failed to delete user data', error: error.message });
  }
}

async function handleGetUserById(req, res, userId) {
  const { db } = await initializeFirebase();
  
  try {
    console.log('Fetching user document for userId:', userId);
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log('User document not found for userId:', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = userDoc.data();
    console.log('User data retrieved:', {
      id: userDoc.id,
      hasCompanyName: !!userData.companyName,
      hasSettings: !!userData.settings
    });
    
    const settings = userData.settings || {};
    
    // Return public shop information
    const response = {
      id: userDoc.id,
      companyName: userData.companyName || 'Shop',
      email: userData.email,
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
    
    console.log('Returning user data:', response);
    return res.json(response);
  } catch (error) {
    console.error('Error fetching user:', error);
    return res.status(500).json({ message: 'Failed to fetch user', error: error.message });
  }
}

async function handleGetShopBySlug(req, res, slug) {
  const { db } = await initializeFirebase();
  
  try {
    console.log('Fetching shop by slug:', slug);
    
    // Query users by shopSlug field
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
    
    const userData = matchedUser;
    const settings = userData.settings || {};
    
    const response = {
      id: userData.id,
      companyName: userData.companyName || 'Shop',
      email: userData.email,
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
    return res.json(response);
  } catch (error) {
    console.error('Error fetching shop by slug:', error);
    return res.status(500).json({ message: 'Failed to fetch shop', error: error.message });
  }
}

async function handleSearchShops(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const query = (req.query.query || '').toLowerCase().trim();
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    console.log('Searching shops for:', query);
    
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
    
    // Sort by relevance (company name matches first, then alphabetical)
    shops.sort((a, b) => {
      const aNameMatch = a.companyName.toLowerCase().startsWith(query);
      const bNameMatch = b.companyName.toLowerCase().startsWith(query);
      
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      return a.companyName.localeCompare(b.companyName);
    });
    
    console.log(`Found ${shops.length} matching shops`);
    return res.json(shops.slice(0, 10)); // Limit to 10 results
  } catch (error) {
    console.error('Error searching shops:', error);
    return res.status(500).json({ message: 'Failed to search shops', error: error.message });
  }
}

async function handleGetProducts(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const search = req.query.search;
    
    // Filter products by userId for multi-user support
    const snapshot = await db.collection('products')
      .where('userId', '==', user.uid)
      .get();
    
    let products = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p => 
        (p.name || '').toLowerCase().includes(s) || 
        (p.sku || '').toLowerCase().includes(s)
      );
    }
    
    return res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
}

async function handleGetPublicProducts(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const search = req.query.search;
    const sellerId = req.query.sellerId;
    
    // Build query based on filters
    let query = db.collection('products');
    
    // Filter by sellerId if provided
    if (sellerId) {
      query = query.where('userId', '==', sellerId);
    }
    
    const snapshot = await query.get();
    
    let products = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
    
    // Apply client-side search filter if provided
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p => 
        (p.name || '').toLowerCase().includes(s) || 
        (p.sku || '').toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s)
      );
    }
    
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
        return { ...product, companyName: 'Unknown Seller', sellerName: 'Unknown Seller', shopSlug: '' };
      })
    );
    
    return res.json(productsWithCompanyNames);
  } catch (error) {
    console.error('Error fetching public products:', error);
    return res.status(500).json({ message: 'Failed to fetch products', error: error.message });
  }
}

async function handleGetProduct(req, res, user, productId) {
  const { db } = await initializeFirebase();
  
  try {
    const doc = await db.collection('products').doc(productId).get();
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    const product = { id: doc.id, ...doc.data() };
    if (product.userId !== user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    return res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return res.status(500).json({ message: 'Failed to fetch product' });
  }
}

async function handleCreateProduct(req, res, user) {
  const { db, auth } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const productData = req.body;
    
    // Validate required fields (check for both missing and empty strings)
    const hasName = productData.name && productData.name.trim() !== '';
    const hasSku = productData.sku && productData.sku.trim() !== '';
    const hasCategoryId = productData.categoryId && productData.categoryId.trim() !== '';
    
    if (!hasName || !hasSku || !hasCategoryId) {
      console.error('Missing required fields:', { 
        name: productData.name, 
        sku: productData.sku, 
        categoryId: productData.categoryId 
      });
      return res.status(400).json({ 
        message: 'Missing required fields: name, sku, and categoryId are required',
        missing: {
          name: !hasName,
          sku: !hasSku,
          categoryId: !hasCategoryId
        },
        received: {
          name: productData.name,
          sku: productData.sku,
          categoryId: productData.categoryId
        }
      });
    }
    
    const ref = db.collection('products').doc();
    const newProduct = {
      ...productData,
      id: ref.id,
      userId: user.uid,
      userEmail: user.email,
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      isActive: productData.isActive ?? true,
      quantity: productData.quantity ?? 0
    };
    
    console.log('Creating product:', { name: newProduct.name, sku: newProduct.sku, userId: user.uid });
    await ref.set(newProduct);
    console.log('Product created successfully:', ref.id);
    
    // Fetch the created document to get actual timestamps
    const createdDoc = await ref.get();
    const createdData = createdDoc.data();
    
    // Convert timestamps to ISO strings for JSON serialization
    const responseData = {
      id: ref.id,
      ...createdData,
      createdAt: createdData.createdAt?.toDate?.()?.toISOString() || createdData.createdAt,
      updatedAt: createdData.updatedAt?.toDate?.()?.toISOString() || createdData.updatedAt
    };
    
    return res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating product:', error);
    console.error('Product data:', req.body);
    return res.status(400).json({ 
      message: 'Failed to create product',
      error: error.message || 'Unknown error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function handleUpdateProduct(req, res, user, productId) {
  const { db, auth } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const productRef = db.collection('products').doc(productId);
    const doc = await productRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (doc.data().userId !== user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await productRef.update({
      ...req.body,
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });
    
    // Fetch the updated document to get the actual timestamp
    const updatedDoc = await productRef.get();
    const updatedData = updatedDoc.data();
    
    // Convert timestamps to ISO strings for JSON serialization
    const responseData = {
      id: productId,
      ...updatedData,
      createdAt: updatedData.createdAt?.toDate?.()?.toISOString() || updatedData.createdAt,
      updatedAt: updatedData.updatedAt?.toDate?.()?.toISOString() || updatedData.updatedAt
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error updating product:', error);
    return res.status(400).json({ message: 'Failed to update product' });
  }
}

async function handleDeleteProduct(req, res, user, productId) {
  const { db } = await initializeFirebase();
  
  try {
    const productRef = db.collection('products').doc(productId);
    const doc = await productRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (doc.data().userId !== user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await productRef.delete();
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    return res.status(500).json({ message: 'Failed to delete product' });
  }
}

async function handleGenerateQR(req, res, user, productId) {
  const { db, auth } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const productRef = db.collection('products').doc(productId);
    const doc = await productRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (doc.data().userId !== user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const uniqueCode = `${productId}:${Date.now()}`;
    await productRef.update({ 
      qrCode: uniqueCode,
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });
    
    return res.json({ productId, qrCode: uniqueCode });
  } catch (error) {
    console.error('Error generating QR:', error);
    return res.status(500).json({ message: 'Failed to generate QR code' });
  }
}

async function handleDashboardStats(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    // Filter products by userId for multi-user support
    const productsSnap = await db.collection('products')
      .where('userId', '==', user.uid)
      .get();
    
    const products = productsSnap.docs.map(doc => doc.data());
    const totalProducts = products.length;
    
    // Count low stock items (quantity <= minStockLevel)
    const lowStockItems = products.filter(p => {
      const qty = parseInt(p.quantity) || 0;
      const minStock = parseInt(p.minStockLevel) || 0;
      return qty <= minStock && minStock > 0;
    }).length;
    
    // Calculate total value (price * quantity)
    const totalValue = products.reduce((sum, p) => {
      const price = parseFloat(p.price) || 0;
      const quantity = parseInt(p.quantity) || 0;
      return sum + (price * quantity);
    }, 0);
    
    // Return consistent format
    const stats = {
      totalProducts: totalProducts,
      lowStockItems: lowStockItems,
      totalValue: `$${totalValue.toFixed(2)}`,
      ordersToday: 0
    };
    
    console.log('Dashboard stats:', stats);
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch dashboard stats',
      error: error.message 
    });
  }
}

async function handleGetCategories(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    // Filter categories by userId for multi-user support
    const snapshot = await db.collection('categories')
      .where('userId', '==', user.uid)
      .get();
    
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ message: 'Failed to fetch categories' });
  }
}

async function handleGetPublicCategories(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    // Get ALL categories (no user filter for public view)
    const snapshot = await db.collection('categories')
      .orderBy('createdAt', 'desc')
      .get();
    
    const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return res.json(categories);
  } catch (error) {
    console.error('Error fetching public categories:', error);
    return res.status(500).json({ message: 'Failed to fetch categories' });
  }
}

async function handleCreateCategory(req, res, user) {
  const { db, auth } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const categoryData = req.body;
    const ref = db.collection('categories').doc();
    const newCategory = {
      ...categoryData,
      id: ref.id,
      userId: user.uid,
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    };
    
    await ref.set(newCategory);
    return res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    return res.status(400).json({ message: 'Failed to create category' });
  }
}

async function handleResolveQR(req, res, code) {
  const { db } = await initializeFirebase();
  
  try {
    const snapshot = await db.collection('products')
      .where('qrCode', '==', code)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'QR not found' });
    }
    
    const doc = snapshot.docs[0];
    const product = { id: doc.id, ...doc.data() };
    return res.json({ product });
  } catch (error) {
    console.error('Error resolving QR:', error);
    return res.status(500).json({ message: 'Failed to resolve QR' });
  }
}

async function handleConfirmSale(req, res, code) {
  const { db, auth } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const snapshot = await db.collection('products')
      .where('qrCode', '==', code)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'QR not found' });
    }
    
    const doc = snapshot.docs[0];
    const productRef = doc.ref;
    
    await db.runTransaction(async (transaction) => {
      const productDoc = await transaction.get(productRef);
      if (!productDoc.exists) {
        throw new Error('Product not found');
      }
      
      const data = productDoc.data();
      const currentQty = data.quantity || 0;
      const newQty = Math.max(0, currentQty - 1);
      
      transaction.update(productRef, {
        quantity: newQty,
        updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      });
    });
    
    const updated = await productRef.get();
    return res.json({ success: true, product: { id: doc.id, ...updated.data() } });
  } catch (error) {
    console.error('Error confirming sale via QR:', error);
    return res.status(500).json({ message: 'Failed to confirm sale' });
  }
}

// ===== ACCOUNTING HANDLERS =====

async function handleGetAccountingEntries(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const userId = user.uid;
    const month = req.query.month;
    const limitParam = req.query.limit;

    console.log('[handleGetAccountingEntries] Fetching for userId:', userId, 'month:', month);

    let query = db.collection('accountingEntries').where('userId', '==', userId);

    // Handle month filtering
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
      }

      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;

      const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
      const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

      query = query
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate);
    }

    // Apply ordering
    query = query.orderBy('createdAt', 'desc');

    // Apply limit
    if (limitParam) {
      const limit = Math.min(Number(limitParam), 1000);
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit);
      }
    }

    const snapshot = await query.get();
    const entries = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      };
    });

    console.log('[handleGetAccountingEntries] Found', entries.length, 'entries for user', userId);
    // Log first entry for debugging
    if (entries.length > 0) {
      console.log('[handleGetAccountingEntries] Sample entry:', {
        id: entries[0].id,
        userId: entries[0].userId,
        accountName: entries[0].accountName
      });
    }

    return res.json(entries);
  } catch (error) {
    console.error('Error fetching accounting entries:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch accounting entries',
      error: error.message 
    });
  }
}

async function handleCreateAccountingEntry(req, res, user) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const entryData = req.body;
    
    // Validate required fields
    if (!entryData.accountType || !entryData.accountName) {
      return res.status(400).json({ 
        message: 'Missing required fields: accountType and accountName are required' 
      });
    }

    const ref = db.collection('accountingEntries').doc();
    const newEntry = {
      ...entryData,
      id: ref.id,
      userId: user.uid,
      debitAmount: entryData.debitAmount || '0',
      creditAmount: entryData.creditAmount || '0',
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(newEntry);

    // Fetch the created document to get actual timestamp
    const createdDoc = await ref.get();
    const createdData = createdDoc.data();

    const responseData = {
      id: ref.id,
      ...createdData,
      createdAt: createdData.createdAt?.toDate?.()?.toISOString() || createdData.createdAt
    };

    return res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating accounting entry:', error);
    return res.status(400).json({ 
      message: 'Failed to create accounting entry',
      error: error.message 
    });
  }
}

async function handleDeleteAccountingEntry(req, res, user, entryId) {
  const { db } = await initializeFirebase();
  
  try {
    const entryRef = db.collection('accountingEntries').doc(entryId);
    const doc = await entryRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Accounting entry not found' });
    }

    const data = doc.data();
    if (data.userId !== user.uid) {
      return res.status(403).json({ message: 'Not allowed to delete this entry' });
    }

    await entryRef.delete();
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting accounting entry:', error);
    return res.status(500).json({ 
      message: 'Failed to delete accounting entry',
      error: error.message 
    });
  }
}

async function handleGetSalesSummary(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const month = req.query.month;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
    }

    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));

    // Get user's products
    const productsSnap = await db.collection('products')
      .where('userId', '==', user.uid)
      .get();

    if (productsSnap.empty) {
      return res.json({ totalRevenue: 0, totalCOGS: 0, unitsSold: 0, grossProfit: 0 });
    }

    const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const productIds = products.map(p => p.id);
    const productById = new Map(products.map(p => [p.id, p]));

    // Get transactions for the month (batch if needed)
    let allTransactions = [];
    const batchSize = 10;
    
    for (let i = 0; i < productIds.length; i += batchSize) {
      const batch = productIds.slice(i, i + batchSize);
      const txSnap = await db.collection('inventoryTransactions')
        .where('productId', 'in', batch)
        .where('createdAt', '>=', startDate)
        .where('createdAt', '<=', endDate)
        .get();
      
      allTransactions = allTransactions.concat(txSnap.docs.map(doc => doc.data()));
    }

    let totalRevenue = 0;
    let totalCOGS = 0;
    let unitsSold = 0;

    for (const tx of allTransactions) {
      if (tx.type !== 'out') continue;
      
      const product = productById.get(tx.productId);
      const unitPrice = tx.unitPrice 
        ? parseFloat(tx.unitPrice) 
        : product ? parseFloat(product.price || 0) : 0;
      const costPrice = product && product.costPrice ? parseFloat(product.costPrice) : 0;
      const qty = tx.quantity || 0;

      totalRevenue += unitPrice * qty;
      totalCOGS += costPrice * qty;
      unitsSold += qty;
    }

    // Calculate current inventory value (cost price * quantity on hand)
    let totalInventoryValue = 0;
    for (const product of products) {
      const qty = product.quantity || 0;
      const cost = product.costPrice ? parseFloat(product.costPrice) : 0;
      totalInventoryValue += qty * cost;
    }
    
    console.log('[SALES SUMMARY] Inventory calculation:', {
      productsCount: products.length,
      totalInventoryValue,
      sampleProduct: products[0] ? {
        name: products[0].name,
        quantity: products[0].quantity,
        costPrice: products[0].costPrice
      } : 'none'
    });

    const summary = {
      totalRevenue,
      totalCOGS,
      unitsSold,
      grossProfit: totalRevenue - totalCOGS,
      inventoryValue: totalInventoryValue
    };
    
    console.log('[SALES SUMMARY] Returning summary:', summary);

    return res.json(summary);
  } catch (error) {
    console.error('Error fetching sales summary:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch sales summary',
      error: error.message 
    });
  }
}

// ===== CHECKOUT HANDLER =====
async function handleCheckout(req, res) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const { customerName, customerEmail, customerPhone, shippingAddress, notes, items, totalAmount, customerId, subtotal, discount, couponCode } = req.body;

    console.log('[CHECKOUT] Processing order:', { customerName, itemCount: items.length, totalAmount, customerId, couponCode });

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }

    // If coupon was used, increment usage count
    if (couponCode) {
      const couponSnapshot = await db.collection('coupons')
        .where('code', '==', couponCode.toUpperCase())
        .limit(1)
        .get();

      if (!couponSnapshot.empty) {
        const couponDoc = couponSnapshot.docs[0];
        const currentCount = couponDoc.data().usedCount || 0;
        await db.collection('coupons').doc(couponDoc.id).update({
          usedCount: currentCount + 1
        });
        console.log('[CHECKOUT] Incremented coupon usage:', couponCode);
      }
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
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        sellerId: item.userId,
        sellerName: item.sellerName || 'Unknown Seller'
      })),
      subtotal: subtotal || totalAmount,
      discount: discount || 0,
      couponCode: couponCode || null,
      totalAmount,
      status: 'pending',
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
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
      const productDoc = await db.collection('products').doc(productId).get();
      
      if (!productDoc.exists) {
        return res.status(404).json({ message: `Product ${productId} not found` });
      }

      const product = productDoc.data();
      const currentStock = product.quantity || 0;

      // Check stock availability
      if (currentStock < quantity) {
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name}. Available: ${currentStock}, Requested: ${quantity}` 
        });
      }

      // Update product quantity (decrease)
      const newQuantity = currentStock - quantity;
      await db.collection('products').doc(productId).update({
        quantity: newQuantity,
        updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[CHECKOUT] Updated ${product.name}: ${currentStock} -> ${newQuantity}`);

      // Create inventory transaction (out)
      const transactionRef = db.collection('inventoryTransactions').doc();
      const transaction = {
        id: transactionRef.id,
        productId,
        type: 'out',
        quantity,
        previousQuantity: currentStock,
        newQuantity,
        unitPrice,
        totalValue: unitPrice * quantity,
        reason: 'Customer purchase',
        reference: orderNumber,
        notes: `Order by ${customerName} (${customerPhone})`,
        createdBy: 'customer',
        createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      };
      
      await transactionRef.set(transaction);
      console.log(`[CHECKOUT] Created transaction:`, transactionRef.id);

      // Create accounting entry for revenue (for the product owner)
      const revenue = unitPrice * quantity;
      const accountingRef = db.collection('accountingEntries').doc();
      const accountingEntry = {
        id: accountingRef.id,
        userId: userId, // Product owner's userId
        accountType: 'revenue',
        accountName: 'Sales Revenue',
        debitAmount: '0',
        creditAmount: revenue.toString(),
        description: `Sale of ${quantity}x ${product.name} - Order #${orderNumber}`,
        transactionId: transactionRef.id,
        createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      };
      
      await accountingRef.set(accountingEntry);
      console.log(`[CHECKOUT] Created accounting entry for user ${userId}: $${revenue}`);
    }

    console.log(`[CHECKOUT] Order ${orderNumber} completed successfully`);

    return res.status(201).json({
      success: true,
      orderNumber,
      orderId: orderRef.id,
      message: 'Order placed successfully',
      totalAmount
    });

  } catch (error) {
    console.error('[CHECKOUT] Error processing order:', error);
    return res.status(500).json({ 
      message: 'Failed to process order',
      error: error.message 
    });
  }
}

// ===== GET CUSTOMER ORDERS HANDLER =====
async function handleGetCustomerOrders(req, res) {
  const { db } = await initializeFirebase();
  
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

    return res.json(orders);

  } catch (error) {
    console.error('[GET ORDERS] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
}

// ===== GET CUSTOMER PROFILE HANDLER =====
async function handleGetCustomerProfile(req, res, customerId) {
  const { db } = await initializeFirebase();
  
  try {
    console.log('[GET PROFILE] Fetching profile for customer:', customerId);

    const profileDoc = await db.collection('customerProfiles').doc(customerId).get();

    if (!profileDoc.exists) {
      return res.json(null);
    }

    const profile = {
      id: profileDoc.id,
      ...profileDoc.data()
    };

    return res.json(profile);

  } catch (error) {
    console.error('[GET PROFILE] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch profile',
      error: error.message 
    });
  }
}

// ===== SAVE CUSTOMER PROFILE HANDLER =====
async function handleSaveCustomerProfile(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { customerId, displayName, phoneNumber, address, city, state, postalCode, country } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID required' });
    }

    console.log('[SAVE PROFILE] Saving profile for customer:', customerId);

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

    return res.json({ 
      message: 'Profile saved successfully',
      profile: profileData 
    });

  } catch (error) {
    console.error('[SAVE PROFILE] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to save profile',
      error: error.message 
    });
  }
}

// ===== GET SELLER ORDERS HANDLER =====
async function handleGetSellerOrders(req, res) {
  const { db } = await initializeFirebase();
  
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
      .filter(order => {
        // Check if any item in the order belongs to this seller
        return order.items?.some(item => item.sellerId === sellerId);
      });

    console.log('[GET SELLER ORDERS] Found', sellerOrders.length, 'orders for seller');

    return res.json(sellerOrders);

  } catch (error) {
    console.error('[GET SELLER ORDERS] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
}

// ===== REFUND REQUEST HANDLER =====
async function handleRefundRequest(req, res, orderId) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
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
      refundRequestedAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    console.log('[REFUND REQUEST] Refund request submitted for order:', orderNumber);

    return res.json({
      success: true,
      message: 'Refund request submitted successfully'
    });

  } catch (error) {
    console.error('[REFUND REQUEST] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to submit refund request',
      error: error.message 
    });
  }
}

// ===== APPROVE REFUND HANDLER =====
async function handleApproveRefund(req, res, orderId) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
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
          updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
        });

        // Create inventory transaction for the return
        await db.collection('inventoryTransactions').add({
          productId: item.productId,
          type: 'in',
          quantity: item.quantity,
          reason: `Return from order ${orderData.orderNumber}`,
          notes: `Refund approved - items returned to stock`,
          createdAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
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
      refundApprovedAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    console.log('[APPROVE REFUND] Refund approved for order:', orderData.orderNumber);

    return res.json({
      success: true,
      message: 'Refund approved successfully'
    });

  } catch (error) {
    console.error('[APPROVE REFUND] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to approve refund',
      error: error.message 
    });
  }
}

// ===== REJECT REFUND HANDLER =====
async function handleRejectRefund(req, res, orderId) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
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
      refundRejectedAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    console.log('[REJECT REFUND] Refund rejected for order:', orderData.orderNumber);

    return res.json({
      success: true,
      message: 'Refund request rejected'
    });

  } catch (error) {
    console.error('[REJECT REFUND] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to reject refund request',
      error: error.message 
    });
  }
}

// ===== ACCEPT ORDER HANDLER =====
async function handleAcceptOrder(req, res, user, orderId) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
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

    // Verify order belongs to the seller
    if (orderData?.sellerId !== user.uid) {
      return res.status(403).json({ message: 'Unauthorized - You can only accept your own orders' });
    }

    // Check if order is in pending status
    if (orderData?.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending orders can be accepted' });
    }

    // Update order with acceptance and shipment tracking
    await db.collection('orders').doc(orderId).update({
      status: 'processing',
      shipmentId: shipmentId.trim(),
      acceptedAt: adminModule.default.firestore.FieldValue.serverTimestamp(),
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    console.log('[ACCEPT ORDER] Order accepted:', orderData.orderNumber, 'Tracking:', shipmentId);

    return res.json({
      success: true,
      message: 'Order accepted successfully',
      order: {
        ...orderData,
        id: orderId,
        status: 'processing',
        shipmentId: shipmentId.trim()
      }
    });

  } catch (error) {
    console.error('[ACCEPT ORDER] Error:', error);
    return res.status(500).json({ 
      message: 'Failed to accept order',
      error: error.message 
    });
  }
}

// ===== REPORTS DATA HANDLER =====
async function handleGetReportsData(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const userId = user.uid;
    console.log(`[REPORTS] Generating report for user: ${userId}`);

    // Get user-specific products
    const productsSnap = await db.collection('products')
      .where('userId', '==', userId)
      .get();
    const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Get user-specific categories
    const categoriesSnap = await db.collection('categories')
      .where('userId', '==', userId)
      .get();
    const categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    console.log(`[REPORTS] Fetched ${products.length} products, ${categories.length} categories`);

    // Get accounting entries
    let accountingEntries = [];
    try {
      const accountingSnap = await db.collection('accountingEntries')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      accountingEntries = accountingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[REPORTS] Fetched ${accountingEntries.length} accounting entries`);
    } catch (error) {
      console.error(`[REPORTS] Error fetching accounting entries:`, error.message);
      accountingEntries = [];
    }

    // Get transactions for user's products
    const productIds = products.map(p => p.id);
    let transactions = [];
    
    if (productIds.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const txSnap = await db.collection('inventoryTransactions')
          .where('productId', 'in', batch)
          .get();
        transactions = transactions.concat(txSnap.docs.map(doc => doc.data()));
      }
    }

    console.log(`[REPORTS] Found ${transactions.length} transactions`);

    // Also get orders to supplement data (for Kaggle imports and historical data)
    const ordersSnapshot = await db.collection('orders')
      .where('sellerId', '==', userId)
      .get();
    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`[REPORTS] Found ${orders.length} orders for user`);

    // Calculate metrics from both transactions and orders
    let unitsSold = transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);

    const productById = new Map(products.map(p => [p.id, p]));
    let totalRevenueNumber = transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => {
        const product = productById.get(t.productId);
        const price = product ? parseFloat(product.price || 0) : 0;
        return sum + price * (t.quantity || 0);
      }, 0);

    // Add order data if available
    for (const order of orders) {
      if (order.status === 'completed' || order.status === 'paid') {
        const orderAmount = parseFloat(order.totalAmount || 0);
        totalRevenueNumber += orderAmount;
        
        // Count items sold from order
        if (order.items && Array.isArray(order.items)) {
          unitsSold += order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        }
      }
    }

    const keyMetrics = {
      totalRevenue: `$${totalRevenueNumber.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      unitsSold,
      avgOrderValue: unitsSold > 0 ? `$${(totalRevenueNumber / unitsSold).toFixed(2)}` : '$0',
      returnRate: '0%'
    };

    // Group by month
    const monthKey = (date) => {
      const d = date.toDate ? date.toDate() : new Date(date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const byMonth = {};
    
    // Process inventory transactions
    for (const tx of transactions) {
      const key = monthKey(tx.createdAt);
      byMonth[key] = byMonth[key] || { sales: 0, returns: 0, inStock: 0, outStock: 0, revenue: 0 };
      
      if (tx.type === 'in') byMonth[key].inStock += tx.quantity || 0;
      if (tx.type === 'out') {
        byMonth[key].outStock += tx.quantity || 0;
        byMonth[key].sales += tx.quantity || 0;
        const product = productById.get(tx.productId);
        const price = product ? parseFloat(product.price || 0) : 0;
        byMonth[key].revenue += price * (tx.quantity || 0);
      }
    }

    // Process orders to supplement transaction data (important for Kaggle data)
    for (const order of orders) {
      if (order.status === 'completed' || order.status === 'paid') {
        const key = monthKey(order.createdAt);
        byMonth[key] = byMonth[key] || { sales: 0, returns: 0, inStock: 0, outStock: 0, revenue: 0 };
        
        const orderAmount = parseFloat(order.totalAmount || 0);
        byMonth[key].revenue += orderAmount;
        
        // Count items sold from order
        if (order.items && Array.isArray(order.items)) {
          const itemCount = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
          byMonth[key].sales += itemCount;
          byMonth[key].outStock += itemCount;
        }
      }
    }

    const sortedMonths = Object.keys(byMonth).sort();
    const salesData = sortedMonths.map(m => ({ month: m, sales: byMonth[m].sales, returns: byMonth[m].returns }));
    const inventoryTrends = sortedMonths.map(m => ({ month: m, inStock: byMonth[m].inStock, outStock: byMonth[m].outStock }));

    // Accounting data
    const accountingByMonth = {};
    for (const entry of accountingEntries) {
      const key = monthKey(entry.createdAt);
      accountingByMonth[key] = accountingByMonth[key] || { revenue: 0, expenses: 0, profit: 0 };
      
      const debit = parseFloat(entry.debitAmount || 0);
      const credit = parseFloat(entry.creditAmount || 0);
      
      if (entry.accountType === 'revenue') accountingByMonth[key].revenue += credit;
      else if (entry.accountType === 'expense') accountingByMonth[key].expenses += debit;
    }

    // Add transaction revenue
    for (const month in byMonth) {
      accountingByMonth[month] = accountingByMonth[month] || { revenue: 0, expenses: 0, profit: 0 };
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

    // Cash flow
    const cashFlow = [];
    for (let index = 0; index < sortedAccountingMonths.length; index++) {
      const m = sortedAccountingMonths[index];
      const data = accountingByMonth[m];
      const previousBalance = index > 0 ? (cashFlow[index - 1]?.balance || 0) : 0;
      const balance = previousBalance + data.profit;
      
      cashFlow.push({
        month: m,
        inflow: data.revenue,
        outflow: data.expenses,
        balance: Math.round(balance * 100) / 100,
      });
    }

    // Linear Regression Predictions
    const predictions = [];
    if (sortedAccountingMonths.length >= 3) {
      // Prepare data points for regression
      const dataPoints = sortedAccountingMonths.map((month, index) => ({
        x: index, // Time index
        y: accountingByMonth[month]?.revenue || 0
      }));

      // Calculate linear regression: y = mx + b
      const n = dataPoints.length;
      let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

      dataPoints.forEach(point => {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumX2 += point.x * point.x;
      });

      // Calculate slope (m) and intercept (b)
      const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;

      // Calculate R² (coefficient of determination) for confidence
      const meanY = sumY / n;
      let ssTotal = 0, ssResidual = 0;
      
      dataPoints.forEach(point => {
        const predicted = slope * point.x + intercept;
        ssTotal += Math.pow(point.y - meanY, 2);
        ssResidual += Math.pow(point.y - predicted, 2);
      });

      const rSquared = ssTotal !== 0 ? 1 - (ssResidual / ssTotal) : 0;
      const confidence = Math.max(0, Math.min(100, Math.round(rSquared * 100)));

      // Generate predictions for next 3 periods
      for (let i = 1; i <= 3; i++) {
        const nextIndex = n + i - 1;
        const predictedValue = Math.max(0, slope * nextIndex + intercept);

        // Calculate next period date
        const lastMonth = sortedAccountingMonths[sortedAccountingMonths.length - 1];
        const [year, month] = lastMonth.split('-');
        const nextDate = new Date(parseInt(year), parseInt(month) - 1 + i, 1);
        const period = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

        predictions.push({
          period,
          predicted: Math.round(predictedValue * 100) / 100,
          confidence: Math.round(confidence * Math.pow(0.95, i - 1)), // Slightly decrease confidence for future periods
          calculation: {
            formula: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(2)}`,
            slope: Math.round(slope * 100) / 100,
            intercept: Math.round(intercept * 100) / 100,
            rSquared: Math.round(rSquared * 1000) / 1000,
            dataPoints: n,
            method: 'Linear Regression',
            xValue: nextIndex,
            calculation: `${slope.toFixed(4)} × ${nextIndex} + ${intercept.toFixed(2)} = ${predictedValue.toFixed(2)}`
          }
        });
      }
    }

    // Insights
    const recentRevenues = sortedAccountingMonths.slice(-3).map(m => accountingByMonth[m]?.revenue || 0);
    const avgRevenue = recentRevenues.reduce((a, b) => a + b, 0) / recentRevenues.length;
    const latestRevenue = recentRevenues[recentRevenues.length - 1] || 0;
    
    const insights = {
      trend: latestRevenue > avgRevenue ? 'increasing' : latestRevenue < avgRevenue ? 'decreasing' : 'stable',
      recommendation: latestRevenue > avgRevenue 
        ? 'Revenue is trending upward. Consider expanding inventory for high-demand products.'
        : 'Revenue is stable or declining. Review pricing and marketing strategies.',
      anomalies: 0
    };

    // Category distribution
    const categoryIdToName = new Map(categories.map(c => [c.id, c.name]));
    const categoryTotals = {};
    for (const p of products) {
      const name = categoryIdToName.get(p.categoryId) || 'Uncategorized';
      categoryTotals[name] = (categoryTotals[name] || 0) + (p.quantity || 0);
    }
    const categoryData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

    // Top products by current quantity sold (approx via transactions and orders)
    const soldByProduct = {};
    
    // Process inventory transactions
    for (const tx of transactions) {
      if (!soldByProduct[tx.productId]) {
        soldByProduct[tx.productId] = { sales: 0, returns: 0 };
      }
      if (tx.type === 'out') {
        soldByProduct[tx.productId].sales += (tx.quantity || 0);
      }
    }

    // Process orders to supplement transaction data (important for Kaggle data)
    for (const order of orders) {
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
    const returnsByProduct = {};
    for (const tx of transactions) {
      if (tx.type === 'in' && tx.reason?.toLowerCase().includes('return')) {
        returnsByProduct[tx.productId] = (returnsByProduct[tx.productId] || 0) + (tx.quantity || 0);
      }
    }
    
    // Process refunded orders
    for (const order of orders) {
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
          name: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          category: categoryIdToName.get(product?.categoryId) || 'Uncategorized',
          supplier: product?.supplier || 'N/A',
          price: product?.price || 0,
          costPrice: product?.costPrice || 0,
          quantity: product?.quantity || 0,
          qrCode: product?.qrCode || null,
          sales: data.sales,
          change: 0
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
          name: product?.name || 'Unknown',
          sku: product?.sku || 'N/A',
          category: categoryIdToName.get(product?.categoryId) || 'Uncategorized',
          supplier: product?.supplier || 'N/A',
          price: product?.price || 0,
          costPrice: product?.costPrice || 0,
          quantity: product?.quantity || 0,
          qrCode: product?.qrCode || null,
          returns: returns,
          returnRate: sales > 0 ? ((returns / sales) * 100).toFixed(1) + '%' : '0%'
        };
      })
      .sort((a, b) => b.returns - a.returns)
      .slice(0, 10);

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
      insights
    };

    console.log(`[REPORTS] Sending response for user ${userId}`);
    return res.json(responseData);
  } catch (error) {
    console.error('[REPORTS] Error building reports data:', error);
    console.error('[REPORTS] Error stack:', error.stack);
    return res.status(500).json({ 
      message: 'Failed to fetch reports', 
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ===== REPORTS CHAT HANDLER (GPT INTEGRATION) =====
async function handleReportsChat(req, res, user) {
  try {
    const { message, reportsData, conversationHistory } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    console.log('[REPORTS CHAT] Processing message for user:', user.uid);

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      console.error('[REPORTS CHAT] Gemini API key not configured');
      return res.status(500).json({ 
        message: 'AI service not configured. Please add GEMINI_API_KEY to environment variables.' 
      });
    }

    // Fetch comprehensive enterprise data from ALL pages and features
    const { db } = await initializeFirebase();
    const userId = user.uid;

    console.log('[REPORTS CHAT] Fetching comprehensive business data from all pages...');

    // Get all products with full details (INVENTORY PAGE)
    const productsSnap = await db.collection('products')
      .where('userId', '==', userId)
      .get();
    const allProducts = productsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        sku: data.sku,
        description: data.description,
        category: data.category || data.categoryId,
        supplier: data.supplier,
        price: data.price,
        costPrice: data.costPrice,
        quantity: data.quantity,
        minStockLevel: data.minStockLevel,
        location: data.location,
        isActive: data.isActive,
        qrCode: data.qrCode,
        imageUrl: data.imageUrl
      };
    });

    // Get all categories (INVENTORY PAGE)
    const categoriesSnap = await db.collection('categories')
      .where('userId', '==', userId)
      .get();
    const allCategories = categoriesSnap.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      description: doc.data().description
    }));

    // Get all coupons (COUPON MANAGEMENT)
    const couponsSnap = await db.collection('coupons').get();
    const allCoupons = couponsSnap.docs.map(doc => ({
      id: doc.id,
      code: doc.data().code,
      discountType: doc.data().discountType,
      discountValue: doc.data().discountValue,
      minPurchase: doc.data().minPurchase,
      maxUses: doc.data().maxUses,
      currentUses: doc.data().currentUses,
      expiryDate: doc.data().expiryDate?.toDate?.()?.toISOString() || doc.data().expiryDate,
      isActive: doc.data().isActive
    }));

    // Get user settings/profile (SETTINGS PAGE)
    const userDoc = await db.collection('users').doc(userId).get();
    const userProfile = userDoc.exists ? {
      displayName: userDoc.data().displayName,
      email: userDoc.data().email,
      phoneNumber: userDoc.data().phoneNumber,
      companyName: userDoc.data().companyName,
      businessAddress: userDoc.data().businessAddress,
      shopSlug: userDoc.data().shopSlug,
      currency: userDoc.data().currency || 'USD',
      theme: userDoc.data().theme,
      notifications: userDoc.data().notifications
    } : null;

    // Get all transactions (INVENTORY PAGE - transaction history)
    const productIds = allProducts.map(p => p.id);
    let allTransactions = [];
    
    if (productIds.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const txSnap = await db.collection('inventoryTransactions')
          .where('productId', 'in', batch)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get();
        allTransactions = allTransactions.concat(txSnap.docs.map(doc => ({
          id: doc.id,
          productId: doc.data().productId,
          productName: allProducts.find(p => p.id === doc.data().productId)?.name || 'Unknown',
          type: doc.data().type,
          quantity: doc.data().quantity,
          reason: doc.data().reason,
          unitPrice: doc.data().unitPrice,
          notes: doc.data().notes,
          createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
        })));
      }
    }

    // Get all accounting entries (ACCOUNTING PAGE)
    const accountingSnap = await db.collection('accountingEntries')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    const allAccountingEntries = accountingSnap.docs.map(doc => ({
      id: doc.id,
      accountType: doc.data().accountType,
      accountName: doc.data().accountName,
      debitAmount: doc.data().debitAmount,
      creditAmount: doc.data().creditAmount,
      description: doc.data().description,
      reference: doc.data().reference,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    // Get all orders (ORDERS PAGE)
    const ordersSnap = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const allOrders = ordersSnap.docs
      .map(doc => {
        const data = doc.data();
        // Filter orders that have items from this seller
        const sellerItems = data.items?.filter(item => item.sellerId === userId) || [];
        if (sellerItems.length > 0) {
          return {
            id: doc.id,
            orderNumber: data.orderNumber,
            customerName: data.customerName,
            customerEmail: data.customerEmail,
            customerPhone: data.customerPhone,
            shippingAddress: data.shippingAddress,
            status: data.status,
            totalAmount: data.totalAmount,
            subtotal: data.subtotal,
            discount: data.discount,
            couponCode: data.couponCode,
            items: sellerItems,
            refundRequested: data.refundRequested || false,
            refundReason: data.refundReason,
            refundApproved: data.refundApproved,
            shipmentId: data.shipmentId,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
          };
        }
        return null;
      })
      .filter(order => order !== null);

    // Calculate supplier analysis
    const supplierAnalysis = {};
    allProducts.forEach(product => {
      const supplier = product.supplier || 'Unknown Supplier';
      if (!supplierAnalysis[supplier]) {
        supplierAnalysis[supplier] = {
          name: supplier,
          totalProducts: 0,
          totalValue: 0,
          totalQuantity: 0,
          salesCount: 0,
          salesRevenue: 0,
          returnCount: 0,
          returnValue: 0,
          products: []
        };
      }
      
      supplierAnalysis[supplier].totalProducts += 1;
      supplierAnalysis[supplier].totalQuantity += product.quantity || 0;
      supplierAnalysis[supplier].totalValue += (product.price || 0) * (product.quantity || 0);
      supplierAnalysis[supplier].products.push({
        name: product.name,
        sku: product.sku,
        quantity: product.quantity,
        price: product.price,
        costPrice: product.costPrice
      });
    });

    // Add transaction data to supplier analysis
    allTransactions.forEach(tx => {
      const product = allProducts.find(p => p.id === tx.productId);
      if (product && product.supplier) {
        const supplier = product.supplier;
        if (supplierAnalysis[supplier]) {
          if (tx.type === 'out') {
            supplierAnalysis[supplier].salesCount += tx.quantity || 0;
            supplierAnalysis[supplier].salesRevenue += (tx.unitPrice || product.price || 0) * (tx.quantity || 0);
          } else if (tx.type === 'in' && tx.reason?.toLowerCase().includes('return')) {
            supplierAnalysis[supplier].returnCount += tx.quantity || 0;
            supplierAnalysis[supplier].returnValue += (tx.unitPrice || product.price || 0) * (tx.quantity || 0);
          }
        }
      }
    });

    // Calculate return rates for suppliers
    const supplierStats = Object.values(supplierAnalysis).map(supplier => ({
      ...supplier,
      returnRate: supplier.salesCount > 0 
        ? `${((supplier.returnCount / supplier.salesCount) * 100).toFixed(1)}%` 
        : '0%',
      profitMargin: supplier.products.length > 0
        ? `${(supplier.products.reduce((sum, p) => {
            const margin = p.price && p.costPrice ? ((p.price - p.costPrice) / p.price) * 100 : 0;
            return sum + margin;
          }, 0) / supplier.products.length).toFixed(1)}%`
        : '0%'
    })).sort((a, b) => b.returnCount - a.returnCount);

    // Calculate low stock products
    const lowStockProducts = allProducts.filter(p => {
      const qty = p.quantity || 0;
      const minStock = p.minStockLevel || 0;
      return minStock > 0 && qty <= minStock;
    }).map(p => ({
      name: p.name,
      sku: p.sku,
      quantity: p.quantity,
      minStockLevel: p.minStockLevel,
      supplier: p.supplier,
      price: p.price
    }));

    // Calculate profit margins
    const productProfitability = allProducts
      .filter(p => p.price && p.costPrice)
      .map(p => ({
        name: p.name,
        sku: p.sku,
        price: p.price,
        costPrice: p.costPrice,
        profitPerUnit: p.price - p.costPrice,
        profitMargin: `${(((p.price - p.costPrice) / p.price) * 100).toFixed(1)}%`,
        quantity: p.quantity,
        totalPotentialProfit: (p.price - p.costPrice) * p.quantity
      }))
      .sort((a, b) => b.totalPotentialProfit - a.totalPotentialProfit);

    // Calculate product sales mapping for easy lookup (MUST BE BEFORE USING IT)
    const productSalesMap = {};
    allTransactions.forEach(tx => {
      if (tx.type === 'out') {
        productSalesMap[tx.productId] = (productSalesMap[tx.productId] || 0) + (tx.quantity || 0);
      }
    });

    // Identify products that have NEVER been sold
    const unsoldProducts = allProducts
      .filter(p => !productSalesMap[p.id] || productSalesMap[p.id] === 0)
      .map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        supplier: p.supplier,
        price: p.price,
        costPrice: p.costPrice,
        quantity: p.quantity,
        location: p.location,
        totalValue: (p.price || 0) * (p.quantity || 0)
      }))
      .sort((a, b) => b.totalValue - a.totalValue);

    console.log('[REPORTS CHAT] Comprehensive data loaded:', {
      products: allProducts.length,
      productsWithSales: Object.keys(productSalesMap).length,
      unsoldProducts: unsoldProducts.length,
      transactions: allTransactions.length,
      accounting: allAccountingEntries.length,
      orders: allOrders.length,
      suppliers: Object.keys(supplierAnalysis).length,
      coupons: allCoupons.length,
      categories: allCategories.length
    });

    console.log('[REPORTS CHAT] Sample products:', allProducts.slice(0, 3).map(p => ({name: p.name, sku: p.sku, sales: productSalesMap[p.id] || 0})));

    // Calculate dashboard statistics
    const totalProducts = allProducts.length;
    const activeProducts = allProducts.filter(p => p.isActive).length;
    const totalInventoryValue = allProducts.reduce((sum, p) => sum + ((p.price || 0) * (p.quantity || 0)), 0);
    const lowStockCount = lowStockProducts.length;

    // Calculate order statistics
    const totalOrders = allOrders.length;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
    const processingOrders = allOrders.filter(o => o.status === 'processing').length;
    const completedOrders = allOrders.filter(o => o.status === 'completed').length;
    const refundedOrders = allOrders.filter(o => o.refundApproved).length;
    const refundRequestedOrders = allOrders.filter(o => o.refundRequested && !o.refundApproved).length;

    // Calculate financial metrics
    const totalRevenue = allAccountingEntries
      .filter(e => e.accountType === 'revenue')
      .reduce((sum, e) => sum + parseFloat(e.creditAmount || 0), 0);
    const totalExpenses = allAccountingEntries
      .filter(e => e.accountType === 'expense')
      .reduce((sum, e) => sum + parseFloat(e.debitAmount || 0), 0);

    // Prepare comprehensive context covering ALL pages and features
    const context = `You are a business intelligence AI assistant for this enterprise.

=== ⚠️ PRODUCTS WITH ZERO SALES (NEVER SOLD) ===
${unsoldProducts.length > 0 ? `You have ${unsoldProducts.length} products that have NEVER been sold:

${unsoldProducts.map((p, idx) => `${idx + 1}. ${p.name} (SKU: ${p.sku})
   - Price: $${p.price || 0}
   - Cost: $${p.costPrice || 0}
   - Stock: ${p.quantity} units
   - Category: ${p.category}
   - Supplier: ${p.supplier || 'Not specified'}
   - Location: ${p.location || 'Not specified'}
   - Inventory Value: $${p.totalValue.toFixed(2)}
   - STATUS: ZERO SALES - Never been sold`).join('\n\n')}` : 'All products have been sold at least once.'}

=== DASHBOARD OVERVIEW ===
Total Products: ${totalProducts} (${activeProducts} active)
Products with Sales: ${Object.keys(productSalesMap).length}
Products NEVER Sold: ${unsoldProducts.length}
Total Inventory Value: $${totalInventoryValue.toFixed(2)}
Low Stock Items: ${lowStockCount}
Total Orders: ${totalOrders}
Total Revenue: $${totalRevenue.toFixed(2)}
Total Expenses: $${totalExpenses.toFixed(2)}
Net Profit: $${(totalRevenue - totalExpenses).toFixed(2)}

=== PRODUCTS WITH SALES ===
**${Object.keys(productSalesMap).length} products HAVE BEEN SOLD**

${Object.entries(productSalesMap).slice(0, 20).map(([productId, sales]) => {
  const p = allProducts.find(prod => prod.id === productId);
  return p ? `- ${p.name} (${p.sku}): ${sales} units sold, Current stock: ${p.quantity}` : '';
}).filter(Boolean).join('\n')}
${Object.keys(productSalesMap).length > 20 ? `\n...and ${Object.keys(productSalesMap).length - 20} more products with sales` : ''}

=== ORDERS SUMMARY ===
Total Orders: ${totalOrders}
Pending: ${pendingOrders}
Processing: ${processingOrders}
Completed: ${completedOrders}
Refunded: ${refundedOrders}
Refund Requests Pending: ${refundRequestedOrders}

Recent Orders (showing ${Math.min(allOrders.length, 30)} of ${totalOrders}):
${allOrders.slice(0, 30).map((o, idx) => `
${idx + 1}. Order ${o.orderNumber}
   Customer: ${o.customerName} (${o.customerEmail}, ${o.customerPhone})
   Status: ${o.status}
   Total: $${o.totalAmount} (Subtotal: $${o.subtotal || o.totalAmount}, Discount: $${o.discount || 0})
   Items: ${o.items.map(item => `${item.productName} x${item.quantity}`).join(', ')}
   Shipping: ${o.shippingAddress || 'Not provided'}
   ${o.shipmentId ? 'Tracking: ' + o.shipmentId : 'No tracking yet'}
   ${o.refundRequested ? 'REFUND REQUESTED: ' + o.refundReason : ''}
   ${o.refundApproved ? 'REFUNDED' : ''}
   Created: ${o.createdAt}`).join('\n')}

=== COMPLETE PRODUCT CATALOG (${totalProducts} products) ===
${allProducts.slice(0, 50).map((p, idx) => `
${idx + 1}. ${p.name} (SKU: ${p.sku})
   Price: $${p.price}, Cost: $${p.costPrice || 0}, Stock: ${p.quantity}
   Category: ${p.category}, Supplier: ${p.supplier || 'N/A'}
   Sales: ${productSalesMap[p.id] || 0} units sold ${!productSalesMap[p.id] || productSalesMap[p.id] === 0 ? '(NEVER SOLD)' : ''}
   Status: ${p.isActive ? 'Active' : 'Inactive'}
   ${p.qrCode ? 'QR: ' + p.qrCode : 'No QR code'}`).join('\n')}
${allProducts.length > 50 ? `\n...and ${allProducts.length - 50} more products (see UNSOLD PRODUCTS and PRODUCTS WITH SALES sections for complete inventory analysis)` : ''}

=== INVENTORY HEALTH ===

Low Stock Products (${lowStockCount}):
${lowStockProducts.map(p => `- ${p.name}: ${p.quantity}/${p.minStockLevel} units (Supplier: ${p.supplier})`).join('\n')}

Top Profitable Products:
${productProfitability.slice(0, 10).map(p => `- ${p.name}: Margin ${p.profitMargin}, Potential profit $${p.totalPotentialProfit.toFixed(2)}`).join('\n')}

=== ACCOUNTING ===
Recent Entries (${allAccountingEntries.length} total):
${allAccountingEntries.slice(0, 15).map(e => `- ${e.accountName}: Debit $${e.debitAmount}, Credit $${e.creditAmount} - ${e.description}`).join('\n')}

Financial Summary:
- Revenue Entries: ${allAccountingEntries.filter(e => e.accountType === 'revenue').length}
- Expense Entries: ${allAccountingEntries.filter(e => e.accountType === 'expense').length}

=== SUPPLIERS ===
${supplierStats.slice(0, 10).map(s => `- ${s.name}: ${s.totalProducts} products, ${s.salesCount} sales, Return rate: ${s.returnRate}, Profit margin: ${s.profitMargin}`).join('\n')}

=== CATEGORIES ===
${allCategories.map(c => `- ${c.name}${c.description ? ': ' + c.description : ''}`).join('\n')}

=== COUPONS ===
Active Coupons (${allCoupons.filter(c => c.isActive).length}/${allCoupons.length}):
${allCoupons.filter(c => c.isActive).map(c => `- ${c.code}: ${c.discountType} ${c.discountValue}, Used ${c.currentUses || 0}/${c.maxUses || 'unlimited'} times`).join('\n')}

=== BUSINESS SETTINGS ===
${userProfile ? `Company: ${userProfile.companyName || 'Not set'}
Owner: ${userProfile.displayName}
Email: ${userProfile.email}
Currency: ${userProfile.currency || 'USD'}
Shop: ${userProfile.shopSlug || 'Not set'}
Address: ${userProfile.businessAddress || 'Not set'}` : 'Profile not configured'}

=== TRANSACTIONS ===
Recent Inventory Movements (${allTransactions.length} total):
${allTransactions.slice(0, 20).map(tx => `- ${tx.type.toUpperCase()}: ${tx.quantity} units, Reason: ${tx.reason}`).join('\n')}

${reportsData ? `\n=== ANALYTICS & PREDICTIONS ===\nRevenue Predictions: ${JSON.stringify(reportsData.predictions, null, 2)}\nCash Flow: ${JSON.stringify(reportsData.cashFlow, null, 2)}\nInsights: ${JSON.stringify(reportsData.insights, null, 2)}` : ''}

WHEN USER ASKS ABOUT UNSOLD/NEVER SOLD PRODUCTS:
- Refer to the "⚠️ PRODUCTS WITH ZERO SALES (NEVER SOLD)" section at the very top
- List the products by name, SKU, and details
- There are ${unsoldProducts.length} products with zero sales

Answer naturally and provide specific details from the data above.
`;

    // Build prompt for Gemini
    let fullPrompt = context + '\n\n';
    if (conversationHistory && conversationHistory.length > 0) {
      fullPrompt += conversationHistory.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n\n') + '\n\n';
    }
    fullPrompt += `User: ${message}`;

    console.log('[REPORTS CHAT] Calling Gemini API via REST...');
    console.log('[REPORTS CHAT] Context size:', fullPrompt.length, 'characters');

    // Call Gemini REST API directly with increased token limits
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
            maxOutputTokens: 2048, // Increased for detailed responses
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

  } catch (error) {
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
}

// ===== COUPON HANDLERS =====
async function handleGetCoupons(req, res) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const { sellerId } = req.query;
    if (!sellerId) {
      return res.status(400).json({ message: 'sellerId is required' });
    }

    const couponsSnapshot = await db.collection('coupons')
      .where('sellerId', '==', sellerId)
      .orderBy('createdAt', 'desc')
      .get();

    const coupons = couponsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
      expiresAt: doc.data().expiresAt?.toDate?.()?.toISOString() || doc.data().expiresAt
    }));

    return res.json(coupons);
  } catch (error) {
    console.error('Error fetching coupons:', error);
    return res.status(500).json({ message: 'Failed to fetch coupons' });
  }
}

async function handleCreateCoupon(req, res) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
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
      expiresAt: expiresAt ? adminModule.default.firestore.Timestamp.fromDate(new Date(expiresAt)) : null,
      isActive: isActive !== false,
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    };

    await couponRef.set(couponData);

    // Notify subscribers if requested
    if (notifySubscribers) {
      const subscriptionsSnapshot = await db.collection('subscriptions')
        .where('sellerId', '==', sellerId)
        .get();

      const batch = db.batch();
      subscriptionsSnapshot.docs.forEach(subDoc => {
        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          id: notifRef.id,
          userId: subDoc.data().customerId,
          type: 'coupon',
          title: 'New Coupon Available!',
          message: `Use code ${code} to get ${discountType === 'percentage' ? discountValue + '%' : '$' + discountValue} off!`,
          data: JSON.stringify({ couponCode: code, couponId: couponRef.id }),
          isRead: false,
          createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
    }

    const createdDoc = await couponRef.get();
    const responseData = {
      id: couponRef.id,
      ...createdDoc.data(),
      createdAt: createdDoc.data().createdAt?.toDate?.()?.toISOString() || createdDoc.data().createdAt,
      expiresAt: createdDoc.data().expiresAt?.toDate?.()?.toISOString() || createdDoc.data().expiresAt
    };

    return res.status(201).json(responseData);
  } catch (error) {
    console.error('Error creating coupon:', error);
    return res.status(500).json({ message: 'Failed to create coupon' });
  }
}

async function handleDeleteCoupon(req, res, couponId) {
  const { db } = await initializeFirebase();
  
  try {
    await db.collection('coupons').doc(couponId).delete();
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting coupon:', error);
    return res.status(500).json({ message: 'Failed to delete coupon' });
  }
}

async function handleToggleCoupon(req, res, couponId) {
  const { db } = await initializeFirebase();
  
  try {
    const { isActive } = req.body;
    await db.collection('coupons').doc(couponId).update({ isActive });
    
    const updatedDoc = await db.collection('coupons').doc(couponId).get();
    const responseData = {
      id: couponId,
      ...updatedDoc.data(),
      createdAt: updatedDoc.data().createdAt?.toDate?.()?.toISOString() || updatedDoc.data().createdAt,
      expiresAt: updatedDoc.data().expiresAt?.toDate?.()?.toISOString() || updatedDoc.data().expiresAt
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error('Error toggling coupon:', error);
    return res.status(500).json({ message: 'Failed to update coupon' });
  }
}

async function handleValidateCoupon(req, res) {
  const { db } = await initializeFirebase();
  
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
    const coupon = { id: couponDoc.id, ...couponDoc.data() };

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
      const hasApplicableProduct = productIds.some(id => applicableProductIds.includes(id));
      
      if (!hasApplicableProduct) {
        return res.status(400).json({ message: 'This coupon is not applicable to items in your cart' });
      }
    }

    const responseData = {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minPurchase: coupon.minPurchase,
      applicableProducts: coupon.applicableProducts,
      expiresAt: coupon.expiresAt?.toDate?.()?.toISOString() || coupon.expiresAt
    };

    return res.json(responseData);
  } catch (error) {
    console.error('Error validating coupon:', error);
    return res.status(500).json({ message: 'Failed to validate coupon' });
  }
}

// ===== SUBSCRIPTION HANDLERS =====
async function handleSubscribe(req, res) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
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
      createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    return res.status(201).json({ message: 'Subscribed successfully', id: subRef.id });
  } catch (error) {
    console.error('Error subscribing:', error);
    return res.status(500).json({ message: 'Failed to subscribe' });
  }
}

async function handleUnsubscribe(req, res) {
  const { db } = await initializeFirebase();
  
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
    return res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    return res.status(500).json({ message: 'Failed to unsubscribe' });
  }
}

async function handleCheckSubscription(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { customerId, sellerId } = req.query;

    const subscriptionSnapshot = await db.collection('subscriptions')
      .where('customerId', '==', customerId)
      .where('sellerId', '==', sellerId)
      .limit(1)
      .get();

    return res.json({ isSubscribed: !subscriptionSnapshot.empty });
  } catch (error) {
    console.error('Error checking subscription:', error);
    return res.status(500).json({ message: 'Failed to check subscription' });
  }
}

async function handleGetSubscriberCount(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { sellerId } = req.query;
    
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('sellerId', '==', sellerId)
      .get();

    return res.json({ count: subscriptionsSnapshot.size });
  } catch (error) {
    console.error('Error getting subscriber count:', error);
    return res.status(500).json({ message: 'Failed to get subscriber count' });
  }
}

async function handleGetSubscriberList(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { sellerId } = req.query;
    
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('sellerId', '==', sellerId)
      .get();

    const subscribers = await Promise.all(
      subscriptionsSnapshot.docs.map(async (doc) => {
        const subData = doc.data();
        // Fetch customer details
        try {
          const userDoc = await db.collection('users').doc(subData.customerId).get();
          const userData = userDoc.exists ? userDoc.data() : null;
          
          return {
            id: doc.id,
            customerId: subData.customerId,
            customerName: userData?.displayName || userData?.email || 'Unknown User',
            customerEmail: userData?.email || '',
            subscribedAt: subData.createdAt?.toDate?.()?.toISOString() || subData.createdAt
          };
        } catch (err) {
          console.error('Error fetching user data:', err);
          return {
            id: doc.id,
            customerId: subData.customerId,
            customerName: 'Unknown User',
            customerEmail: '',
            subscribedAt: subData.createdAt?.toDate?.()?.toISOString() || subData.createdAt
          };
        }
      })
    );

    return res.json(subscribers);
  } catch (error) {
    console.error('Error getting subscribers list:', error);
    return res.status(500).json({ message: 'Failed to get subscribers list' });
  }
}

// ===== NOTIFICATION HANDLERS =====
async function handleGetNotifications(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const notificationsSnapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const notifications = notificationsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));

    return res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ message: 'Failed to fetch notifications' });
  }
}

async function handleMarkNotificationsRead(req, res) {
  const { db } = await initializeFirebase();
  
  try {
    const { userId, notificationIds } = req.body;

    const batch = db.batch();
    notificationIds.forEach(notificationId => {
      const notifRef = db.collection('notifications').doc(notificationId);
      batch.update(notifRef, { isRead: true });
    });

    await batch.commit();
    return res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return res.status(500).json({ message: 'Failed to mark notifications as read' });
  }
}

async function handleDeleteNotification(req, res, notificationId) {
  const { db } = await initializeFirebase();
  
  try {
    await db.collection('notifications').doc(notificationId).delete();
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ message: 'Failed to delete notification' });
  }
}

async function handleBroadcastMessage(req, res) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const { sellerId, title, message } = req.body;

    if (!sellerId || !title || !message) {
      return res.status(400).json({ message: 'sellerId, title, and message are required' });
    }

    // Get all subscribers
    const subscriptionsSnapshot = await db.collection('subscriptions')
      .where('sellerId', '==', sellerId)
      .get();

    if (subscriptionsSnapshot.empty) {
      return res.status(400).json({ message: 'No subscribers found' });
    }

    // Create notifications for all subscribers
    const batch = db.batch();
    subscriptionsSnapshot.docs.forEach(subDoc => {
      const notifRef = db.collection('notifications').doc();
      batch.set(notifRef, {
        id: notifRef.id,
        userId: subDoc.data().customerId,
        type: 'broadcast',
        title,
        message,
        data: JSON.stringify({ sellerId }),
        isRead: false,
        createdAt: adminModule.default.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();

    return res.json({ 
      message: `Message sent to ${subscriptionsSnapshot.size} subscriber${subscriptionsSnapshot.size !== 1 ? 's' : ''}`,
      count: subscriptionsSnapshot.size 
    });
  } catch (error) {
    console.error('Error broadcasting message:', error);
    return res.status(500).json({ message: 'Failed to send message' });
  }
}

// ===== HEALTH CHECK HANDLER =====
async function handleHealthCheck(req, res) {
  const startTime = Date.now();
  const checks = {
    timestamp: new Date().toISOString(),
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
      hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
      hasFirebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT,
    },
    firebase: {
      initialized: false,
      error: null
    },
    database: {
      connected: false,
      error: null
    }
  };

  try {
    // Try to initialize Firebase
    console.log('[Health Check] Attempting Firebase initialization...');
    const { db, auth } = await initializeFirebase();
    checks.firebase.initialized = true;
    console.log('[Health Check] Firebase initialized successfully');

    // Try a simple database operation
    console.log('[Health Check] Testing database connection...');
    const testQuery = await db.collection('users').limit(1).get();
    checks.database.connected = true;
    checks.database.documentCount = testQuery.size;
    console.log('[Health Check] Database connection successful');

    checks.success = true;
    checks.responseTime = `${Date.now() - startTime}ms`;

    return res.status(200).json(checks);
  } catch (error) {
    console.error('[Health Check] Error:', error);
    
    if (!checks.firebase.initialized) {
      checks.firebase.error = error.message;
    } else if (!checks.database.connected) {
      checks.database.error = error.message;
    }

    checks.success = false;
    checks.responseTime = `${Date.now() - startTime}ms`;
    checks.errorDetails = {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    return res.status(500).json(checks);
  }
}

// ===== PAYMENT HANDLERS =====
async function handleCreatePaymentIntent(req, res) {
  try {
    const { amount, currency = 'usd' } = req.body;

    console.log('[PAYMENT] Creating payment intent - amount:', amount, 'currency:', currency);

    // Validate amount
    if (!amount || amount <= 0) {
      console.error('[PAYMENT] Invalid amount:', amount);
      return res.status(400).json({ message: 'Invalid amount' });
    }

    // Check for Stripe secret key
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      console.warn('[PAYMENT] Stripe not configured - returning mock payment intent');
      // Return a mock payment intent for development
      const mockSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`;
      const mockId = `pi_mock_${Date.now()}`;
      
      return res.json({
        clientSecret: mockSecret,
        paymentIntentId: mockId
      });
    }

    console.log('[PAYMENT] Initializing Stripe...');
    
    // Dynamically import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia'
    });

    console.log('[PAYMENT] Creating payment intent with Stripe API...');

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount), // Amount should already be in cents from frontend
      currency: currency.toLowerCase(),
      automatic_payment_methods: {
        enabled: true
      }
    });

    console.log('[PAYMENT] Payment intent created successfully:', paymentIntent.id);

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });

  } catch (error) {
    console.error('[PAYMENT] Error creating payment intent:', error);
    console.error('[PAYMENT] Error details:', {
      message: error.message,
      type: error.type,
      code: error.code
    });

    return res.status(500).json({ 
      message: 'Failed to create payment intent',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function handlePaymentWebhook(req, res) {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.warn('[PAYMENT WEBHOOK] Webhook secret not configured');
      return res.status(400).json({ message: 'Webhook secret not configured' });
    }

    console.log('[PAYMENT WEBHOOK] Received webhook event');

    // Dynamically import Stripe
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-11-20.acacia'
    });

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('[PAYMENT WEBHOOK] Webhook signature verification failed:', err.message);
      return res.status(400).json({ message: `Webhook Error: ${err.message}` });
    }

    console.log('[PAYMENT WEBHOOK] Event type:', event.type);

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('[PAYMENT WEBHOOK] Payment succeeded:', paymentIntent.id);
        // TODO: Update order status in database
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('[PAYMENT WEBHOOK] Payment failed:', failedPayment.id);
        // TODO: Handle failed payment
        break;

      default:
        console.log('[PAYMENT WEBHOOK] Unhandled event type:', event.type);
    }

    return res.json({ received: true });

  } catch (error) {
    console.error('[PAYMENT WEBHOOK] Error processing webhook:', error);
    return res.status(500).json({ 
      message: 'Webhook processing failed',
      error: error.message 
    });
  }
}

// ===== EASY PARCEL / SHIPPING HANDLERS =====

/**
 * Create shipment and generate waybill via Easy Parcel OR Local Demo Mode
 */
async function handleCreateShipment(req, res, user) {
  const { db } = await initializeFirebase();
  const adminModule = await import('firebase-admin');
  
  try {
    const { 
      orderId, 
      serviceId, // Optional - will auto-select if not provided
      weight,
      insuranceValue 
    } = req.body;

    console.log('[SHIPPING] Creating shipment for order:', orderId);

    if (!orderId) {
      return res.status(400).json({ 
        message: 'Order ID is required' 
      });
    }

    // Always use local demo mode
    console.log('[SHIPPING] Using LOCAL DEMO mode');
    return await handleCreateShipmentLocal(req, res, user, db);

    // Get order details
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderDoc.data();

    // Verify order belongs to seller
    const hasSellerItems = order.items?.some(item => item.sellerId === user.uid);
    if (!hasSellerItems) {
      return res.status(403).json({ 
        message: 'Unauthorized - Order does not belong to you' 
      });
    }

    // Get seller (pickup) information
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userProfile = userDoc.data();

    if (!userProfile || !userProfile.businessAddress) {
      return res.status(400).json({ 
        message: 'Please complete your business profile with address information in Settings' 
      });
    }

    // Parse addresses
    const pickupAddress = parseShippingAddress(userProfile.businessAddress);
    const dropAddress = parseShippingAddress(order.shippingAddress);

    // Calculate total weight from items (or use provided weight)
    const totalWeight = weight || calculateOrderWeight(order.items);

    // If no service ID provided, get the cheapest available service
    let selectedServiceId = serviceId;
    
    if (!selectedServiceId) {
      console.log('[SHIPPING] No service specified, fetching available services...');
      
      const ratesResponse = await fetch(
        'https://connect.easyparcel.com/api/v1/rate/check',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY}`
          },
          body: JSON.stringify({
            pick_postcode: pickupAddress.postcode,
            drop_postcode: dropAddress.postcode,
            weight: totalWeight,
            width: 10,
            height: 10,
            length: 10
          })
        }
      );

      if (ratesResponse.ok) {
        const rates = await ratesResponse.json();
        if (rates.rates && rates.rates.length > 0) {
          // Select the cheapest service
          const cheapestService = rates.rates.reduce((min, service) => 
            service.price < min.price ? service : min
          );
          selectedServiceId = cheapestService.service_id;
          console.log('[SHIPPING] Auto-selected cheapest service:', cheapestService.courier_name || cheapestService.service_name, 'at', cheapestService.price);
        }
      }
      
      if (!selectedServiceId) {
        return res.status(400).json({ 
          message: 'No shipping service available for this route. Please check the addresses.' 
        });
      }
    }

    // Prepare shipment data for Easy Parcel
    const shipmentData = {
      pick_code: user.uid,
      pick_contact_person: userProfile.displayName || userProfile.companyName || 'Seller',
      pick_company: userProfile.companyName || userProfile.displayName || 'My Shop',
      pick_mobile: userProfile.phoneNumber || '0123456789',
      pick_email: userProfile.email || user.email,
      pick_addr1: pickupAddress.addr1,
      pick_addr2: pickupAddress.addr2,
      pick_postcode: pickupAddress.postcode,
      pick_city: pickupAddress.city,
      pick_state: pickupAddress.state,
      pick_country: pickupAddress.country || 'Malaysia',
      
      drop_code: order.customerId || 'CUSTOMER',
      drop_contact_person: order.customerName,
      drop_mobile: order.customerPhone,
      drop_email: order.customerEmail,
      drop_addr1: dropAddress.addr1,
      drop_addr2: dropAddress.addr2,
      drop_postcode: dropAddress.postcode,
      drop_city: dropAddress.city,
      drop_state: dropAddress.state,
      drop_country: dropAddress.country || 'Malaysia',
      
      parcel_items: order.items
        .filter(item => item.sellerId === user.uid)
        .map(item => ({
          item_desc: item.productName,
          quantity: item.quantity,
          weight: totalWeight / order.items.length, // Distribute weight evenly
          value: item.totalPrice
        })),
      
      service_id: selectedServiceId,
      insurance_value: insuranceValue || 0,
      reference_no: order.orderNumber
    };

    // Create shipment via Easy Parcel API
    const easyParcelResponse = await fetch(
      'https://connect.easyparcel.com/api/v1/order/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY}`
        },
        body: JSON.stringify(shipmentData)
      }
    );

    if (!easyParcelResponse.ok) {
      const error = await easyParcelResponse.json();
      console.error('[SHIPPING] Easy Parcel API error:', error);
      throw new Error(error.message || 'Failed to create shipment with Easy Parcel');
    }

    const shipmentResult = await easyParcelResponse.json();

    console.log('[SHIPPING] Shipment created successfully:', shipmentResult);

    // Update order with shipping information
    await db.collection('orders').doc(orderId).update({
      shipmentId: shipmentResult.tracking_no || shipmentResult.awb_no,
      easyParcelOrderId: shipmentResult.order_id,
      waybillUrl: shipmentResult.waybill_url,
      courier: shipmentResult.courier || selectedServiceId,
      estimatedDelivery: shipmentResult.estimated_delivery,
      shippingCost: shipmentResult.total_charge,
      status: 'processing',
      updatedAt: adminModule.default.firestore.FieldValue.serverTimestamp()
    });

    return res.json({
      success: true,
      trackingNo: shipmentResult.tracking_no || shipmentResult.awb_no,
      orderId: shipmentResult.order_id,
      waybillUrl: shipmentResult.waybill_url,
      courier: shipmentResult.courier || selectedServiceId,
      estimatedDelivery: shipmentResult.estimated_delivery,
      cost: shipmentResult.total_charge
    });

  } catch (error) {
    console.error('[SHIPPING] Error creating shipment:', error);
    return res.status(500).json({ 
      message: 'Failed to create shipment',
      error: error.message 
    });
  }
}

/**
 * Create shipment in LOCAL DEMO mode (no external API)
 */
async function handleCreateShipmentLocal(req, res, user, db) {
  try {
    const { orderId, weight, insuranceValue } = req.body;

    console.log('[SHIPPING LOCAL] Creating LOCAL shipment for order:', orderId);

    // Get order details
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderDoc.data();

    // Verify order has items for this seller
    const hasSellerItems = order.items?.some(item => item.sellerId === user.uid);
    if (!hasSellerItems) {
      return res.status(403).json({ message: 'Unauthorized - This order does not contain your products' });
    }

    // Simple internal tracking number
    const trackingNo = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

    // Basic shipping cost estimation (purely for demo)
    const totalItems = (order.items || []).reduce(
      (sum, item) => sum + (item.quantity || 0),
      0
    );
    const effectiveWeight = weight && Number(weight) > 0 ? Number(weight) : Math.max(totalItems * 0.5, 0.5);
    const baseRate = 5; // base currency units
    const perKg = 2;
    const cost = baseRate + perKg * effectiveWeight;

    const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    // Persist shipment details back to order
    await db.collection('orders').doc(orderId).update({
      shipmentId: trackingNo,
      courier: 'DemoCourier',
      waybillUrl: null,
      estimatedDelivery,
      shippingCost: cost,
      status: 'processing',
      updatedAt: new Date(),
      insuranceValue: insuranceValue ? Number(insuranceValue) : 0,
    });

    console.log('[SHIPPING LOCAL] Created local shipment:', trackingNo);

    return res.json({
      success: true,
      trackingNo,
      orderId,
      waybillUrl: null,
      courier: 'DemoCourier',
      estimatedDelivery,
      cost,
    });
  } catch (error) {
    console.error('[SHIPPING LOCAL] Error creating local shipment:', error);
    return res.status(500).json({
      message: 'Failed to create shipment',
      error: error?.message || String(error),
    });
  }
}

/**
 * Track shipment status
 */
async function handleTrackShipment(req, res, trackingNo) {
  const { db } = await initializeFirebase();
  
  try {
    console.log('[SHIPPING] Tracking shipment:', trackingNo);

    // Always use local tracking (no EasyParcel API calls)
    console.log('[SHIPPING] Using local tracking for:', trackingNo);
    
    // Find order with this shipmentId in Firestore
    const snapshot = await db
      .collection('orders')
      .where('shipmentId', '==', trackingNo)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ message: 'Shipment not found' });
    }

    const doc = snapshot.docs[0];
    const order = doc.data();

    const createdAt = order.createdAt?.toDate?.() || new Date();
    const estimatedDelivery =
      order.estimatedDelivery ||
      new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const events = [
      {
        timestamp: createdAt.toISOString(),
        status: 'Order received',
        location: 'Origin Warehouse',
        description: 'Seller has received the order and is preparing the shipment.',
      },
      {
        timestamp: new Date(createdAt.getTime() + 6 * 60 * 60 * 1000).toISOString(),
        status: 'In transit',
        location: 'On the way',
        description: 'Your package is on the way with DemoCourier.',
      },
      {
        timestamp: estimatedDelivery,
        status: 'Out for delivery',
        location: 'Destination City',
        description: 'Courier is delivering the package to the customer address.',
      },
    ];

    return res.json({
      status: order.status || 'processing',
      tracking_no: trackingNo,
      courier: order.courier || 'DemoCourier',
      events,
    });

  } catch (error) {
    console.error('[SHIPPING] Error tracking shipment:', error);
    return res.status(500).json({ 
      message: 'Failed to track shipment',
      error: error.message 
    });
  }
}

/**
 * Download waybill PDF or HTML
 */
async function handleDownloadWaybill(req, res, user, orderId) {
  const { db } = await initializeFirebase();
  
  try {
    console.log('[WAYBILL] Downloading waybill for order:', orderId);

    // Get order to verify ownership
    const orderDoc = await db.collection('orders').doc(orderId).get();
    
    if (!orderDoc.exists) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderDoc.data();

    // Verify order belongs to seller
    const hasSellerItems = order.items?.some(item => item.sellerId === user.uid);
    if (!hasSellerItems) {
      return res.status(403).json({ 
        message: 'Unauthorized - Order does not belong to you' 
      });
    }

    if (!order.shipmentId) {
      return res.status(400).json({ 
        message: 'No waybill available - shipment not created yet' 
      });
    }

    // Always use local HTML waybill
    console.log('[WAYBILL] Using local HTML waybill');
    return await generateLocalWaybillHTML(req, res, user, orderId, order, db);

  } catch (error) {
    console.error('[WAYBILL] Error downloading waybill:', error);
    return res.status(500).json({ 
      message: 'Failed to download waybill',
      error: error.message 
    });
  }
}

/**
 * Generate local HTML waybill (for demo mode when Easy Parcel is not configured)
 */
async function generateLocalWaybillHTML(req, res, user, orderId, order, db) {
  try {
    // Get seller info for "Ship From" section
    const sellerDoc = await db.collection('users').doc(user.uid).get();
    const seller = sellerDoc.data();
    
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

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Waybill - ${order.orderNumber || orderId}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      @page { size: A4 portrait; margin: 10mm; }
      @media print {
        html, body { width: 210mm; height: 297mm; }
        body { margin: 0; padding: 0; background: white !important; }
        .no-print { display: none !important; }
        .waybill-container { box-shadow: none !important; margin: 0 !important; padding: 0 !important; page-break-after: avoid; }
        .waybill { border-width: 2px !important; }
      }
      body { font-family: Arial, Helvetica, sans-serif; background: #f0f0f0; padding: 15px; color: #000; }
      .waybill-container { max-width: 210mm; margin: 0 auto; background: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .waybill { border: 4px solid #000; padding: 15px; background: white; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 4px solid #000; padding-bottom: 12px; margin-bottom: 15px; }
      .logo-section h1 { font-size: 32px; color: #000; font-weight: 900; margin-bottom: 4px; letter-spacing: -1px; text-transform: uppercase; }
      .logo-section .company { font-size: 16px; color: #333; font-weight: 600; margin-top: 4px; }
      .logo-section .subtitle { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
      .order-info { text-align: right; background: #000; color: white; padding: 12px 16px; border-radius: 4px; }
      .order-info .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.8; margin-bottom: 4px; }
      .order-info .value { font-size: 20px; font-weight: 900; letter-spacing: 0.5px; }
      .order-info .date-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.3); }
      .tracking-section { background: #000; color: white; padding: 18px 20px; margin: 18px 0; text-align: center; border: 3px solid #000; }
      .tracking-section .label { font-size: 12px; text-transform: uppercase; letter-spacing: 2px; font-weight: 700; margin-bottom: 10px; }
      .tracking-section .tracking-number { font-size: 28px; font-weight: 900; letter-spacing: 4px; font-family: Courier New, monospace; background: white; color: #000; padding: 12px 20px; border-radius: 4px; display: inline-block; margin: 8px 0; }
      .two-column { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 18px 0; }
      .section { border: 3px solid #000; padding: 12px; background: white; min-height: 140px; }
      .section-title { font-size: 13px; font-weight: 900; text-transform: uppercase; color: white; background: #000; letter-spacing: 1.5px; padding: 8px 12px; margin: -12px -12px 12px -12px; }
      .section-content { font-size: 13px; line-height: 1.6; }
      .section-content .name { font-weight: 900; font-size: 16px; margin-bottom: 6px; color: #000; text-transform: uppercase; }
      .section-content .detail { color: #333; margin: 4px 0; padding-left: 0; }
      .section-content .address { color: #000; margin-top: 8px; font-weight: 600; border-left: 4px solid #000; padding-left: 8px; line-height: 1.5; }
      .barcode-area { margin-top: 20px; padding: 25px 20px; border: 4px solid #000; text-align: center; background: white; }
      .barcode-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #000; margin-bottom: 15px; }
      .barcode { width: 100%; max-width: 400px; margin: 0 auto; }
      .barcode-lines { display: flex; justify-content: center; align-items: flex-end; height: 80px; background: white; margin: 10px 0; gap: 2px; }
      .barcode-line { background: #000; height: 100%; flex-shrink: 0; }
      .barcode-line.thin { width: 2px; }
      .barcode-line.medium { width: 3px; }
      .barcode-line.thick { width: 4px; }
      .barcode-line.short { height: 60%; }
      .barcode-number { font-family: Courier New, monospace; font-size: 16px; font-weight: 900; letter-spacing: 6px; color: #000; margin-top: 8px; text-align: center; }
      .tracking-ref { font-size: 12px; color: #666; margin-top: 10px; font-weight: 600; }
      .footer { margin-top: 18px; padding-top: 12px; border-top: 3px solid #000; text-align: center; font-size: 10px; color: #666; line-height: 1.6; }
      .footer .important { color: #000; font-weight: 700; margin-bottom: 6px; }
      .print-controls { position: fixed; top: 20px; right: 20px; z-index: 1000; display: flex; gap: 10px; }
      .print-button { background: #000; color: white; border: none; padding: 14px 28px; font-size: 15px; font-weight: 700; border-radius: 6px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s; text-transform: uppercase; letter-spacing: 1px; }
      .print-button:hover { background: #333; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
      .print-button:active { transform: translateY(0); }
      .print-button.secondary { background: white; color: #000; border: 2px solid #000; }
      .print-button.secondary:hover { background: #f5f5f5; }
    </style>
  </head>
  <body>
    <div class="print-controls no-print">
      <button class="print-button secondary" onclick="window.close()">✕ Close</button>
      <button class="print-button" onclick="window.print()">🖨️ Print / Save PDF</button>
    </div>
    <div class="waybill-container">
      <div class="waybill">
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
        <div class="tracking-section">
          <div class="label">● Tracking Number ●</div>
          <div class="tracking-number">${order.shipmentId || "PENDING-ASSIGNMENT"}</div>
        </div>
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
        <div class="barcode-area">
          <div class="barcode-label">Tracking Barcode</div>
          <div class="barcode">
            <div class="barcode-lines">
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
        <div class="footer">
          <div class="important">⚠️ IMPORTANT NOTICE</div>
          <p>This is a computer-generated waybill and serves as proof of shipment.</p>
          <p>For order tracking, please use the tracking number above on the courier's website.</p>
          <p style="margin-top: 8px; font-weight: 700;">Generated: ${new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' })}</p>
          <p style="margin-top: 4px; font-size: 9px;">Order ID: ${orderId}</p>
        </div>
      </div>
    </div>
  </body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (error) {
    console.error('[WAYBILL] Error generating local waybill:', error);
    return res.status(500).json({
      message: 'Failed to generate waybill',
      error: error?.message || String(error),
    });
  }
}

/**
 * Get available shipping services
 */
async function handleGetShippingServices(req, res) {
  try {
    const { pickupPostcode, dropPostcode, weight } = req.query;

    console.log('[SHIPPING] Getting available services:', { pickupPostcode, dropPostcode, weight });

    if (!process.env.EASYPARCEL_API_KEY) {
      return res.status(500).json({ 
        message: 'Shipping service not configured' 
      });
    }

    if (!pickupPostcode || !dropPostcode || !weight) {
      return res.status(400).json({ 
        message: 'Pickup postcode, drop postcode, and weight are required' 
      });
    }

    // Get rates from Easy Parcel API
    const ratesResponse = await fetch(
      'https://connect.easyparcel.com/api/v1/rate/check',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY}`
        },
        body: JSON.stringify({
          pick_postcode: pickupPostcode,
          drop_postcode: dropPostcode,
          weight: parseFloat(weight),
          width: 10,
          height: 10,
          length: 10
        })
      }
    );

    if (!ratesResponse.ok) {
      const error = await ratesResponse.json();
      console.error('[SHIPPING] Rates API error:', error);
      throw new Error(error.message || 'Failed to get shipping rates');
    }

    const rates = await ratesResponse.json();

    return res.json({
      services: rates.rates || [],
      success: true
    });

  } catch (error) {
    console.error('[SHIPPING] Error getting shipping services:', error);
    return res.status(500).json({ 
      message: 'Failed to get shipping services',
      error: error.message 
    });
  }
}

/**
 * Get bulk waybill for multiple orders
 */
async function handleBulkWaybill(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
    const { orderIds } = req.body;

    console.log('[SHIPPING] Getting bulk waybill for orders:', orderIds);

    if (!process.env.EASYPARCEL_API_KEY) {
      return res.status(500).json({ 
        message: 'Shipping service not configured' 
      });
    }

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ 
        message: 'Order IDs array is required' 
      });
    }

    // Get all orders and extract Easy Parcel order IDs
    const easyParcelOrderIds = [];
    
    for (const orderId of orderIds) {
      const orderDoc = await db.collection('orders').doc(orderId).get();
      
      if (orderDoc.exists) {
        const order = orderDoc.data();
        
        // Verify order belongs to seller
        const hasSellerItems = order.items?.some(item => item.sellerId === user.uid);
        if (hasSellerItems && order.easyParcelOrderId) {
          easyParcelOrderIds.push(order.easyParcelOrderId);
        }
      }
    }

    if (easyParcelOrderIds.length === 0) {
      return res.status(400).json({ 
        message: 'No valid orders with waybills found' 
      });
    }

    // Get bulk waybill from Easy Parcel API
    const bulkResponse = await fetch(
      'https://connect.easyparcel.com/api/v1/order/bulk-waybill',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EASYPARCEL_API_KEY}`
        },
        body: JSON.stringify({
          order_ids: easyParcelOrderIds
        })
      }
    );

    if (!bulkResponse.ok) {
      throw new Error('Failed to get bulk waybill from Easy Parcel');
    }

    // Stream the PDF to client
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="waybills-bulk.pdf"`);
    
    const buffer = await bulkResponse.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (error) {
    console.error('[SHIPPING] Error getting bulk waybill:', error);
    return res.status(500).json({ 
      message: 'Failed to get bulk waybill',
      error: error.message 
    });
  }
}

// ===== HELPER FUNCTIONS FOR SHIPPING =====

/**
 * Parse shipping address into Easy Parcel format
 */
function parseShippingAddress(fullAddress) {
  if (!fullAddress) {
    return {
      addr1: '',
      addr2: '',
      postcode: '',
      city: '',
      state: '',
      country: 'Malaysia'
    };
  }

  const lines = fullAddress.split(',').map(line => line.trim());
  
  // Extract postcode (5 digits for Malaysia)
  const postcodeMatch = fullAddress.match(/\b\d{5}\b/);
  const postcode = postcodeMatch ? postcodeMatch[0] : '';
  
  // Basic parsing - you may need to enhance this based on your address format
  return {
    addr1: lines[0] || '',
    addr2: lines.length > 3 ? lines.slice(1, -2).join(', ') : lines[1] || '',
    postcode: postcode,
    city: lines.length >= 2 ? lines[lines.length - 2].replace(/\d{5}/g, '').trim() : '',
    state: lines.length >= 1 ? lines[lines.length - 1] : '',
    country: 'Malaysia'
  };
}

/**
 * Calculate order weight
 */
function calculateOrderWeight(items) {
  // Default weight per item: 0.5kg
  // You can enhance this by storing weight in product data
  const defaultWeightPerItem = 0.5;
  
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return totalItems * defaultWeightPerItem;
}

// ===== EMAIL NOTIFICATION SERVICE =====

/**
 * Send email using configured SMTP
 */
async function sendEmail({ to, subject, html, text = '' }) {
  // Check if nodemailer is available (will be installed)
  const nodemailer = await import('nodemailer').catch(() => null);
  
  if (!nodemailer) {
    console.warn('[EMAIL] nodemailer not available - emails disabled');
    return false;
  }

  const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || '587');
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass) {
    console.warn('[EMAIL] Email credentials not configured - emails disabled');
    return false;
  }

  try {
    const transporter = nodemailer.default.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    await transporter.sendMail({
      from: `"Inventory Management System" <${emailUser}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('[EMAIL] Email sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending email:', error);
    return false;
  }
}

/**
 * Generate Low Stock Alert Email HTML
 */
function generateLowStockEmail(companyName, lowStockProducts) {
  const productRows = lowStockProducts
    .map(
      (product) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #dc2626; font-weight: bold;">${product.currentStock}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.lowStockThreshold}</td>
      </tr>
    `
    )
    .join('');

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">⚠️ Low Stock Alert</h1>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 0;">
              Hello,
            </p>
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              The following products in <strong>${companyName}</strong> have fallen below their low stock threshold and need restocking:
            </p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product Name</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Current Stock</th>
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Threshold</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
              Please review your inventory and place orders as needed.
            </p>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated notification from your Inventory Management System.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate daily report email HTML
 */
function generateDailyReportEmail(companyName, reportData) {
  const topProductRows = reportData.topProducts
    .map(
      (product) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${product.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${product.revenue.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  // Generate low stock products table if any
  const lowStockSection = reportData.lowStockProducts && reportData.lowStockProducts.length > 0 ? `
    <h3 style="color: #dc2626; font-size: 18px; margin-top: 30px;">⚠️ Low Stock Alert</h3>
    <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">The following products need restocking:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #fef2f2;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Product Name</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Current Stock</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${reportData.lowStockProducts.map(product => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca; text-align: center; color: #dc2626; font-weight: bold;">${product.currentStock}</td>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca; text-align: center;">${product.lowStockThreshold}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📊 Daily Business Report</h1>
            <p style="color: #dbeafe; margin: 10px 0 0 0; font-size: 14px;">${reportData.date}</p>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #374151; font-size: 20px; margin-top: 0;">Today's Summary</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Total Sales</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${reportData.totalSales}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Total Orders</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${reportData.totalOrders}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Revenue</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${reportData.totalRevenue.toFixed(2)}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Low Stock Items</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${reportData.lowStockCount}</p>
              </div>
            </div>
            ${lowStockSection}
            <h3 style="color: #374151; font-size: 18px; margin-top: 30px;">Top Selling Products</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Qty Sold</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${topProductRows}
              </tbody>
            </table>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated daily report from ${companyName}
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Generate weekly summary email HTML
 */
function generateWeeklySummaryEmail(companyName, summaryData) {
  const topProductRows = summaryData.topProducts
    .map(
      (product) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${product.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center;">${product.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">$${product.revenue.toFixed(2)}</td>
      </tr>
    `
    )
    .join('');

  // Generate low stock products table if any
  const lowStockSection = summaryData.lowStockProducts && summaryData.lowStockProducts.length > 0 ? `
    <h3 style="color: #dc2626; font-size: 18px; margin-top: 30px;">⚠️ Low Stock Alert</h3>
    <p style="color: #6b7280; font-size: 14px; margin: 10px 0;">The following products need restocking:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #fef2f2;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Product Name</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Current Stock</th>
          <th style="padding: 12px; text-align: center; border-bottom: 2px solid #fecaca; color: #991b1b; font-weight: 600;">Threshold</th>
        </tr>
      </thead>
      <tbody>
        ${summaryData.lowStockProducts.map(product => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca;">${product.name}</td>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca; text-align: center; color: #dc2626; font-weight: bold;">${product.currentStock}</td>
          <td style="padding: 12px; border-bottom: 1px solid #fecaca; text-align: center;">${product.lowStockThreshold}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f3f4f6;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
          <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); padding: 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px;">📈 Weekly Business Summary</h1>
            <p style="color: #ede9fe; margin: 10px 0 0 0; font-size: 14px;">${summaryData.weekRange}</p>
          </div>
          <div style="padding: 30px;">
            <h2 style="color: #374151; font-size: 20px; margin-top: 0;">Week in Review</h2>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0;">
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Total Sales</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${summaryData.totalSales}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Total Orders</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">${summaryData.totalOrders}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Total Revenue</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${summaryData.totalRevenue.toFixed(2)}</p>
              </div>
              <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">Avg Order Value</p>
                <p style="color: #111827; font-size: 24px; font-weight: bold; margin: 5px 0 0 0;">$${summaryData.averageOrderValue.toFixed(2)}</p>
              </div>
            </div>
            ${lowStockSection}
            <h3 style="color: #374151; font-size: 18px; margin-top: 30px;">Top Products This Week</h3>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <thead>
                <tr style="background-color: #f9fafb;">
                  <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Product</th>
                  <th style="padding: 12px; text-align: center; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Qty Sold</th>
                  <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb; color: #374151; font-weight: 600;">Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${topProductRows}
              </tbody>
            </table>
            <h3 style="color: #374151; font-size: 18px; margin-top: 30px;">Inventory Status</h3>
            <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-top: 15px;">
              <p style="color: #374151; margin: 5px 0;"><strong>Total Products:</strong> ${summaryData.inventoryStatus.totalProducts}</p>
              <p style="color: #f59e0b; margin: 5px 0;"><strong>Low Stock Items:</strong> ${summaryData.inventoryStatus.lowStockCount}</p>
              <p style="color: #ef4444; margin: 5px 0;"><strong>Out of Stock:</strong> ${summaryData.inventoryStatus.outOfStockCount}</p>
            </div>
          </div>
          <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
              This is an automated weekly summary from ${companyName}
            </p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Handle test email notification
 */
async function handleTestEmail(req, res, user) {
  try {
    const { type, email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    const settings = userDoc.data()?.settings || {};
    const companyName = settings.companyName || 'Your Company';

    let success = false;

    if (type === 'low-stock') {
      const html = generateLowStockEmail(companyName, [
        { name: 'Sample Product A', currentStock: 5, lowStockThreshold: 10 },
        { name: 'Sample Product B', currentStock: 2, lowStockThreshold: 15 },
      ]);
      
      success = await sendEmail({
        to: email,
        subject: `⚠️ Low Stock Alert - Test Email`,
        html,
      });
    } else if (type === 'daily-report') {
      // For now, just send a simple confirmation
      success = await sendEmail({
        to: email,
        subject: `📊 Daily Report - Test Email`,
        html: `<p>Daily report feature is configured. Full implementation requires cron job setup on your hosting platform.</p>`,
      });
    } else if (type === 'weekly-summary') {
      success = await sendEmail({
        to: email,
        subject: `📈 Weekly Summary - Test Email`,
        html: `<p>Weekly summary feature is configured. Full implementation requires cron job setup on your hosting platform.</p>`,
      });
    } else {
      return res.status(400).json({ 
        message: "Invalid email type. Use 'low-stock', 'daily-report', or 'weekly-summary'" 
      });
    }

    if (success) {
      return res.json({ message: 'Test email sent successfully', email, type });
    } else {
      return res.status(500).json({ 
        message: 'Failed to send test email. Check server logs and email configuration.' 
      });
    }
  } catch (error) {
    console.error('[EMAIL] Error sending test email:', error);
    return res.status(500).json({ message: 'Failed to send test email' });
  }
}

/**
 * Handle daily report cron job
 */
async function handleDailyReportCron(req, res) {
  try {
    // Verify cron secret if configured (only check if CRON_SECRET is set)
    // Vercel Cron automatically includes authorization, so we skip check if no CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      // Only enforce secret if one is configured
      if (req.headers['x-cron-secret'] !== cronSecret) {
        return res.status(401).json({ message: 'Unauthorized - Invalid cron secret' });
      }
    }
    // If no CRON_SECRET is set, allow all requests (Vercel Cron handles auth internally)

    console.log('[CRON] Running daily report...');
    
    const usersSnapshot = await db.collection('users').get();
    let emailsSent = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const user = userDoc.data();
        const settings = user.settings || {};
        
        if (!settings.emailDailyReports) continue;

        const notificationEmail = settings.notificationEmail || user.email;
        if (!notificationEmail) continue;

        // Get yesterday's date range
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        // Fetch user's orders from last 24 hours
        const ordersSnapshot = await db
          .collection('orders')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', yesterday.toISOString())
          .get();

        const orders = ordersSnapshot.docs.map((doc) => doc.data());
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalSales = orders.reduce((sum, order) => {
          return sum + (order.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);

        // Get low stock count and products (always included for enterprise users)
        const productsSnapshot = await db
          .collection('products')
          .where('userId', '==', user.uid)
          .get();
        
        const lowStockProducts = [];
        productsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const quantity = data.quantity || 0;
          const threshold = data.lowStockThreshold || settings.defaultLowStock || 10;
          if (quantity > 0 && quantity <= threshold) {
            lowStockProducts.push({
              name: data.name || 'Unnamed Product',
              currentStock: quantity,
              lowStockThreshold: threshold
            });
          }
        });

        const lowStockCount = lowStockProducts.length;

        // Calculate top products
        const productSales = {};
        orders.forEach((order) => {
          order.items?.forEach((item) => {
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

        const companyName = settings.companyName || 'Your Company';
        const html = generateDailyReportEmail(companyName, {
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
          lowStockProducts,
          topProducts,
        });

        await sendEmail({
          to: notificationEmail,
          subject: `📊 Daily Business Report - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          html,
        });
        
        emailsSent++;
      } catch (error) {
        console.error(`[CRON] Error sending daily report for user ${userDoc.id}:`, error);
      }
    }

    console.log(`[CRON] Daily report complete. Sent ${emailsSent} emails.`);
    return res.json({ message: 'Daily report complete', emailsSent });
  } catch (error) {
    console.error('[CRON] Error in daily report:', error);
    return res.status(500).json({ message: 'Cron job failed', error: error.message });
  }
}

/**
 * Handle weekly summary cron job
 */
async function handleWeeklySummaryCron(req, res) {
  try {
    // Verify cron secret if configured (only check if CRON_SECRET is set)
    // Vercel Cron automatically includes authorization, so we skip check if no CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      // Only enforce secret if one is configured
      if (req.headers['x-cron-secret'] !== cronSecret) {
        return res.status(401).json({ message: 'Unauthorized - Invalid cron secret' });
      }
    }
    // If no CRON_SECRET is set, allow all requests (Vercel Cron handles auth internally)

    console.log('[CRON] Running weekly summary...');
    
    const usersSnapshot = await db.collection('users').get();
    let emailsSent = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const user = userDoc.data();
        const settings = user.settings || {};
        
        if (!settings.emailWeeklySummary) continue;

        const notificationEmail = settings.notificationEmail || user.email;
        if (!notificationEmail) continue;

        // Get last week's date range
        const today = new Date();
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);

        // Fetch user's orders from last week
        const ordersSnapshot = await db
          .collection('orders')
          .where('userId', '==', user.uid)
          .where('createdAt', '>=', lastWeek.toISOString())
          .get();

        const orders = ordersSnapshot.docs.map((doc) => doc.data());
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const totalSales = orders.reduce((sum, order) => {
          return sum + (order.items?.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) || 0);
        }, 0);
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Get inventory status with low stock product details
        const productsSnapshot = await db
          .collection('products')
          .where('userId', '==', user.uid)
          .get();
        
        const totalProducts = productsSnapshot.size;
        
        const lowStockProducts = [];
        let outOfStockCount = 0;
        
        productsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const quantity = data.quantity || 0;
          const threshold = data.lowStockThreshold || settings.defaultLowStock || 10;
          
          if (quantity === 0) {
            outOfStockCount++;
          } else if (quantity > 0 && quantity <= threshold) {
            lowStockProducts.push({
              name: data.name || 'Unnamed Product',
              currentStock: quantity,
              lowStockThreshold: threshold
            });
          }
        });
        
        const lowStockCount = lowStockProducts.length;

        // Calculate top products
        const productSales = {};
        orders.forEach((order) => {
          order.items?.forEach((item) => {
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

        const companyName = settings.companyName || 'Your Company';
        const html = generateWeeklySummaryEmail(companyName, {
          weekRange: `${lastWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          totalSales,
          totalOrders,
          totalRevenue,
          averageOrderValue,
          topProducts,
          lowStockProducts,
          inventoryStatus: {
            totalProducts,
            lowStockCount,
            outOfStockCount,
          },
        });

        await sendEmail({
          to: notificationEmail,
          subject: `📈 Weekly Business Summary - ${lastWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          html,
        });
        
        emailsSent++;
      } catch (error) {
        console.error(`[CRON] Error sending weekly summary for user ${userDoc.id}:`, error);
      }
    }

    console.log(`[CRON] Weekly summary complete. Sent ${emailsSent} emails.`);
    return res.json({ message: 'Weekly summary complete', emailsSent });
  } catch (error) {
    console.error('[CRON] Error in weekly summary:', error);
    return res.status(500).json({ message: 'Cron job failed', error: error.message });
  }
}
