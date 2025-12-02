import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function analyzeProductionData() {
  console.log('🔍 Analyzing Production Database\n');
  
  // Check all users with accounting entries
  const snapshot = await db.collection('accountingEntries').get();
  
  const userStats = {};
  const oldFormatByUser = {};
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const userId = data.userId || 'unknown';
    
    if (!userStats[userId]) {
      userStats[userId] = {
        total: 0,
        revenue: 0,
        expense: 0,
        oldFormat: 0
      };
    }
    
    userStats[userId].total++;
    
    if (data.accountType === 'revenue') {
      userStats[userId].revenue++;
    } else if (data.accountType === 'expense') {
      userStats[userId].expense++;
    } else if (data.type === 'sale' && data.revenue !== undefined) {
      userStats[userId].oldFormat++;
      oldFormatByUser[userId] = (oldFormatByUser[userId] || 0) + 1;
    }
  });
  
  console.log('📊 Database Overview:\n');
  console.log(`Total Entries: ${snapshot.size}`);
  console.log(`Unique Users: ${Object.keys(userStats).length}\n`);
  
  console.log('👥 Breakdown by User:\n');
  
  Object.entries(userStats).forEach(([userId, stats]) => {
    const userIdShort = userId.slice(0, 20) + '...';
    console.log(`User: ${userIdShort}`);
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  Revenue entries: ${stats.revenue}`);
    console.log(`  Expense entries: ${stats.expense}`);
    console.log(`  Old format: ${stats.oldFormat}`);
    
    if (stats.oldFormat > 0) {
      console.log(`  ⚠️  NEEDS MIGRATION`);
    } else {
      console.log(`  ✅ Already in correct format`);
    }
    console.log('');
  });
  
  const needsMigration = Object.values(userStats).some(s => s.oldFormat > 0);
  
  console.log('════════════════════════════════════════════════════════════');
  if (needsMigration) {
    console.log('⚠️  MIGRATION REQUIRED');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log('Run this command to fix:');
    console.log('npx tsx scripts/fix-production-accounting.js\n');
  } else {
    console.log('✅ NO MIGRATION NEEDED');
    console.log('════════════════════════════════════════════════════════════\n');
    console.log('All accounting entries are in the correct format.\n');
  }
}

analyzeProductionData().catch(console.error);
