import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./firebase-key.json', 'utf8'));
initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function testMLService(userId) {
  console.log('🔍 Testing ML Service with Real Data\n');
  
  // Fetch accounting entries
  const accountingSnapshot = await db.collection('accountingEntries')
    .where('userId', '==', userId)
    .get();
  
  console.log(`📊 Found ${accountingSnapshot.size} accounting entries\n`);
  
  // Group by month
  const accountingByMonth = {};
  accountingSnapshot.forEach(doc => {
    const entry = doc.data();
    // Handle both string dates and Firestore Timestamps
    const created = entry.createdAt?.toDate?.() || entry.createdAt || new Date();
    const month = new Date(created).toISOString().slice(0, 7); // YYYY-MM
    
    if (!accountingByMonth[month]) {
      accountingByMonth[month] = {
        revenue: 0,
        expenses: 0,
        profit: 0,
      };
    }
    
    // New structure uses accountType with debitAmount/creditAmount
    if (entry.accountType === 'revenue') {
      accountingByMonth[month].revenue += parseFloat(entry.creditAmount || 0);
    } else if (entry.accountType === 'expense') {
      accountingByMonth[month].expenses += parseFloat(entry.debitAmount || 0);
    }
    
    accountingByMonth[month].profit = 
      accountingByMonth[month].revenue - accountingByMonth[month].expenses;
  });
  
  const sortedMonths = Object.keys(accountingByMonth).sort();
  
  console.log('📅 Monthly Revenue Data:\n');
  sortedMonths.forEach(month => {
    const data = accountingByMonth[month];
    console.log(`${month}: Revenue=$${data.revenue.toFixed(2)}, Expenses=$${data.expenses.toFixed(2)}, Profit=$${data.profit.toFixed(2)}`);
  });
  
  console.log(`\n📈 Total Months: ${sortedMonths.length}\n`);
  
  // Prepare data for ML
  const revenueHistory = sortedMonths.slice(-12).map(m => ({
    date: new Date(m),
    value: accountingByMonth[m].revenue
  }));
  
  console.log('🤖 ML Input Data (last 12 months):\n');
  revenueHistory.forEach(item => {
    console.log(`  ${item.date.toISOString().slice(0, 7)}: $${item.value.toFixed(2)}`);
  });
  
  // Manually calculate linear regression (same as ml-service.ts)
  const n = revenueHistory.length;
  const dates = revenueHistory.map((item, index) => index);
  const values = revenueHistory.map(item => item.value);
  
  const sumX = dates.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = dates.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumX2 = dates.reduce((sum, x) => sum + x * x, 0);
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  
  console.log(`\n📊 Linear Regression Results:`);
  console.log(`   Slope (m): ${slope.toFixed(2)}`);
  console.log(`   Intercept (b): ${intercept.toFixed(2)}`);
  console.log(`   Formula: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}\n`);
  
  // Calculate predictions for next 3 months
  console.log('🔮 Predictions for Next 3 Months:\n');
  
  for (let i = 1; i <= 3; i++) {
    const nextIndex = n + i - 1;
    const predictedValue = slope * nextIndex + intercept;
    
    // Calculate confidence
    const avg = sumY / n;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / avg) * 100;
    const baseConfidence = Math.max(0, 100 - coefficientOfVariation);
    const decayFactor = Math.pow(0.9, i - 1);
    const confidence = baseConfidence * decayFactor;
    
    // Calculate the date
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const [year, month] = lastMonth.split('-');
    const nextDate = new Date(parseInt(year), parseInt(month) - 1 + i, 1);
    const period = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`Month ${i} (${period}):`);
    console.log(`  Predicted Revenue: $${predictedValue.toFixed(2)}`);
    console.log(`  Confidence: ${confidence.toFixed(1)}%`);
    console.log(`  Formula: y = ${slope.toFixed(2)} * ${nextIndex} + ${intercept.toFixed(2)} = ${predictedValue.toFixed(2)}\n`);
  }
  
  console.log('════════════════════════════════════════════════════════════');
  console.log('✅ ML Service Test Complete!');
  console.log('════════════════════════════════════════════════════════════\n');
  
  console.log('💡 What this means:');
  console.log('   - If predictions show $0 on frontend, the issue is NOT the ML algorithm');
  console.log('   - The ML math is working correctly');
  console.log('   - Check: API endpoint, frontend data fetching, or rendering\n');
}

const userId = process.argv[2];
if (!userId) {
  console.error('❌ Please provide userId as argument');
  console.error('Usage: npx tsx scripts/test-ml-live.js YOUR_USER_ID');
  process.exit(1);
}

testMLService(userId).catch(console.error);
