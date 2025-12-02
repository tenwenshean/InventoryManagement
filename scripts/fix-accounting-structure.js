import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixAccountingEntries(userId) {
  console.log('🔧 Fixing Accounting Entries Structure\n');
  
  // Get all Kaggle accounting entries
  const snapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  console.log(`📊 Found ${snapshot.size} entries to fix\n`);
  
  const batch = db.batch();
  let count = 0;
  let revenueEntries = 0;
  let expenseEntries = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    
    // Check if this is a Kaggle entry with old structure
    if (data.type === 'sale' && data.revenue !== undefined && data.expense !== undefined) {
      // Create TWO separate entries: one for revenue, one for expense
      
      // 1. Revenue entry
      const revenueEntry = {
        userId: data.userId,
        accountType: 'revenue',
        accountName: 'Sales Revenue',
        debitAmount: 0,
        creditAmount: data.revenue,
        description: data.description || 'Product sales',
        createdAt: data.date || data.createdAt,
      };
      
      // 2. Expense entry (COGS)
      const expenseEntry = {
        userId: data.userId,
        accountType: 'expense',
        accountName: 'Cost of Goods Sold',
        debitAmount: data.expense,
        creditAmount: 0,
        description: `COGS - ${data.description || 'Product sales'}`,
        createdAt: data.date || data.createdAt,
      };
      
      // Delete old entry and add new ones
      batch.delete(doc.ref);
      batch.set(db.collection('accountingEntries').doc(), revenueEntry);
      batch.set(db.collection('accountingEntries').doc(), expenseEntry);
      
      count++;
      revenueEntries++;
      expenseEntries++;
      
      if (count % 20 === 0) {
        console.log(`   ✓ Fixed ${count} entries...`);
      }
    }
  }
  
  if (count > 0) {
    await batch.commit();
    console.log(`\n✅ Fixed ${count} entries`);
    console.log(`   Created ${revenueEntries} revenue entries`);
    console.log(`   Created ${expenseEntries} expense entries`);
  } else {
    console.log('✅ No entries need fixing\n');
  }
  
  // Verify the fix
  console.log('\n🔍 Verifying fix...\n');
  
  const verifySnapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  const byMonth = {};
  
  verifySnapshot.forEach(doc => {
    const entry = doc.data();
    const date = entry.createdAt?.toDate?.() || new Date(entry.createdAt);
    const month = date.toISOString().slice(0, 7);
    
    if (!byMonth[month]) {
      byMonth[month] = { revenue: 0, expenses: 0 };
    }
    
    if (entry.accountType === 'revenue') {
      byMonth[month].revenue += parseFloat(entry.creditAmount || 0);
    } else if (entry.accountType === 'expense') {
      byMonth[month].expenses += parseFloat(entry.debitAmount || 0);
    }
  });
  
  const sortedMonths = Object.keys(byMonth).sort();
  console.log('📅 Monthly Revenue After Fix:\n');
  
  sortedMonths.forEach(month => {
    const data = byMonth[month];
    const profit = data.revenue - data.expenses;
    console.log(`${month}: Revenue=$${data.revenue.toFixed(2)}, Expenses=$${data.expenses.toFixed(2)}, Profit=$${profit.toFixed(2)}`);
  });
  
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✅ Fix Complete!');
  console.log('════════════════════════════════════════════════════════════\n');
  console.log('💡 Next steps:');
  console.log('   1. Hard refresh your browser (Ctrl+Shift+R)');
  console.log('   2. Go to Reports page');
  console.log('   3. ML predictions should now show correctly!\n');
}

const userId = process.argv[2];
if (!userId) {
  console.error('❌ Please provide userId as argument');
  console.error('Usage: npx tsx scripts/fix-accounting-structure.js YOUR_USER_ID');
  process.exit(1);
}

fixAccountingEntries(userId).catch(console.error);
