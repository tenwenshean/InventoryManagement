// Migration script to add userId to existing products
// Run this once to fix products that don't have userId field

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateProducts() {
  try {
    console.log('🔍 Fetching all products...');
    
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    console.log(`📦 Found ${productsSnapshot.size} total products`);
    
    // Get all users to assign products to
    const usersSnapshot = await db.collection('users').get();
    const users = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    console.log(`👥 Found ${users.length} users`);
    
    if (users.length === 0) {
      console.error('❌ No users found. Please create a user account first.');
      process.exit(1);
    }
    
    // Use the first user as the default owner
    const defaultUser = users[0];
    console.log(`\n👤 Will assign products without userId to: ${defaultUser.email || defaultUser.uid}`);
    console.log('   You can change this by editing the script.\n');
    
    let updated = 0;
    let skipped = 0;
    
    const batch = db.batch();
    
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      
      // Check if product already has userId
      if (data.userId) {
        console.log(`⏭️  Skipping "${data.name}" - already has userId: ${data.userId}`);
        skipped++;
        continue;
      }
      
      // Add userId and userEmail to product
      console.log(`✅ Updating "${data.name}" - adding userId: ${defaultUser.uid}`);
      batch.update(doc.ref, {
        userId: defaultUser.uid,
        userEmail: defaultUser.email || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updated++;
    }
    
    if (updated > 0) {
      console.log(`\n💾 Committing ${updated} updates...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('\n✅ No products needed migration.');
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   - Updated: ${updated} products`);
    console.log(`   - Skipped: ${skipped} products (already had userId)`);
    console.log(`   - Total: ${productsSnapshot.size} products`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateProducts()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
