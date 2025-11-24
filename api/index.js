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

    const summary = {
      totalRevenue,
      totalCOGS,
      unitsSold,
      grossProfit: totalRevenue - totalCOGS
    };

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

    // Calculate metrics
    const unitsSold = transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => sum + (t.quantity || 0), 0);

    const productById = new Map(products.map(p => [p.id, p]));
    const totalRevenueNumber = transactions
      .filter(t => t.type === 'out')
      .reduce((sum, t) => {
        const product = productById.get(t.productId);
        const price = product ? parseFloat(product.price || 0) : 0;
        return sum + price * (t.quantity || 0);
      }, 0);

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

    // Simple predictions (without ML service in serverless)
    const predictions = sortedAccountingMonths.slice(-3).map((m, index) => {
      const [year, month] = m.split('-');
      const nextDate = new Date(parseInt(year), parseInt(month) + index, 1);
      const predicted = accountingByMonth[m]?.revenue || 0;
      
      return {
        period: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`,
        predicted: Math.round(predicted * 1.1 * 100) / 100, // Simple 10% growth prediction
        confidence: 0.75
      };
    });

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

    // Top products by current quantity sold (approx via transactions)
    const soldByProduct = {};
    for (const tx of transactions) {
      if (!soldByProduct[tx.productId]) {
        soldByProduct[tx.productId] = { sales: 0, returns: 0 };
      }
      if (tx.type === 'out') {
        soldByProduct[tx.productId].sales += (tx.quantity || 0);
      }
    }

    // Get refunds from transactions or orders (returns)
    const returnsByProduct = {};
    for (const tx of transactions) {
      if (tx.type === 'in' && tx.reason?.toLowerCase().includes('return')) {
        returnsByProduct[tx.productId] = (returnsByProduct[tx.productId] || 0) + (tx.quantity || 0);
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
      fullPrompt += conversationHistory.map(msg => 
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
