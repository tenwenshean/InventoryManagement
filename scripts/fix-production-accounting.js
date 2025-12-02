import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixProductionAccountingEntries() {
  console.log('🔧 PRODUCTION: Fixing Accounting Entries Structure\n');
  console.log('⚠️  This will modify ALL accounting entries with old structure\n');
  
  // Get all accounting entries with old structure
  const snapshot = await db.collection('accountingEntries').get();
  
  console.log(`📊 Total entries in database: ${snapshot.size}`);
  
  // Count entries that need fixing
  let needsFixing = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.type === 'sale' && data.revenue !== undefined && data.expense !== undefined) {
      needsFixing++;
    }
  });
  
  console.log(`📝 Entries needing fix: ${needsFixing}\n`);
  
  if (needsFixing === 0) {
    console.log('✅ No entries need fixing. All entries are already in correct format.\n');
    return;
  }
  
  console.log(`⚠️  WARNING: This will:`);
  console.log(`   - Delete ${needsFixing} old entries`);
  console.log(`   - Create ${needsFixing * 2} new entries (revenue + expense pairs)`);
  console.log(`   - Process in batches to avoid timeouts\n`);
  
  // Process in batches
  const BATCH_SIZE = 100;
  let processedCount = 0;
  let totalRevenue = 0;
  let totalExpense = 0;
  
  const entriesToFix = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.type === 'sale' && data.revenue !== undefined && data.expense !== undefined) {
      entriesToFix.push({ id: doc.id, data });
    }
  });
  
  for (let i = 0; i < entriesToFix.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const batchEntries = entriesToFix.slice(i, i + BATCH_SIZE);
    
    for (const entry of batchEntries) {
      // Delete old entry
      batch.delete(db.collection('accountingEntries').doc(entry.id));
      
      // Create revenue entry
      const revenueEntry = {
        userId: entry.data.userId,
        accountType: 'revenue',
        accountName: 'Sales Revenue',
        debitAmount: '0',
        creditAmount: entry.data.revenue.toString(),
        description: entry.data.description || 'Product sales',
        createdAt: entry.data.date || entry.data.createdAt,
      };
      
      // Create expense entry (COGS)
      const expenseEntry = {
        userId: entry.data.userId,
        accountType: 'expense',
        accountName: 'Cost of Goods Sold',
        debitAmount: entry.data.expense.toString(),
        creditAmount: '0',
        description: `COGS - ${entry.data.description || 'Product sales'}`,
        createdAt: entry.data.date || entry.data.createdAt,
      };
      
      batch.set(db.collection('accountingEntries').doc(), revenueEntry);
      batch.set(db.collection('accountingEntries').doc(), expenseEntry);
      
      totalRevenue += entry.data.revenue;
      totalExpense += entry.data.expense;
      processedCount++;
    }
    
    await batch.commit();
    console.log(`   ✓ Processed ${Math.min(i + BATCH_SIZE, entriesToFix.length)}/${entriesToFix.length} entries...`);
  }
  
  console.log(`\n✅ Migration Complete!`);
  console.log(`   Fixed: ${processedCount} entries`);
  console.log(`   Total Revenue: $${totalRevenue.toFixed(2)}`);
  console.log(`   Total Expense: $${totalExpense.toFixed(2)}`);
  console.log(`   Total Profit: $${(totalRevenue - totalExpense).toFixed(2)}\n`);
  
  // Verify the fix
  console.log('🔍 Verifying migration...\n');
  
  const verifySnapshot = await db.collection('accountingEntries').get();
  
  let revenueEntries = 0;
  let expenseEntries = 0;
  let oldFormatEntries = 0;
  
  verifySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.accountType === 'revenue') revenueEntries++;
    else if (data.accountType === 'expense') expenseEntries++;
    else if (data.type === 'sale') oldFormatEntries++;
  });
  
  console.log('📊 Database Summary:');
  console.log(`   Revenue entries: ${revenueEntries}`);
  console.log(`   Expense entries: ${expenseEntries}`);
  console.log(`   Old format entries: ${oldFormatEntries}\n`);
  
  if (oldFormatEntries > 0) {
    console.log('⚠️  WARNING: Still found entries in old format. Re-run script.\n');
  } else {
    console.log('✅ All entries are in correct format!\n');
  }
  
  console.log('════════════════════════════════════════════════════════════');
  console.log('🎉 Production database updated successfully!');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('💡 Next steps:');
  console.log('   1. Verify Vercel deployment is live');
  console.log('   2. Login to your production app');
  console.log('   3. Go to Reports page');
  console.log('   4. ML predictions should now display correctly!\n');
}

console.log('════════════════════════════════════════════════════════════');
console.log('🚀 PRODUCTION DATABASE MIGRATION');
console.log('════════════════════════════════════════════════════════════\n');

fixProductionAccountingEntries()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error during migration:', error);
    process.exit(1);
  });
