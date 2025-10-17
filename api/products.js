import { db, verifyAuth, admin } from '../firebaseAdmin';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // ✅ Verify user is authenticated
    const user = await verifyAuth(req);
    console.log('Authenticated user:', user.email);

    if (req.method === 'GET') {
      // Get products for this user
      const snapshot = await db
        .collection('products')
        .where('userId', '==', user.uid) // Filter by user
        .get();
      
      const products = [];
      snapshot.forEach(doc => {
        products.push({
          id: doc.id,
          ...doc.data()
        });
      });

      res.status(200).json(products);

    } else if (req.method === 'POST') {
      // Add product for this user
      const newProduct = req.body;
      const docRef = await db.collection('products').add({
        ...newProduct,
        userId: user.uid, // Associate with user
        userEmail: user.email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      res.status(201).json({
        id: docRef.id,
        ...newProduct
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Error:', error);
    
    if (error.message === 'No token provided' || error.message === 'Invalid token') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    res.status(500).json({ error: error.message });
  }
}