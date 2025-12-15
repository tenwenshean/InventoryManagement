// Clean up outlier data (January 2020 and beyond) that's affecting ML confidence
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "inventorymanagement-3005-b38a3.appspot.com"
});

const db = admin.firestore();
const USER_ID = 'EFCG0Cy1Z1egAfOFd7VpHvprr242';
const BATCH_SIZE = 400;

// Only keep Oct, Nov, Dec 2019 data
const VALID_MONTHS = ['2019-10', '2019-11', '2019-12'];

async function cleanupOutlierData() {
  console.log('=== CLEANUP OUTLIER DATA ===\n');
  console.log('Valid months to keep:', VALID_MONTHS.join(', '));
  console.log('');
  
  let totalDeleted = 0;
  
  // 1. Clean up accounting entries
  console.log('1. Cleaning accounting entries...');
  const accountingRef = db.collection('accountingEntries')
    .where('userId', '==', USER_ID);
  const accountingSnapshot = await accountingRef.get();
  
  const accountingToDelete = [];
  accountingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!VALID_MONTHS.includes(monthKey)) {
      accountingToDelete.push({ id: doc.id, month: monthKey });
    }
  });
  
  console.log(`   Found ${accountingToDelete.length} accounting entries to delete (outside valid months)`);
  
  // Delete in batches
  for (let i = 0; i < accountingToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = accountingToDelete.slice(i, i + BATCH_SIZE);
    
    for (const item of chunk) {
      batch.delete(db.collection('accountingEntries').doc(item.id));
    }
    
    await batch.commit();
    console.log(`   Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accountingToDelete.length / BATCH_SIZE)}`);
    
    if (i + BATCH_SIZE < accountingToDelete.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  totalDeleted += accountingToDelete.length;
  console.log(`   ✓ Deleted ${accountingToDelete.length} accounting entries\n`);
  
  // 2. Clean up orders
  console.log('2. Cleaning orders...');
  const ordersRef = db.collection('orders')
    .where('sellerId', '==', USER_ID);
  const ordersSnapshot = await ordersRef.get();
  
  const ordersToDelete = [];
  ordersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!VALID_MONTHS.includes(monthKey)) {
      ordersToDelete.push({ id: doc.id, month: monthKey });
    }
  });
  
  console.log(`   Found ${ordersToDelete.length} orders to delete (outside valid months)`);
  
  // Delete in batches
  for (let i = 0; i < ordersToDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = ordersToDelete.slice(i, i + BATCH_SIZE);
    
    for (const item of chunk) {
      batch.delete(db.collection('orders').doc(item.id));
    }
    
    await batch.commit();
    console.log(`   Deleted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ordersToDelete.length / BATCH_SIZE)}`);
    
    if (i + BATCH_SIZE < ordersToDelete.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  totalDeleted += ordersToDelete.length;
  console.log(`   ✓ Deleted ${ordersToDelete.length} orders\n`);
  
  // 3. Recalculate ML confidence
  console.log('3. Recalculating ML confidence...\n');
  
  // Get remaining accounting entries
  const cleanAccountingSnapshot = await db.collection('accountingEntries')
    .where('userId', '==', USER_ID)
    .get();
  
  const cleanOrdersSnapshot = await db.collection('orders')
    .where('sellerId', '==', USER_ID)
    .get();
  
  console.log(`   Remaining accounting entries: ${cleanAccountingSnapshot.size}`);
  console.log(`   Remaining orders: ${cleanOrdersSnapshot.size}`);
  
  // Calculate revenue by month
  const revenueByMonth = {};
  cleanOrdersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!revenueByMonth[monthKey]) {
      revenueByMonth[monthKey] = 0;
    }
    
    if (data.status === 'completed' || data.status === 'paid') {
      revenueByMonth[monthKey] += parseFloat(data.totalAmount || 0);
    }
  });
  
  const allMonths = Object.keys(revenueByMonth).sort();
  console.log('\n   Revenue by month:');
  allMonths.forEach(month => {
    console.log(`     ${month}: $${revenueByMonth[month].toFixed(2)}`);
  });
  
  // Calculate ML metrics
  const values = allMonths.map(m => revenueByMonth[m]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  const cv = stdDev / avg;
  const confidence = Math.max(0, Math.min(100, 100 - (cv * 100)));
  
  console.log(`\n   NEW ML Statistics:`);
  console.log(`     Data points: ${values.length}`);
  console.log(`     Average revenue: $${avg.toFixed(2)}`);
  console.log(`     Std Deviation: $${stdDev.toFixed(2)}`);
  console.log(`     Coefficient of Variation: ${cv.toFixed(4)}`);
  console.log(`     NEW BASE CONFIDENCE: ${confidence.toFixed(2)}%`);
  
  console.log(`\n=== CLEANUP COMPLETE ===`);
  console.log(`Total deleted: ${totalDeleted} documents`);
  console.log(`New confidence should be: ~${Math.round(confidence)}%`);
  
  process.exit(0);
}

cleanupOutlierData().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
