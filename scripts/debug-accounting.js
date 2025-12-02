import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function debugAccounting(userId) {
  console.log('🔍 Debugging Accounting Entries\n');
  
  const snapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .limit(5)
    .get();
  
  console.log(`📊 Found ${snapshot.size} sample entries\n`);
  
  snapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`Entry ${index + 1}:`);
    console.log(JSON.stringify(data, null, 2));
    console.log('\n');
  });
}

const userId = process.argv[2] || 'EFCG0Cy1Z1egAfOFd7VpHvprr242';
debugAccounting(userId).catch(console.error);
