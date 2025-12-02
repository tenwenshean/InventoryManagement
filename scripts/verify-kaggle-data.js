/**
 * Verify Kaggle data in database
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../firebase-key.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function verifyData(userId) {
  console.log('🔍 Verifying Kaggle data in database...\n');
  
  // Check accounting entries
  const entries = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  const byMonth = {};
  
  entries.forEach(doc => {
    const data = doc.data();
    const date = data.date?.toDate() || data.createdAt?.toDate();
    if (date) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { count: 0, revenue: 0, expense: 0 };
      }
      byMonth[monthKey].count++;
      byMonth[monthKey].revenue += data.revenue || 0;
      byMonth[monthKey].expense += data.expense || 0;
    }
  });
  
  console.log('📊 Accounting Entries by Month:\n');
  const months = Object.keys(byMonth).sort();
  
  months.forEach(month => {
    const data = byMonth[month];
    console.log(`${month}: ${data.count} entries, Revenue: $${data.revenue.toFixed(2)}, Expense: $${data.expense.toFixed(2)}`);
  });
  
  console.log(`\n✅ Total: ${entries.size} accounting entries`);
  console.log(`📅 Months with data: ${months.length}`);
  
  if (months.length >= 6) {
    console.log('\n✅ GOOD: You have 6+ months of data for ML predictions');
  } else {
    console.log('\n⚠️ WARNING: Need 6+ months for good ML predictions');
  }
  
  console.log('\n💡 If Reports page shows $0:');
  console.log('   1. Make sure dev server is running (npm run dev)');
  console.log('   2. Hard refresh browser (Ctrl+Shift+R)');
  console.log('   3. Check browser console (F12) for errors');
  console.log('   4. Go to Accounting page first to verify data shows');
}

const userId = process.argv[2] || 'EFCG0Cy1Z1egAfOFd7VpHvprr242';

verifyData(userId)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
