/**
 * Script to add inventory transactions for existing refunded orders
 * This will create return transactions so refunded products appear in reports
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixRefundedOrders() {
  try {
    console.log('🔍 Searching for refunded orders without return transactions...\n');

    // Get all refunded orders
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'refunded')
      .get();

    if (ordersSnapshot.empty) {
      console.log('✅ No refunded orders found.');
      return;
    }

    console.log(`📦 Found ${ordersSnapshot.size} refunded order(s)\n`);

    let processedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const orderDoc of ordersSnapshot.docs) {
      const orderId = orderDoc.id;
      const orderData = orderDoc.data();
      const orderNumber = orderData.orderNumber || orderId;

      console.log(`\n📋 Processing Order: ${orderNumber}`);
      console.log(`   Order ID: ${orderId}`);
      console.log(`   Customer: ${orderData.customerName || 'Unknown'}`);
      console.log(`   Items: ${orderData.items?.length || 0}`);

      try {
        // Check if transactions already exist for this order
        const existingTransactions = await db.collection('inventoryTransactions')
          .where('reason', '==', `Return from order ${orderNumber}`)
          .get();

        if (!existingTransactions.empty) {
          console.log(`   ⏭️  Skipped - transactions already exist`);
          skippedCount++;
          continue;
        }

        const items = orderData.items || [];
        
        if (items.length === 0) {
          console.log(`   ⚠️  Warning - no items in order`);
          skippedCount++;
          continue;
        }

        // Create return transactions for each item
        for (const item of items) {
          // Get current product data
          const productRef = db.collection('products').doc(item.productId);
          const productDoc = await productRef.get();

          if (!productDoc.exists) {
            console.log(`   ⚠️  Product not found: ${item.productId} (${item.productName})`);
            continue;
          }

          const productData = productDoc.data();
          const currentQuantity = productData.quantity || 0;

          // Update product quantity (add returned items back)
          await productRef.update({
            quantity: currentQuantity + item.quantity,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Create inventory transaction
          await db.collection('inventoryTransactions').add({
            productId: item.productId,
            type: 'in',
            quantity: item.quantity,
            reason: `Return from order ${orderNumber}`,
            notes: `Refund approved - items returned to stock (historical data fix)`,
            createdAt: orderData.refundApprovedAt || orderData.updatedAt || admin.firestore.FieldValue.serverTimestamp(),
            userId: orderData.userId || orderData.customerId
          });

          console.log(`   ✅ Added return transaction: ${item.quantity}x ${item.productName}`);
          console.log(`      Updated stock: ${currentQuantity} → ${currentQuantity + item.quantity}`);
        }

        processedCount++;

      } catch (error) {
        console.error(`   ❌ Error processing order ${orderNumber}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Processed: ${processedCount} order(s)`);
    console.log(`⏭️  Skipped: ${skippedCount} order(s)`);
    console.log(`❌ Errors: ${errorCount} order(s)`);
    console.log('='.repeat(60));
    console.log('\n✨ Done! Refunded products should now appear in Reports.');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    // Clean up
    await admin.app().delete();
  }
}

// Run the script
console.log('🚀 Starting refunded orders fix script...\n');
fixRefundedOrders();
