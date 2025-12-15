// Debug script to check ML data in Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "inventorymanagement-3005-b38a3.appspot.com"
});

const db = admin.firestore();
const USER_ID = 'EFCG0Cy1Z1egAfOFd7VpHvprr242';

async function debugMLData() {
  console.log('=== DEBUG ML DATA FOR USER ===\n');
  
  // 1. Check accounting entries
  console.log('1. ACCOUNTING ENTRIES:');
  const accountingRef = db.collection('accountingEntries')
    .where('userId', '==', USER_ID);
  const accountingSnapshot = await accountingRef.get();
  
  console.log(`   Total entries: ${accountingSnapshot.size}`);
  
  // Group by month
  const entriesByMonth = {};
  accountingSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!entriesByMonth[monthKey]) {
      entriesByMonth[monthKey] = { count: 0, revenue: 0, expenses: 0 };
    }
    entriesByMonth[monthKey].count++;
    
    if (data.accountType === 'revenue') {
      entriesByMonth[monthKey].revenue += parseFloat(data.creditAmount || 0);
    } else if (data.accountType === 'expense') {
      entriesByMonth[monthKey].expenses += parseFloat(data.debitAmount || 0);
    }
  });
  
  console.log('   Entries by month:');
  const sortedMonths = Object.keys(entriesByMonth).sort();
  sortedMonths.forEach(month => {
    const data = entriesByMonth[month];
    console.log(`     ${month}: ${data.count} entries, Revenue: $${data.revenue.toFixed(2)}, Expenses: $${data.expenses.toFixed(2)}`);
  });
  
  // 2. Check orders
  console.log('\n2. ORDERS:');
  const ordersRef = db.collection('orders')
    .where('sellerId', '==', USER_ID);
  const ordersSnapshot = await ordersRef.get();
  
  console.log(`   Total orders: ${ordersSnapshot.size}`);
  
  const ordersByMonth = {};
  ordersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
    const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
    
    if (!ordersByMonth[monthKey]) {
      ordersByMonth[monthKey] = { count: 0, revenue: 0 };
    }
    ordersByMonth[monthKey].count++;
    
    if (data.status === 'completed' || data.status === 'paid') {
      ordersByMonth[monthKey].revenue += parseFloat(data.totalAmount || 0);
    }
  });
  
  console.log('   Orders by month:');
  const sortedOrderMonths = Object.keys(ordersByMonth).sort();
  sortedOrderMonths.forEach(month => {
    const data = ordersByMonth[month];
    console.log(`     ${month}: ${data.count} orders, Revenue: $${data.revenue.toFixed(2)}`);
  });
  
  // 3. Simulate ML calculation
  console.log('\n3. ML SIMULATION:');
  
  // Combined revenue by month (like the backend does)
  const revenueByMonth = {};
  sortedMonths.forEach(month => {
    revenueByMonth[month] = entriesByMonth[month].revenue;
  });
  sortedOrderMonths.forEach(month => {
    revenueByMonth[month] = (revenueByMonth[month] || 0) + ordersByMonth[month].revenue;
  });
  
  const allMonths = Object.keys(revenueByMonth).sort();
  console.log('   Combined revenue by month:');
  allMonths.forEach(month => {
    console.log(`     ${month}: $${revenueByMonth[month].toFixed(2)}`);
  });
  
  // Calculate ML metrics
  const values = allMonths.map(m => revenueByMonth[m]);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  const stdDev = Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  const cv = stdDev / avg;
  const confidence = Math.max(0, Math.min(100, 100 - (cv * 100)));
  
  console.log(`\n   ML Statistics:`);
  console.log(`     Data points: ${values.length}`);
  console.log(`     Average revenue: $${avg.toFixed(2)}`);
  console.log(`     Std Deviation: $${stdDev.toFixed(2)}`);
  console.log(`     Coefficient of Variation: ${cv.toFixed(4)}`);
  console.log(`     BASE CONFIDENCE: ${confidence.toFixed(2)}%`);
  
  // Linear regression
  if (values.length >= 2) {
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    values.forEach((y, x) => {
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    });
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    console.log(`     Slope: ${slope.toFixed(4)}`);
    console.log(`     Intercept: ${intercept.toFixed(4)}`);
    
    // Predictions for next 3 months
    console.log(`\n   Predictions:`);
    for (let i = 1; i <= 3; i++) {
      const nextIndex = n + i - 1;
      const predictedValue = Math.max(0, slope * nextIndex + intercept);
      const forecastConfidence = Math.round(confidence * Math.pow(0.9, i - 1));
      
      // Calculate next month date
      const lastMonth = allMonths[allMonths.length - 1];
      const [year, month] = lastMonth.split('-');
      const nextDate = new Date(parseInt(year), parseInt(month) - 1 + i, 1);
      const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
      
      console.log(`     ${nextPeriod}: $${predictedValue.toFixed(2)} (${forecastConfidence}% confidence)`);
    }
  }
  
  console.log('\n=== DEBUG COMPLETE ===');
  process.exit(0);
}

debugMLData().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
