/**
 * Test ML Train/Test Split Implementation
 * Verifies the linear regression model with proper validation metrics
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "inventorymanagement-3005-b38a3.appspot.com"
});

const db = admin.firestore();
const USER_ID = 'EFCG0Cy1Z1egAfOFd7VpHvprr242';

// ============= ML FUNCTIONS (same as ml-service.ts) =============

function linearRegression(data) {
  if (data.length < 2) {
    return { slope: 0, intercept: 0 };
  }

  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

  data.forEach((point, index) => {
    const x = index;
    const y = point.value;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

function standardDeviation(values) {
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
  return Math.sqrt(avgSquareDiff);
}

function calculateRSquared(actual, predicted) {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  
  const mean = actual.reduce((a, b) => a + b, 0) / actual.length;
  const ssTot = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const ssRes = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  
  if (ssTot === 0) return 1;
  return Math.max(0, 1 - (ssRes / ssTot));
}

function calculateMAE(actual, predicted) {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  const sum = actual.reduce((acc, val, i) => acc + Math.abs(val - predicted[i]), 0);
  return sum / actual.length;
}

function calculateMAPE(actual, predicted) {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  const sum = actual.reduce((acc, val, i) => {
    if (val === 0) return acc;
    return acc + Math.abs((val - predicted[i]) / val);
  }, 0);
  return (sum / actual.length) * 100;
}

async function testMLSplit() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           ML TRAIN/TEST SPLIT VALIDATION TEST                    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // 1. Get actual data from Firestore
  console.log('1. FETCHING DATA FROM FIRESTORE');
  console.log('─'.repeat(60));
  
  const ordersSnapshot = await db.collection('orders')
    .where('sellerId', '==', USER_ID)
    .get();
  
  // Aggregate by month
  const revenueByMonth = {};
  ordersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'completed' || data.status === 'paid') {
      const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + parseFloat(data.totalAmount || 0);
    }
  });
  
  const sortedMonths = Object.keys(revenueByMonth).sort();
  console.log(`   Total orders: ${ordersSnapshot.size}`);
  console.log(`   Months with data: ${sortedMonths.length}`);
  console.log('');
  
  sortedMonths.forEach(month => {
    console.log(`   ${month}: $${revenueByMonth[month].toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  });
  
  // 2. Prepare historical data
  console.log('\n\n2. TRAIN/TEST SPLIT');
  console.log('─'.repeat(60));
  
  const historicalData = sortedMonths.map((m, index) => ({
    date: new Date(m),
    value: revenueByMonth[m],
    month: m
  }));
  
  const n = historicalData.length;
  
  // For 3 data points: 67% train (2 months), 33% test (1 month)
  let trainSize = Math.max(2, n - 1);
  let testSize = n - trainSize;
  
  if (n === 3) {
    trainSize = 2;
    testSize = 1;
  }
  
  const trainData = historicalData.slice(0, trainSize);
  const testData = historicalData.slice(trainSize);
  
  console.log(`\n   Dataset Split:`);
  console.log(`   ├─ Total data points: ${n} months`);
  console.log(`   ├─ Training set: ${trainSize} months (${Math.round((trainSize/n)*100)}%)`);
  console.log(`   └─ Testing set: ${testSize} months (${Math.round((testSize/n)*100)}%)`);
  
  console.log(`\n   Training Data (Oct-Nov 2019):`);
  trainData.forEach(d => {
    console.log(`   ├─ ${d.month}: $${d.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  });
  
  console.log(`\n   Testing Data (Dec 2019):`);
  testData.forEach(d => {
    console.log(`   └─ ${d.month}: $${d.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  });
  
  // 3. Train model
  console.log('\n\n3. MODEL TRAINING');
  console.log('─'.repeat(60));
  
  const { slope, intercept } = linearRegression(trainData);
  
  console.log(`\n   Linear Regression Model:`);
  console.log(`   ├─ Formula: y = mx + b`);
  console.log(`   ├─ Slope (m): ${slope.toFixed(2)}`);
  console.log(`   └─ Intercept (b): ${intercept.toFixed(2)}`);
  console.log(`\n   Final equation: y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`);
  
  // 4. Validate on test set
  console.log('\n\n4. MODEL VALIDATION');
  console.log('─'.repeat(60));
  
  const testActual = testData.map(d => d.value);
  const testPredicted = testData.map((_, i) => {
    const xValue = trainSize + i;
    return Math.max(0, slope * xValue + intercept);
  });
  
  console.log(`\n   Test Set Predictions:`);
  testData.forEach((d, i) => {
    const predicted = testPredicted[i];
    const actual = testActual[i];
    const error = Math.abs(actual - predicted);
    const errorPct = (error / actual * 100).toFixed(1);
    console.log(`   ${d.month}:`);
    console.log(`     ├─ Actual:    $${actual.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`     ├─ Predicted: $${predicted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`     └─ Error:     $${error.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} (${errorPct}%)`);
  });
  
  // 5. Calculate metrics
  console.log('\n\n5. MODEL METRICS');
  console.log('─'.repeat(60));
  
  const rSquared = calculateRSquared(testActual, testPredicted);
  const mae = calculateMAE(testActual, testPredicted);
  const mape = calculateMAPE(testActual, testPredicted);
  
  const values = historicalData.map(d => d.value);
  const stdDev = standardDeviation(values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const cv = stdDev / avg;
  
  // New confidence calculation
  const rSquaredConfidence = rSquared * 100;
  const cvConfidence = Math.max(0, Math.min(100, 100 - (cv * 100)));
  const baseConfidence = (rSquaredConfidence * 0.6) + (cvConfidence * 0.4);
  
  console.log(`\n   Validation Metrics:`);
  console.log(`   ├─ R² (Coefficient of Determination): ${(rSquared * 100).toFixed(2)}%`);
  console.log(`   ├─ MAE (Mean Absolute Error): $${mae.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`   └─ MAPE (Mean Absolute % Error): ${mape.toFixed(2)}%`);
  
  console.log(`\n   Data Statistics:`);
  console.log(`   ├─ Mean Revenue: $${avg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`   ├─ Std Deviation: $${stdDev.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
  console.log(`   └─ CV (Coefficient of Variation): ${(cv * 100).toFixed(2)}%`);
  
  console.log(`\n   Confidence Calculation:`);
  console.log(`   ├─ R² Component (60%): ${rSquaredConfidence.toFixed(2)}% × 0.6 = ${(rSquaredConfidence * 0.6).toFixed(2)}%`);
  console.log(`   ├─ CV Component (40%): ${cvConfidence.toFixed(2)}% × 0.4 = ${(cvConfidence * 0.4).toFixed(2)}%`);
  console.log(`   └─ BASE CONFIDENCE: ${baseConfidence.toFixed(2)}%`);
  
  // 6. Generate predictions
  console.log('\n\n6. FUTURE PREDICTIONS (Jan-Mar 2020)');
  console.log('─'.repeat(60));
  
  // Retrain on all data for final predictions
  const { slope: finalSlope, intercept: finalIntercept } = linearRegression(historicalData);
  
  console.log(`\n   Final Model (trained on all data):`);
  console.log(`   └─ y = ${finalSlope.toFixed(2)}x + ${finalIntercept.toFixed(2)}`);
  
  console.log(`\n   Predictions:`);
  for (let i = 1; i <= 3; i++) {
    const xValue = n + i - 1;
    const predicted = Math.max(0, finalSlope * xValue + finalIntercept);
    const confidence = Math.round(baseConfidence * Math.pow(0.9, i - 1));
    
    const month = new Date(2019, 12 + i - 1, 1);
    const monthStr = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    
    console.log(`   ${monthStr}:`);
    console.log(`     ├─ x = ${xValue}`);
    console.log(`     ├─ Predicted: $${predicted.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`);
    console.log(`     └─ Confidence: ${confidence}% (${baseConfidence.toFixed(1)}% × 0.9^${i-1})`);
  }
  
  // 7. Summary
  console.log('\n\n' + '═'.repeat(60));
  console.log('                         SUMMARY');
  console.log('═'.repeat(60));
  
  console.log(`
   Dataset:
   ├─ Training: Oct-Nov 2019 (2 months, 67%)
   └─ Testing:  Dec 2019 (1 month, 33%)
   
   Model Performance:
   ├─ R²: ${(rSquared * 100).toFixed(2)}% ${rSquared > 0.7 ? '✓ Good' : rSquared > 0.5 ? '⚠ Moderate' : '✗ Poor'}
   ├─ MAPE: ${mape.toFixed(2)}% ${mape < 20 ? '✓ Good' : mape < 50 ? '⚠ Moderate' : '✗ Poor'}
   └─ Confidence: ${baseConfidence.toFixed(2)}%
   
   Predictions:
   ├─ 2020-01: $${Math.max(0, finalSlope * n + finalIntercept).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
   ├─ 2020-02: $${Math.max(0, finalSlope * (n+1) + finalIntercept).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
   └─ 2020-03: $${Math.max(0, finalSlope * (n+2) + finalIntercept).toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
  `);
  
  console.log('═'.repeat(60) + '\n');
  
  process.exit(0);
}

testMLSplit().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
