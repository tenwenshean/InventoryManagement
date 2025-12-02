/**
 * Expand Kaggle data across 6 months for ML predictions
 * Takes the 30 days of sales and replicates the pattern monthly
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
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

async function expandKaggleData(userId) {
  console.log('🔄 Expanding Kaggle data across 6 months...\n');
  
  // Get existing Kaggle accounting entries
  const existingEntries = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  const kaggleEntries = [];
  existingEntries.forEach(doc => {
    const data = doc.data();
    if (data.orderId && data.orderId.includes('KAGGLE')) {
      kaggleEntries.push(data);
    }
  });
  
  console.log(`📊 Found ${kaggleEntries.length} Kaggle entries to replicate`);
  
  // Calculate total revenue per month from existing data
  const totalRevenue = kaggleEntries.reduce((sum, e) => sum + (e.revenue || 0), 0);
  const avgDailyRevenue = totalRevenue / 30;
  
  console.log(`💰 Original month revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`📅 Average daily: $${avgDailyRevenue.toFixed(2)}\n`);
  
  // Create 5 more months (we already have July, add Aug-Dec 2024)
  const monthsToCreate = [
    { month: 8, name: 'August', growthFactor: 1.05 },
    { month: 9, name: 'September', growthFactor: 1.08 },
    { month: 10, name: 'October', growthFactor: 1.12 },
    { month: 11, name: 'November', growthFactor: 1.15 },
    { month: 12, name: 'December', growthFactor: 1.20 }
  ];
  
  let totalCreated = 0;
  
  for (const monthInfo of monthsToCreate) {
    console.log(`📅 Creating ${monthInfo.name} 2024 (${(monthInfo.growthFactor * 100 - 100).toFixed(0)}% growth)...`);
    
    // Create ~30 entries for this month
    const daysInMonth = new Date(2024, monthInfo.month, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(2024, monthInfo.month - 1, day);
      const dailyRevenue = avgDailyRevenue * monthInfo.growthFactor * (0.9 + Math.random() * 0.2);
      const dailyCOGS = dailyRevenue * 0.6;
      
      const entry = {
        userId,
        date: Timestamp.fromDate(date),
        type: 'sale',
        category: 'Product Sales',
        description: `Kaggle sales - ${monthInfo.name} day ${day}`,
        revenue: dailyRevenue,
        expense: dailyCOGS,
        profit: dailyRevenue - dailyCOGS,
        orderId: `KAGGLE-${monthInfo.month}-${day}`,
        createdAt: Timestamp.fromDate(date)
      };
      
      await db.collection('accountingEntries').add(entry);
      totalCreated++;
    }
    
    console.log(`  ✓ Created ${daysInMonth} entries`);
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('📊 EXPANSION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`✅ New Entries Created: ${totalCreated}`);
  console.log(`📅 Date Range: July - December 2024 (6 months)`);
  console.log(`💰 Estimated Total Revenue: $${(totalRevenue * 6.6).toFixed(2)}`);
  console.log(`📈 Growth Pattern: +5% → +20% (simulates growing business)`);
  console.log('═'.repeat(60));
  console.log('\n✨ Expansion complete! Now you have 6 months of data.');
  console.log('\n📍 Next Steps:');
  console.log('   1. Refresh your browser (Ctrl+Shift+R)');
  console.log('   2. Go to Reports page');
  console.log('   3. ML predictions should now show with good confidence');
  console.log('   4. Check Accounting to see 6 months of revenue\n');
}

const userId = process.argv[2];

if (!userId) {
  console.error('❌ Please provide userId');
  console.log('Usage: npx tsx scripts/expand-kaggle-data.js YOUR_USER_ID');
  process.exit(1);
}

expandKaggleData(userId)
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
