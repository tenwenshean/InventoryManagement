/**
 * Verify Firebase Data - Check what actually exists in database
 * Run this to see what data is currently in Firebase for tenwenshean@gmail.com
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
const TARGET_EMAIL = 'tenwenshean@gmail.com';

async function verifyData() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('   Firebase Data Verification Tool');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Get user ID
    console.log(`📧 Finding user ID for ${TARGET_EMAIL}...`);
    const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
    const userId = user.uid;
    console.log(`✓ Found user ID: ${userId}\n`);
    
    // Check orders
    console.log('📦 Checking Orders...');
    const allOrdersSnapshot = await db.collection('orders').get();
    const userOrders = [];
    
    allOrdersSnapshot.forEach(doc => {
      const order = doc.data();
      if (order.customerId === userId || 
          (order.items && Array.isArray(order.items) && 
           order.items.some(item => item.sellerId === userId))) {
        userOrders.push({
          id: doc.id,
          orderNumber: order.orderNumber,
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt?.toDate?.()?.toISOString() || order.createdAt
        });
      }
    });
    
    console.log(`   Total orders in database: ${allOrdersSnapshot.size}`);
    console.log(`   Orders for ${TARGET_EMAIL}: ${userOrders.length}`);
    
    if (userOrders.length > 0) {
      console.log(`   ⚠️  Found ${userOrders.length} orders that should be deleted!`);
      console.log('   Recent orders:');
      userOrders.slice(0, 5).forEach((order, idx) => {
        console.log(`     ${idx + 1}. ${order.orderNumber} - ${order.status} - $${order.totalAmount} - ${order.createdAt}`);
      });
    } else {
      console.log(`   ✓ No orders found for this user`);
    }
    
    // Check accounting entries
    console.log('\n💰 Checking Accounting Entries...');
    const accountingSnapshot = await db.collection('accountingEntries')
      .where('userId', '==', userId)
      .get();
    
    console.log(`   Accounting entries for ${TARGET_EMAIL}: ${accountingSnapshot.size}`);
    
    if (accountingSnapshot.size > 0) {
      console.log(`   ⚠️  Found ${accountingSnapshot.size} accounting entries that should be deleted!`);
      const entries = accountingSnapshot.docs.slice(0, 5).map(doc => {
        const data = doc.data();
        return {
          accountName: data.accountName,
          debit: data.debitAmount,
          credit: data.creditAmount,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
        };
      });
      console.log('   Recent entries:');
      entries.forEach((entry, idx) => {
        console.log(`     ${idx + 1}. ${entry.accountName} - Debit: ${entry.debit}, Credit: ${entry.credit} - ${entry.createdAt}`);
      });
    } else {
      console.log(`   ✓ No accounting entries found for this user`);
    }
    
    // Check inventory transactions
    console.log('\n📊 Checking Inventory Transactions...');
    const txSnapshot = await db.collection('inventoryTransactions')
      .where('createdBy', '==', userId)
      .get();
    
    console.log(`   Inventory transactions for ${TARGET_EMAIL}: ${txSnapshot.size}`);
    
    if (txSnapshot.size > 0) {
      console.log(`   ⚠️  Found ${txSnapshot.size} inventory transactions that should be deleted!`);
    } else {
      console.log(`   ✓ No inventory transactions found for this user`);
    }
    
    // Check all inventory transactions (for old ones)
    console.log('\n📦 Checking All Inventory Transactions (age check)...');
    const allTxSnapshot = await db.collection('inventoryTransactions').get();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    let oldCount = 0;
    allTxSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdAt) {
        const createdAt = data.createdAt.toDate();
        if (createdAt < sixMonthsAgo) {
          oldCount++;
        }
      }
    });
    
    console.log(`   Total inventory transactions: ${allTxSnapshot.size}`);
    console.log(`   Old transactions (>6 months): ${oldCount}`);
    
    if (oldCount > 0) {
      console.log(`   ⚠️  Found ${oldCount} old transactions that should be deleted!`);
    } else {
      console.log(`   ✓ No old transactions found`);
    }
    
    // Check products (should NOT be deleted)
    console.log('\n🏷️  Checking Products (should NOT be deleted)...');
    const productsSnapshot = await db.collection('products')
      .where('userId', '==', userId)
      .get();
    
    console.log(`   Products for ${TARGET_EMAIL}: ${productsSnapshot.size}`);
    console.log(`   ✓ Products will be preserved`);
    
    // Summary
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('   Summary');
    console.log('═══════════════════════════════════════════════════════\n');
    
    const needsCleanup = userOrders.length > 0 || 
                        accountingSnapshot.size > 0 || 
                        txSnapshot.size > 0 || 
                        oldCount > 0;
    
    if (needsCleanup) {
      console.log('⚠️  DATA CLEANUP NEEDED\n');
      console.log('Items to be deleted:');
      console.log(`   - Orders: ${userOrders.length}`);
      console.log(`   - Accounting entries: ${accountingSnapshot.size}`);
      console.log(`   - User inventory transactions: ${txSnapshot.size}`);
      console.log(`   - Old inventory transactions (>6 months): ${oldCount}`);
      console.log(`   - Products: 0 (will be preserved)`);
      console.log('\nRun cleanup-firebase-data.js to delete this data');
    } else {
      console.log('✅ DATABASE IS CLEAN\n');
      console.log('No data needs to be deleted for this user.');
      console.log('If you\'re still seeing data in the frontend, try:');
      console.log('1. Clear browser cache (Ctrl+Shift+Delete)');
      console.log('2. Clear localStorage: Open DevTools → Application → Local Storage → Clear');
      console.log('3. Hard refresh the page (Ctrl+Shift+R)');
      console.log('4. Restart the dev server');
    }
    
    console.log('\n═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
  
  process.exit(0);
}

// Run verification
verifyData().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
