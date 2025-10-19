// Migration script to add userId to existing products and categories
// Run this once to fix items that don't have userId field

import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Initialize Firebase Admin using environment variables
if (!admin.apps.length) {
  const serviceAccount = {
    type: "service_account",
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: process.env.FIREBASE_CERT_URL
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateProducts() {
  try {
    console.log('🔍 Fetching all products and categories...');
    
    // Get all products
    const productsSnapshot = await db.collection('products').get();
    console.log(`📦 Found ${productsSnapshot.size} total products`);
    
    // Get all categories
    const categoriesSnapshot = await db.collection('categories').get();
    console.log(`📂 Found ${categoriesSnapshot.size} total categories`);
    
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
    console.log(`\n👤 Will assign items without userId to: ${defaultUser.email || defaultUser.uid}`);
    console.log('   You can change this by editing the script.\n');
    
    let productsUpdated = 0;
    let productsSkipped = 0;
    let categoriesUpdated = 0;
    let categoriesSkipped = 0;
    
    const batch = db.batch();
    
    // Migrate products
    console.log('\n📦 Migrating Products:');
    for (const doc of productsSnapshot.docs) {
      const data = doc.data();
      
      // Check if product already has userId
      if (data.userId) {
        console.log(`⏭️  Skipping "${data.name}" - already has userId: ${data.userId}`);
        productsSkipped++;
        continue;
      }
      
      // Add userId and userEmail to product
      console.log(`✅ Updating "${data.name}" - adding userId: ${defaultUser.uid}`);
      batch.update(doc.ref, {
        userId: defaultUser.uid,
        userEmail: defaultUser.email || '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      productsUpdated++;
    }
    
    // Migrate categories
    console.log('\n📂 Migrating Categories:');
    for (const doc of categoriesSnapshot.docs) {
      const data = doc.data();
      
      // Check if category already has userId
      if (data.userId) {
        console.log(`⏭️  Skipping "${data.name}" - already has userId: ${data.userId}`);
        categoriesSkipped++;
        continue;
      }
      
      // Add userId to category
      console.log(`✅ Updating "${data.name}" - adding userId: ${defaultUser.uid}`);
      batch.update(doc.ref, {
        userId: defaultUser.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      categoriesUpdated++;
    }
    
    const totalUpdates = productsUpdated + categoriesUpdated;
    if (totalUpdates > 0) {
      console.log(`\n💾 Committing ${totalUpdates} updates...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('\n✅ No items needed migration.');
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Products:`);
    console.log(`     - Updated: ${productsUpdated}`);
    console.log(`     - Skipped: ${productsSkipped} (already had userId)`);
    console.log(`     - Total: ${productsSnapshot.size}`);
    console.log(`   Categories:`);
    console.log(`     - Updated: ${categoriesUpdated}`);
    console.log(`     - Skipped: ${categoriesSkipped} (already had userId)`);
    console.log(`     - Total: ${categoriesSnapshot.size}`);
    
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
