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
  const { db, admin } = await initializeFirebase();
  
  try {
    const productData = req.body;
    const ref = db.collection('products').doc();
    const newProduct = {
      ...productData,
      id: ref.id,
      userId: user.uid,
      userEmail: user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: productData.isActive ?? true,
      quantity: productData.quantity ?? 0
    };
    
    await ref.set(newProduct);
    return res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    return res.status(400).json({ message: 'Failed to create product' });
  }
}

async function handleUpdateProduct(req, res, user, productId) {
  const { db, admin } = await initializeFirebase();
  
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const updated = { id: productId, ...doc.data(), ...req.body };
    return res.json(updated);
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
  const { db, admin } = await initializeFirebase();
  
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
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
    // Get products for this user
    const productsSnap = await db.collection('products')
      .where('userId', '==', user.uid)
      .get();
    
    const products = productsSnap.docs.map(doc => doc.data());
    const totalProducts = products.length;
    
    const lowStockItems = products.filter(p => 
      (p.quantity || 0) <= (p.minStockLevel || 0)
    ).length;
    
    const totalValue = products.reduce((sum, p) => 
      sum + parseFloat(p.price || 0) * (p.quantity || 0), 0
    );
    
    // Get recent transactions for this user's products
    const productIds = products.map(p => p.id);
    let recentActivity = [];
    
    if (productIds.length > 0) {
      // Firestore 'in' query limited to 10 items
      const batchSize = 10;
      for (let i = 0; i < productIds.length; i += batchSize) {
        const batch = productIds.slice(i, i + batchSize);
        const txSnap = await db.collection('inventoryTransactions')
          .where('productId', 'in', batch)
          .orderBy('createdAt', 'desc')
          .limit(5)
          .get();
        
        recentActivity.push(...txSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })));
      }
      
      // Sort and limit to 5 most recent
      recentActivity = recentActivity
        .sort((a, b) => {
          const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt);
          const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt);
          return bDate - aDate;
        })
        .slice(0, 5);
    }
    
    return res.json({
      totalProducts,
      lowStockItems,
      totalValue: totalValue.toFixed(2),
      ordersToday: 0,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error.message });
  }
}

async function handleGetCategories(req, res, user) {
  const { db } = await initializeFirebase();
  
  try {
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

async function handleCreateCategory(req, res, user) {
  const { db, admin } = await initializeFirebase();
  
  try {
    const categoryData = req.body;
    const ref = db.collection('categories').doc();
    const newCategory = {
      ...categoryData,
      id: ref.id,
      userId: user.uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
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
  const { db, admin } = await initializeFirebase();
  
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    const updated = await productRef.get();
    return res.json({ success: true, product: { id: doc.id, ...updated.data() } });
  } catch (error) {
    console.error('Error confirming sale via QR:', error);
    return res.status(500).json({ message: 'Failed to confirm sale' });
  }
}