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
  
  // Check if environment variable exists and is not empty
  const firebaseEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!firebaseEnv || firebaseEnv === 'undefined' || firebaseEnv.trim() === '') {
    console.error('FIREBASE_SERVICE_ACCOUNT is not set or empty');
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not configured. Please add it in Vercel project settings.');
  }
  
  try {
    serviceAccount = JSON.parse(firebaseEnv);
    
    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Firebase service account is missing required fields');
    }
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    throw new Error(`Invalid Firebase credentials: ${e.message}`);
  }

  admin.default.initializeApp({
    credential: admin.default.credential.cert(serviceAccount)
  });

  db = admin.default.firestore();
  auth = admin.default.auth();
  
  return { db, auth };
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

    // Route not found
    return res.status(404).json({ message: 'Route not found', path: pathParts.join('/') });

  } catch (error) {
    console.error('Handler error:', error);
    
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    
    return res.status(500).json({ 
      message: error.message || 'Internal server error',
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
        createdAt: new Date().toISOString()
      });
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
    
    // Get ALL products (no user filter for public view)
    const snapshot = await db.collection('products')
      .where('isActive', '==', true)
      .orderBy('createdAt', 'desc')
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

    // Top products
    const soldByProduct = {};
    for (const tx of transactions) {
      if (tx.type === 'out') {
        soldByProduct[tx.productId] = (soldByProduct[tx.productId] || 0) + (tx.quantity || 0);
      }
    }
    const topProducts = Object.entries(soldByProduct)
      .map(([productId, sales]) => ({
        name: productById.get(productId)?.name || 'Unknown',
        sales,
        change: 0
      }))
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    const responseData = {
      keyMetrics,
      salesData,
      inventoryTrends,
      categoryData,
      topProducts,
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