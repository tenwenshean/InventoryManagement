/**
 * Update Kaggle Sales Data to Recent Dates
 * This shifts the June 2021 data to recent months so ML predictions work
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../firebase-key.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateDatesToRecent(userId) {
  console.log('🔄 Updating Kaggle sales data to recent dates...\n');
  
  // Calculate date shift: from June 2021 to recent months
  // Shift to last 6 months (July-December 2024)
  const sourceMonth = new Date('2021-06-01');
  const targetMonth = new Date('2024-07-01'); // Start from July 2024
  const monthsDiff = (targetMonth.getFullYear() - sourceMonth.getFullYear()) * 12 + 
                     (targetMonth.getMonth() - sourceMonth.getMonth());
  
  console.log(`📅 Shifting dates forward by ${monthsDiff} months (June 2021 → July-Dec 2024)\n`);
  
  // Update orders
  console.log('🛒 Updating orders...');
  const ordersSnapshot = await db.collection('orders')
    .where('orderNumber', '>=', 'KAGGLE-ORDER-')
    .where('orderNumber', '<=', 'KAGGLE-ORDER-\uf8ff')
    .get();
  
  let orderCount = 0;
  const batch1 = db.batch();
  
  for (const doc of ordersSnapshot.docs) {
    const data = doc.data();
    const oldDate = data.createdAt.toDate();
    const newDate = new Date(oldDate);
    newDate.setMonth(oldDate.getMonth() + monthsDiff);
    
    batch1.update(doc.ref, {
      createdAt: Timestamp.fromDate(newDate),
      updatedAt: Timestamp.fromDate(newDate)
    });
    
    orderCount++;
  }
  
  await batch1.commit();
  console.log(`✅ Updated ${orderCount} orders\n`);
  
  // Update accounting entries
  console.log('💰 Updating accounting entries...');
  const accountingSnapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  let accountingCount = 0;
  const accountingBatches = [];
  let currentBatch = db.batch();
  let batchCount = 0;
  
  for (const doc of accountingSnapshot.docs) {
    const data = doc.data();
    
    // Only update Kaggle-imported entries (check if orderId contains KAGGLE)
    if (data.orderId && data.orderId.includes('KAGGLE')) {
      const oldDate = data.date.toDate();
      const newDate = new Date(oldDate);
      newDate.setMonth(oldDate.getMonth() + monthsDiff);
      
      currentBatch.update(doc.ref, {
        date: Timestamp.fromDate(newDate),
        createdAt: Timestamp.fromDate(newDate)
      });
      
      accountingCount++;
      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount >= 500) {
        accountingBatches.push(currentBatch);
        currentBatch = db.batch();
        batchCount = 0;
      }
    }
  }
  
  if (batchCount > 0) {
    accountingBatches.push(currentBatch);
  }
  
  for (const batch of accountingBatches) {
    await batch.commit();
  }
  
  console.log(`✅ Updated ${accountingCount} accounting entries\n`);
  
  // Update products (created date)
  console.log('📦 Updating products...');
  const productsSnapshot = await db.collection('products')
    .where('userId', '==', userId)
    .get();
  
  let productCount = 0;
  const batch3 = db.batch();
  
  for (const doc of productsSnapshot.docs) {
    const data = doc.data();
    
    // Only update Kaggle products
    if (doc.id.startsWith('KAGGLE-')) {
      const oldDate = data.createdAt.toDate();
      const newDate = new Date(oldDate);
      newDate.setMonth(oldDate.getMonth() + monthsDiff);
      
      batch3.update(doc.ref, {
        createdAt: Timestamp.fromDate(newDate)
      });
      
      productCount++;
    }
  }
  
  await batch3.commit();
  console.log(`✅ Updated ${productCount} products\n`);
  
  console.log('═'.repeat(60));
  console.log('📊 UPDATE SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ Orders Updated: ${orderCount}`);
  console.log(`✅ Accounting Entries Updated: ${accountingCount}`);
  console.log(`✅ Products Updated: ${productCount}`);
  console.log(`📅 New Date Range: July - December 2024`);
  console.log('═'.repeat(60));
  console.log('\n✨ Data update complete! ML predictions should now work.');
  console.log('\n📍 Next Steps:');
  console.log('   1. Refresh your browser');
  console.log('   2. Go to Reports page');
  console.log('   3. See ML predictions based on last 6 months of data');
  console.log('   4. Check Accounting page for revenue trends\n');
}

// Get userId from command line
const userId = process.argv[2];

if (!userId) {
  console.error('❌ Error: Please provide a userId as argument');
  console.log('\nUsage: npx tsx scripts/update-kaggle-dates.js YOUR_USER_ID');
  process.exit(1);
}

updateDatesToRecent(userId)
  .then(() => {
    console.log('✅ Update script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error updating data:', error);
    process.exit(1);
  });
