/**
 * Script to add supplier field to products that are missing it
 * This will prompt for supplier name for each product
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-key.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function addMissingSuppliers() {
  try {
    console.log('🔍 Searching for products without supplier information...\n');

    // Get all products
    const productsSnapshot = await db.collection('products').get();

    if (productsSnapshot.empty) {
      console.log('✅ No products found in database.');
      rl.close();
      await admin.app().delete();
      return;
    }

    const productsWithoutSupplier = [];
    
    for (const doc of productsSnapshot.docs) {
      const product = doc.data();
      if (!product.supplier || product.supplier.trim() === '') {
        productsWithoutSupplier.push({
          id: doc.id,
          ...product
        });
      }
    }

    console.log(`📦 Total products: ${productsSnapshot.size}`);
    console.log(`⚠️  Products without supplier: ${productsWithoutSupplier.length}\n`);

    if (productsWithoutSupplier.length === 0) {
      console.log('✅ All products have supplier information!');
      rl.close();
      await admin.app().delete();
      return;
    }

    console.log('Products missing supplier:\n');
    productsWithoutSupplier.forEach((p, index) => {
      console.log(`${index + 1}. ${p.name} (SKU: ${p.sku})`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('You can either:');
    console.log('1. Enter supplier name for each product individually');
    console.log('2. Set the same supplier for all products');
    console.log('3. Skip and exit');
    console.log('='.repeat(60) + '\n');

    const choice = await question('Choose option (1/2/3): ');

    if (choice === '3') {
      console.log('👋 Exiting without changes.');
      rl.close();
      await admin.app().delete();
      return;
    }

    if (choice === '2') {
      const supplierName = await question('\nEnter supplier name for all products: ');
      
      if (!supplierName || supplierName.trim() === '') {
        console.log('❌ Supplier name cannot be empty. Exiting.');
        rl.close();
        await admin.app().delete();
        return;
      }

      console.log('\n📝 Updating all products...\n');
      
      for (const product of productsWithoutSupplier) {
        await db.collection('products').doc(product.id).update({
          supplier: supplierName.trim(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Updated: ${product.name} -> ${supplierName.trim()}`);
      }

      console.log(`\n✨ Done! Updated ${productsWithoutSupplier.length} products.`);
    } else if (choice === '1') {
      console.log('\n📝 Enter supplier for each product:\n');
      
      for (const product of productsWithoutSupplier) {
        console.log(`\nProduct: ${product.name}`);
        console.log(`SKU: ${product.sku}`);
        console.log(`Price: $${product.price || '0'}`);
        
        const supplierName = await question('Supplier name (or press Enter to skip): ');
        
        if (supplierName && supplierName.trim() !== '') {
          await db.collection('products').doc(product.id).update({
            supplier: supplierName.trim(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Updated with supplier: ${supplierName.trim()}`);
        } else {
          console.log('⏭️  Skipped');
        }
      }

      console.log('\n✨ Done!');
    } else {
      console.log('❌ Invalid choice. Exiting.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    rl.close();
    await admin.app().delete();
  }
}

// Run the script
console.log('🚀 Starting supplier update script...\n');
addMissingSuppliers();
