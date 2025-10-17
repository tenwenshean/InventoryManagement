import express from 'express';
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
let serviceAccount;
try {
  // Try reading from file (local dev)
  serviceAccount = JSON.parse(fs.readFileSync('firebase-key.json', 'utf8'));
} catch (e) {
  // Fallback to environment variable (Vercel production)
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const auth = admin.auth();

const app = express();
app.use(express.json());

// Middleware for authentication
async function isAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized - Missing token' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
}

// ===== ROUTES =====

// Auth routes
app.post('/auth/login', async (req, res) => {
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
    res.json({ message: 'Login successful', user: userData });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

app.get('/auth/user', isAuthenticated, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const user = userDoc.exists ? userDoc.data() : { uid: req.user.uid, email: req.user.email };
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

// Products routes
app.get('/products', isAuthenticated, async (req, res) => {
  try {
    const search = req.query.search;
    let query = db.collection('products').where('userId', '==', req.user.uid);
    
    const snapshot = await query.get();
    let products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (search) {
      const s = search.toLowerCase();
      products = products.filter(p => 
        (p.name || '').toLowerCase().includes(s) || 
        (p.sku || '').toLowerCase().includes(s)
      );
    }
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
});

app.get('/products/:id', isAuthenticated, async (req, res) => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    
    const product = { id: doc.id, ...doc.data() };
    if (product.userId !== req.user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});

app.post('/products', isAuthenticated, async (req, res) => {
  try {
    const productData = req.body;
    const ref = db.collection('products').doc();
    const newProduct = {
      ...productData,
      id: ref.id,
      userId: req.user.uid,
      userEmail: req.user.email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isActive: productData.isActive ?? true,
      quantity: productData.quantity ?? 0
    };
    
    await ref.set(newProduct);
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(400).json({ message: 'Failed to create product' });
  }
});

app.put('/products/:id', isAuthenticated, async (req, res) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const doc = await productRef.get();
    
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await productRef.update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ id: req.params.id, ...doc.data(), ...req.body });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(400).json({ message: 'Failed to update product' });
  }
});

app.delete('/products/:id', isAuthenticated, async (req, res) => {
  try {
    const productRef = db.collection('products').doc(req.params.id);
    const doc = await productRef.get();
    
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    await productRef.delete();
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to delete product' });
  }
});

app.post('/products/:id/qr', isAuthenticated, async (req, res) => {
  try {
    const productId = req.params.id;
    const productRef = db.collection('products').doc(productId);
    const doc = await productRef.get();
    
    if (!doc.exists) return res.status(404).json({ message: 'Product not found' });
    if (doc.data().userId !== req.user.uid) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const uniqueCode = `${productId}:${Date.now()}`;
    await productRef.update({ 
      qrCode: uniqueCode,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ productId, qrCode: uniqueCode });
  } catch (error) {
    console.error('Error generating QR:', error);
    res.status(500).json({ message: 'Failed to generate QR code' });
  }
});

// Dashboard stats
app.get('/dashboard/stats', isAuthenticated, async (req, res) => {
  try {
    const productsSnap = await db.collection('products')
      .where('userId', '==', req.user.uid)
      .get();
    
    const products = productsSnap.docs.map(doc => doc.data());
    const totalProducts = products.length;
    const lowStockItems = products.filter(p => 
      (p.quantity || 0) <= (p.minStockLevel || 0)
    ).length;
    
    const totalValue = products.reduce((sum, p) => 
      sum + parseFloat(p.price || 0) * (p.quantity || 0), 0
    );
    
    res.json({
      totalProducts,
      lowStockItems,
      totalValue: totalValue.toFixed(2),
      ordersToday: 0
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats' });
  }
});

// Export for Vercel serverless
export default app;