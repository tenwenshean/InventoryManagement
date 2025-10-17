import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(fs.readFileSync('firebase-key.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateProducts() {
  // REPLACE THIS WITH YOUR ACTUAL USER UID
  const YOUR_USER_UID = 'EFCG0Cy1Z1egAfOFd7VpHvprr242';
  
  if (YOUR_USER_UID === 'PASTE_YOUR_UID_HERE') {
    console.error('❌ ERROR: Please replace YOUR_USER_UID with your actual UID!');
    console.log('\nTo get your UID:');
    console.log('1. Open your app in browser');
    console.log('2. Open browser console (F12)');
    console.log('3. Run: firebase.auth().currentUser.uid');
    console.log('4. Copy the UID and paste it in this script\n');
    process.exit(1);
  }

  console.log(`🔍 Starting migration for user: ${YOUR_USER_UID}\n`);

  try {
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    
    if (productsSnapshot.empty) {
      console.log('ℹ️  No products found in database.');
      process.exit(0);
    }

    console.log(`📦 Found ${productsSnapshot.size} products\n`);

    let updated = 0;
    let alreadyHasUserId = 0;
    let errors = 0;

    // Update each product
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      
      try {
        if (data.userId) {
          console.log(`⏭️  Skipping "${data.name}" - already has userId: ${data.userId}`);
          alreadyHasUserId++;
        } else {
          await doc.ref.update({
            userId: YOUR_USER_UID,
            userEmail: data.userEmail || 'migrated@user.com',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Updated "${data.name}" with userId`);
          updated++;
        }
      } catch (error) {
        console.error(`❌ Error updating product ${doc.id}:`, error.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updated} products`);
    console.log(`⏭️  Skipped: ${alreadyHasUserId} products (already had userId)`);
    console.log(`❌ Errors: ${errors} products`);
    console.log('='.repeat(50) + '\n');

    if (errors === 0) {
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('⚠️  Migration completed with some errors. Check logs above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run migration
migrateProducts();