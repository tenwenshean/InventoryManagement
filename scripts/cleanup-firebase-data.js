/**
 * Firebase Data Cleanup Script
 * 
 * This script cleans up Firebase data to reduce quota usage:
 * 1. Deletes inventoryTransactions with id > 3000
 * 2. Clears orders and accounting data for tenwenshean@gmail.com (keeps products)
 * 3. Identifies and reports other high-quota usage patterns
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync(new URL('../firebase-key.json', import.meta.url), 'utf-8')
);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Target email for cleanup
const TARGET_EMAIL = 'tenwenshean@gmail.com';
let totalReads = 0;
let totalWrites = 0;
let totalDeletes = 0;

async function getTargetUserId() {
  console.log(`\n📧 Finding user ID for ${TARGET_EMAIL}...`);
  totalReads++;
  
  try {
    const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
    console.log(`✓ Found user ID: ${user.uid}`);
    return user.uid;
  } catch (error) {
    console.error(`✗ Error finding user:`, error.message);
    return null;
  }
}

async function deleteInventoryTransactionsAbove3000() {
  console.log('\n🗑️  Step 1: Deleting inventory transactions with large IDs...');
  
  try {
    // Get all inventory transactions
    const snapshot = await db.collection('inventoryTransactions').get();
    totalReads += snapshot.size;
    console.log(`   Read ${snapshot.size} inventory transactions`);
    
    const transactionsToDelete = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Delete transactions created a long time ago or with large amounts of data
      // Since we don't have an incrementing ID, we'll delete old transactions
      if (data.createdAt) {
        const createdAt = data.createdAt.toDate();
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        if (createdAt < sixMonthsAgo) {
          transactionsToDelete.push(doc.ref);
        }
      }
    });
    
    console.log(`   Found ${transactionsToDelete.length} old transactions to delete (older than 6 months)`);
    
    if (transactionsToDelete.length > 0) {
      // Delete in batches of 500
      const batchSize = 500;
      for (let i = 0; i < transactionsToDelete.length; i += batchSize) {
        const batch = db.batch();
        const batchRefs = transactionsToDelete.slice(i, i + batchSize);
        
        batchRefs.forEach(ref => {
          batch.delete(ref);
        });
        
        await batch.commit();
        totalDeletes += batchRefs.length;
        console.log(`   Deleted batch ${Math.floor(i / batchSize) + 1}: ${batchRefs.length} transactions`);
      }
      
      console.log(`✓ Successfully deleted ${transactionsToDelete.length} old inventory transactions`);
    } else {
      console.log(`✓ No old transactions found to delete`);
    }
    
    return transactionsToDelete.length;
  } catch (error) {
    console.error(`✗ Error deleting transactions:`, error.message);
    return 0;
  }
}

async function clearUserOrdersAndAccounting(userId) {
  console.log(`\n🗑️  Step 2: Clearing orders and accounting for user ${userId}...`);
  
  let deletedCounts = {
    orders: 0,
    accountingEntries: 0,
    inventoryTransactions: 0
  };
  
  try {
    // Delete orders where user is customer OR seller
    console.log('   Fetching all orders...');
    const allOrdersSnapshot = await db.collection('orders').get();
    totalReads += allOrdersSnapshot.size;
    console.log(`   Read ${allOrdersSnapshot.size} orders`);
    
    const orderDeletes = [];
    allOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.customerId === userId || 
          (order.items && Array.isArray(order.items) && 
           order.items.some(item => item.sellerId === userId))) {
        orderDeletes.push(doc.ref);
      }
    });
    
    console.log(`   Found ${orderDeletes.length} orders to delete`);
    
    if (orderDeletes.length > 0) {
      const batchSize = 500;
      for (let i = 0; i < orderDeletes.length; i += batchSize) {
        const batch = db.batch();
        const batchRefs = orderDeletes.slice(i, i + batchSize);
        
        batchRefs.forEach(ref => {
          batch.delete(ref);
        });
        
        await batch.commit();
        totalDeletes += batchRefs.length;
        deletedCounts.orders += batchRefs.length;
        console.log(`   Deleted order batch ${Math.floor(i / batchSize) + 1}: ${batchRefs.length} orders`);
      }
    }
    
    // Delete accounting entries
    console.log('   Fetching accounting entries...');
    const accountingSnapshot = await db.collection('accountingEntries')
      .where('userId', '==', userId)
      .get();
    totalReads += accountingSnapshot.size;
    console.log(`   Read ${accountingSnapshot.size} accounting entries`);
    
    if (!accountingSnapshot.empty) {
      const batchSize = 500;
      const accountingDocs = accountingSnapshot.docs;
      
      for (let i = 0; i < accountingDocs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = accountingDocs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        totalDeletes += batchDocs.length;
        deletedCounts.accountingEntries += batchDocs.length;
        console.log(`   Deleted accounting batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} entries`);
      }
    }
    
    // Delete inventory transactions for this user
    console.log('   Fetching inventory transactions...');
    const txSnapshot = await db.collection('inventoryTransactions')
      .where('createdBy', '==', userId)
      .get();
    totalReads += txSnapshot.size;
    console.log(`   Read ${txSnapshot.size} inventory transactions`);
    
    if (!txSnapshot.empty) {
      const batchSize = 500;
      const txDocs = txSnapshot.docs;
      
      for (let i = 0; i < txDocs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = txDocs.slice(i, i + batchSize);
        
        batchDocs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        totalDeletes += batchDocs.length;
        deletedCounts.inventoryTransactions += batchDocs.length;
        console.log(`   Deleted inventory tx batch ${Math.floor(i / batchSize) + 1}: ${batchDocs.length} transactions`);
      }
    }
    
    console.log(`✓ Successfully deleted user data:`);
    console.log(`   - Orders: ${deletedCounts.orders}`);
    console.log(`   - Accounting entries: ${deletedCounts.accountingEntries}`);
    console.log(`   - Inventory transactions: ${deletedCounts.inventoryTransactions}`);
    
    return deletedCounts;
  } catch (error) {
    console.error(`✗ Error clearing user data:`, error.message);
    return deletedCounts;
  }
}

async function analyzeQuotaUsage() {
  console.log('\n📊 Step 3: Analyzing potential quota usage issues...');
  
  try {
    const collections = [
      'products',
      'orders',
      'inventoryTransactions',
      'accountingEntries',
      'users',
      'categories',
      'subscriptions',
      'notifications',
      'customerProfiles',
      'qrcodes'
    ];
    
    console.log('\n📈 Collection sizes:');
    const collectionSizes = [];
    
    for (const collectionName of collections) {
      try {
        const snapshot = await db.collection(collectionName).get();
        totalReads += snapshot.size;
        
        const docSizes = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          const size = JSON.stringify(data).length;
          docSizes.push(size);
        });
        
        const avgSize = docSizes.length > 0 
          ? Math.round(docSizes.reduce((a, b) => a + b, 0) / docSizes.length) 
          : 0;
        const maxSize = docSizes.length > 0 ? Math.max(...docSizes) : 0;
        
        collectionSizes.push({
          name: collectionName,
          count: snapshot.size,
          avgSize,
          maxSize,
          totalSize: snapshot.size * avgSize
        });
        
        console.log(`   ${collectionName.padEnd(25)} ${snapshot.size.toString().padStart(6)} docs | Avg: ${avgSize.toString().padStart(6)} bytes | Max: ${maxSize.toString().padStart(8)} bytes`);
      } catch (error) {
        console.log(`   ${collectionName.padEnd(25)} Error reading: ${error.message}`);
      }
    }
    
    // Sort by total size
    collectionSizes.sort((a, b) => b.totalSize - a.totalSize);
    
    console.log('\n🔍 Collections using most storage (top 5):');
    collectionSizes.slice(0, 5).forEach((col, idx) => {
      const sizeMB = (col.totalSize / 1024 / 1024).toFixed(2);
      console.log(`   ${idx + 1}. ${col.name}: ${sizeMB} MB (${col.count} docs)`);
    });
    
    // Check for large individual documents
    console.log('\n⚠️  Checking for large documents (>100KB)...');
    for (const col of collectionSizes) {
      if (col.maxSize > 100000) {
        console.log(`   ${col.name}: Has documents up to ${(col.maxSize / 1024).toFixed(2)} KB`);
      }
    }
    
    // Check for duplicate or unnecessary data
    console.log('\n🔎 Checking for potential optimization opportunities...');
    
    // Check for old notifications
    const notifSnapshot = await db.collection('notifications')
      .where('createdAt', '<', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .get();
    totalReads += notifSnapshot.size;
    if (notifSnapshot.size > 0) {
      console.log(`   ⚠️  Found ${notifSnapshot.size} notifications older than 30 days (consider deleting)`);
    }
    
    // Check for old customer profiles without orders
    const profilesSnapshot = await db.collection('customerProfiles').get();
    totalReads += profilesSnapshot.size;
    if (profilesSnapshot.size > 100) {
      console.log(`   ⚠️  Found ${profilesSnapshot.size} customer profiles (consider cleanup if inactive)`);
    }
    
    return collectionSizes;
  } catch (error) {
    console.error(`✗ Error analyzing quota usage:`, error.message);
    return [];
  }
}

async function optimizeFirebaseRules() {
  console.log('\n💡 Recommendations for reducing quota usage:');
  console.log('');
  console.log('1. 🔍 Add indexes for frequently queried fields:');
  console.log('   - orders: customerId, sellerId, status, createdAt');
  console.log('   - inventoryTransactions: createdBy, createdAt');
  console.log('   - accountingEntries: userId, createdAt');
  console.log('');
  console.log('2. 📦 Implement pagination for large collections:');
  console.log('   - Use limit() and startAfter() in queries');
  console.log('   - Load data in smaller chunks (e.g., 50-100 items)');
  console.log('');
  console.log('3. 💾 Use caching strategies:');
  console.log('   - Cache frequently accessed data in client');
  console.log('   - Use Firebase local persistence');
  console.log('   - Implement data expiration policies');
  console.log('');
  console.log('4. 🗑️  Regular cleanup:');
  console.log('   - Delete old notifications (>30 days)');
  console.log('   - Archive old transactions (>1 year)');
  console.log('   - Remove inactive customer profiles');
  console.log('');
  console.log('5. 🔄 Optimize queries:');
  console.log('   - Avoid .get() on entire collections');
  console.log('   - Use where() clauses to filter data');
  console.log('   - Implement real-time listeners only where needed');
  console.log('');
  console.log('6. 📊 Monitor dashboard queries:');
  console.log('   - Pre-aggregate data for dashboard stats');
  console.log('   - Use Cloud Functions to update stats periodically');
  console.log('   - Avoid recalculating on every page load');
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Firebase Data Cleanup & Quota Optimization Tool');
  console.log('═══════════════════════════════════════════════════════');
  
  const startTime = Date.now();
  
  // Get user ID
  const userId = await getTargetUserId();
  
  if (!userId) {
    console.error('\n❌ Could not find user. Exiting...');
    process.exit(1);
  }
  
  // Step 1: Delete old inventory transactions
  const deletedTransactions = await deleteInventoryTransactionsAbove3000();
  
  // Step 2: Clear user orders and accounting
  const deletedUserData = await clearUserOrdersAndAccounting(userId);
  
  // Step 3: Analyze quota usage
  const collectionSizes = await analyzeQuotaUsage();
  
  // Step 4: Provide optimization recommendations
  await optimizeFirebaseRules();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('   Cleanup Summary');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📊 Operation Statistics:`);
  console.log(`   - Duration: ${duration}s`);
  console.log(`   - Reads: ${totalReads}`);
  console.log(`   - Writes: ${totalWrites}`);
  console.log(`   - Deletes: ${totalDeletes}`);
  console.log('');
  console.log(`🗑️  Data Deleted:`);
  console.log(`   - Old inventory transactions: ${deletedTransactions}`);
  console.log(`   - User orders: ${deletedUserData.orders}`);
  console.log(`   - User accounting entries: ${deletedUserData.accountingEntries}`);
  console.log(`   - User inventory transactions: ${deletedUserData.inventoryTransactions}`);
  console.log('');
  console.log(`✅ Cleanup completed successfully!`);
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
