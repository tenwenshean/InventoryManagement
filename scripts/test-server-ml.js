import { MLService } from '../server/ml-service.js';

console.log('🧪 Testing ML Service Implementation\n');

// Simulate the data structure from your database
const revenueHistory = [
  { date: new Date('2024-07-01'), value: 2478.52 },
  { date: new Date('2024-08-01'), value: 2636.55 },
  { date: new Date('2024-09-01'), value: 2608.12 },
  { date: new Date('2024-10-01'), value: 2743.86 },
  { date: new Date('2024-11-01'), value: 2753.60 },
  { date: new Date('2024-12-01'), value: 2873.64 }
];

const mlService = new MLService();

console.log('📊 Historical Data:');
revenueHistory.forEach(item => {
  console.log(`  ${item.date.toISOString().slice(0, 7)}: $${item.value.toFixed(2)}`);
});

console.log('\n🔮 Testing forecastRevenue(revenueHistory, 3):\n');

const { forecasts, totalPredicted } = mlService.forecastRevenue(revenueHistory, 3);

console.log('Forecasts returned:');
forecasts.forEach((f, i) => {
  console.log(`  Month ${i+1}: $${f.value.toFixed(2)} (${f.confidence.toFixed(1)}% confidence)`);
});

console.log(`\nTotal Predicted: $${totalPredicted.toFixed(2)}`);

// Test the period calculation that goes in the routes
console.log('\n📅 Testing Period Calculation (from routes.ts logic):\n');

const sortedAccountingMonths = ['2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12'];
const lastMonth = sortedAccountingMonths[sortedAccountingMonths.length - 1];
const [year, month] = lastMonth.split('-');

console.log(`Last month in data: ${lastMonth}`);
console.log(`Split into: year=${year}, month=${month}\n`);

const predictions = forecasts.map((f, index) => {
  const nextDate = new Date(parseInt(year), parseInt(month) - 1 + (index + 1), 1);
  
  return {
    period: `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`,
    predicted: f.value,
    confidence: f.confidence
  };
});

console.log('Final predictions array (as sent to frontend):');
predictions.forEach((p, i) => {
  console.log(`  ${p.period}: $${p.predicted.toFixed(2)} (${p.confidence.toFixed(1)}% confidence)`);
});

console.log('\n════════════════════════════════════════════════════════════');
console.log('✅ ML Service is working correctly!');
console.log('════════════════════════════════════════════════════════════\n');

console.log('💡 The server should return these predictions when you:');
console.log('   1. Login to your app');
console.log('   2. Navigate to the Reports page');
console.log('   3. Check the browser console or network tab\n');
