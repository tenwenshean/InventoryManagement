import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkAssetsEntries(userId) {
  console.log('🔍 Checking for Assets entries with value 100\n');
  
  // Get all accounting entries for this user
  const snapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  console.log(`📊 Total entries found: ${snapshot.size}\n`);
  
  // Filter for Assets entries with 100
  const assetsEntries = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.accountName === 'Assets' && data.accountType === 'asset') {
      if (data.debitAmount == 100 || data.creditAmount == 100) {
        assetsEntries.push({ id: doc.id, ...data });
      }
    }
  });
  
  console.log(`💰 Found ${assetsEntries.length} Assets entries with value 100:\n`);
  
  assetsEntries.forEach((entry, index) => {
    console.log(`Entry ${index + 1} (ID: ${entry.id}):`);
    console.log(`  Account: ${entry.accountName}`);
    console.log(`  Type: ${entry.accountType}`);
    console.log(`  Debit: ${entry.debitAmount || 0}`);
    console.log(`  Credit: ${entry.creditAmount || 0}`);
    console.log(`  Description: ${entry.description || 'N/A'}`);
    console.log(`  Created: ${entry.createdAt?.toDate?.() || entry.createdAt}`);
    console.log('\n');
  });
  
  // Also check recent entries (last 10)
  console.log('\n📝 Last 10 entries created:\n');
  const recentSnapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  
  recentSnapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`${index + 1}. [${doc.id}] ${data.accountType} - ${data.accountName}: Debit ${data.debitAmount || 0}, Credit ${data.creditAmount || 0}`);
  });
}

const userId = process.argv[2] || 'EFCG0Cy1Z1egAfOFd7VpHvprr242';
checkAssetsEntries(userId).catch(console.error);
