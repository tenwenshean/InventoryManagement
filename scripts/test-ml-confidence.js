/**
 * ML Confidence Level Analysis
 * Shows how confidence changes based on:
 * - Number of data points (sales history)
 * - Data consistency (variability)
 * - Prediction distance (months ahead)
 */

import { mlService } from '../server/ml-service.ts';

console.log('🎯 ML Prediction Confidence Analysis\n');
console.log('='.repeat(80));

// TEST 1: Impact of Data Points (Sample Size)
console.log('\n📊 TEST 1: How Many Sales Data Points Do You Need?');
console.log('-'.repeat(80));

const testDataSizes = [2, 3, 6, 12, 24];
const consistentValue = 50000;

console.log('\nScenario: Consistent $50,000/month revenue\n');
console.log('Data Points | Confidence (1-mo) | Confidence (3-mo) | Confidence (6-mo) | Recommendation');
console.log('-'.repeat(90));

testDataSizes.forEach(size => {
  const data = Array.from({ length: size }, (_, i) => ({
    date: new Date(2024, i, 1),
    value: consistentValue
  }));
  
  const forecast1 = mlService.forecastRevenue(data, 1);
  const forecast3 = mlService.forecastRevenue(data, 3);
  const forecast6 = mlService.forecastRevenue(data, 6);
  
  const conf1 = forecast1.forecasts[0].confidence;
  const conf3 = forecast3.forecasts[2].confidence; // 3rd month
  const conf6 = forecast6.forecasts[5].confidence; // 6th month
  
  let recommendation = '';
  if (size < 3) recommendation = '❌ Too few - unreliable';
  else if (size < 6) recommendation = '⚠️ Minimum for basic trends';
  else if (size < 12) recommendation = '✅ Good for short-term';
  else recommendation = '✅ Excellent - reliable';
  
  console.log(`${size.toString().padStart(11)} | ${conf1.toString().padStart(17)}% | ${conf3.toString().padStart(17)}% | ${conf6.toString().padStart(17)}% | ${recommendation}`);
});

console.log('\n💡 Key Insight: More data points = higher confidence');

// TEST 2: Impact of Data Variability
console.log('\n\n📈 TEST 2: How Does Sales Consistency Affect Confidence?');
console.log('-'.repeat(80));

const variabilityScenarios = [
  { name: 'Perfect Stability', values: Array(12).fill(50000), description: 'Same every month' },
  { name: 'Low Variability', values: [49000, 50000, 51000, 50000, 49500, 50500, 50000, 49800, 50200, 50000, 49900, 50100], description: '±2% variation' },
  { name: 'Moderate Variability', values: [50000, 47000, 53000, 49000, 51000, 48000, 52000, 50000, 48500, 51500, 49500, 50500], description: '±6% variation' },
  { name: 'High Variability', values: [50000, 35000, 65000, 40000, 60000, 38000, 62000, 45000, 55000, 42000, 58000, 48000], description: '±30% swings' },
  { name: 'Seasonal Pattern', values: [40000, 38000, 42000, 45000, 48000, 50000, 48000, 52000, 58000, 65000, 78000, 95000], description: 'Holiday peak' },
];

console.log('\nAll scenarios use 12 months of data:\n');
console.log('Pattern              | Avg Revenue | Std Dev  | CV    | 1-mo Conf | 3-mo Conf | Analysis');
console.log('-'.repeat(95));

variabilityScenarios.forEach(scenario => {
  const data = scenario.values.map((value, i) => ({
    date: new Date(2024, i, 1),
    value
  }));
  
  const avg = scenario.values.reduce((a, b) => a + b, 0) / scenario.values.length;
  const stdDev = Math.sqrt(
    scenario.values.map(v => Math.pow(v - avg, 2)).reduce((a, b) => a + b, 0) / scenario.values.length
  );
  const cv = (stdDev / avg * 100).toFixed(1);
  
  const forecast1 = mlService.forecastRevenue(data, 1);
  const forecast3 = mlService.forecastRevenue(data, 3);
  
  const conf1 = forecast1.forecasts[0].confidence;
  const conf3 = forecast3.forecasts[2].confidence;
  
  let analysis = '';
  if (cv < 5) analysis = '✅ Excellent';
  else if (cv < 15) analysis = '✅ Good';
  else if (cv < 30) analysis = '⚠️ Fair';
  else analysis = '❌ Poor';
  
  console.log(
    `${scenario.name.padEnd(20)} | $${Math.round(avg).toLocaleString().padStart(10)} | $${Math.round(stdDev).toLocaleString().padStart(7)} | ${cv.padStart(5)}% | ${conf1.toString().padStart(9)}% | ${conf3.toString().padStart(9)}% | ${analysis}`
  );
});

console.log('\n💡 Key Insight: Lower variability (CV) = higher confidence');
console.log('   CV = Coefficient of Variation (Standard Deviation / Average)');

// TEST 3: Prediction Distance Impact
console.log('\n\n📅 TEST 3: How Far Ahead Can You Predict?');
console.log('-'.repeat(80));

const baseData = Array.from({ length: 12 }, (_, i) => ({
  date: new Date(2024, i, 1),
  value: 50000 + (i * 1000) // Growing $1000/month
}));

console.log('\nUsing 12 months of stable growth data:\n');
console.log('Months Ahead | Predicted Value | Confidence | Reliability');
console.log('-'.repeat(65));

[1, 2, 3, 4, 5, 6, 9, 12].forEach(months => {
  const forecast = mlService.forecastRevenue(baseData, months);
  const lastForecast = forecast.forecasts[forecast.forecasts.length - 1];
  
  let reliability = '';
  if (lastForecast.confidence >= 80) reliability = '✅ Highly Reliable';
  else if (lastForecast.confidence >= 60) reliability = '✅ Reliable';
  else if (lastForecast.confidence >= 40) reliability = '⚠️ Moderate';
  else if (lastForecast.confidence >= 20) reliability = '⚠️ Use with Caution';
  else reliability = '❌ Unreliable';
  
  console.log(
    `${months.toString().padStart(12)} | $${Math.round(lastForecast.value).toLocaleString().padStart(14)} | ${lastForecast.confidence.toString().padStart(10)}% | ${reliability}`
  );
});

console.log('\n💡 Key Insight: Confidence decays ~10% per month into the future');

// TEST 4: Real-World Recommendations
console.log('\n\n🎯 TEST 4: Real-World Business Scenarios');
console.log('-'.repeat(80));

const scenarios = [
  {
    name: 'New Business (2 months)',
    data: [45000, 52000],
    months: 3,
    context: 'Just started tracking'
  },
  {
    name: 'Startup (6 months)',
    data: [10000, 15000, 22000, 28000, 35000, 42000],
    months: 3,
    context: 'Growing rapidly'
  },
  {
    name: 'Established (12 months)',
    data: [48000, 47000, 51000, 50000, 49000, 52000, 50500, 49500, 51500, 50000, 48500, 51000],
    months: 6,
    context: 'Stable business'
  },
  {
    name: 'Mature (24 months)',
    data: Array.from({ length: 24 }, (_, i) => 50000 + (i * 500) + (Math.random() * 2000 - 1000)),
    months: 12,
    context: 'Long history'
  }
];

console.log('\n');
scenarios.forEach(scenario => {
  const data = scenario.data.map((value, i) => ({
    date: new Date(2024, i, 1),
    value
  }));
  
  const forecast = mlService.forecastRevenue(data, scenario.months);
  const avgConf = forecast.forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecast.forecasts.length;
  
  console.log(`${scenario.name}`);
  console.log(`  Context: ${scenario.context}`);
  console.log(`  Data Points: ${scenario.data.length} months`);
  console.log(`  Forecasting: ${scenario.months} months ahead`);
  console.log(`  Average Confidence: ${Math.round(avgConf)}%`);
  
  if (avgConf >= 70) {
    console.log(`  ✅ Recommendation: Reliable for planning and budgeting`);
  } else if (avgConf >= 50) {
    console.log(`  ⚠️ Recommendation: Use for general trends, verify with other data`);
  } else {
    console.log(`  ❌ Recommendation: Collect more data before relying on predictions`);
  }
  console.log('');
});

// SUMMARY
console.log('\n' + '='.repeat(80));
console.log('📋 CONFIDENCE REQUIREMENTS SUMMARY');
console.log('='.repeat(80));

console.log('\n🎯 Minimum Data Requirements:\n');
console.log('  Purpose                    | Min Months | Recommended | Confidence Expected');
console.log('  ' + '-'.repeat(75));
console.log('  Basic trend detection      |     3      |      6      | 50-70%');
console.log('  Short-term planning (1-3m) |     6      |     12      | 70-85%');
console.log('  Medium-term planning (6m)  |    12      |     18      | 60-75%');
console.log('  Long-term planning (12m)   |    18      |     24      | 50-65%');
console.log('  Inventory reorder points   |     6      |     12      | 70-80%');
console.log('  Budget forecasting         |    12      |     24      | 65-80%');

console.log('\n📊 Data Quality Impact:\n');
console.log('  Quality         | Coefficient of Variation | Expected Confidence');
console.log('  ' + '-'.repeat(65));
console.log('  Excellent       | CV < 5%                  | 85-95%');
console.log('  Good            | CV 5-15%                 | 70-85%');
console.log('  Fair            | CV 15-30%                | 50-70%');
console.log('  Poor            | CV > 30%                 | 30-50%');

console.log('\n💡 Pro Tips:\n');
console.log('  1. Start with at least 6 months of data for reliable predictions');
console.log('  2. More consistent sales = higher confidence (aim for CV < 15%)');
console.log('  3. Predictions 1-3 months ahead are most accurate');
console.log('  4. Confidence drops ~10% for each month further into the future');
console.log('  5. For seasonal business, collect data for full year cycles');
console.log('  6. Update predictions monthly as new data comes in');

console.log('\n🎓 Confidence Level Guide:\n');
console.log('  90-100%: Exceptional - Rare, only with perfect data');
console.log('  80-90%:  Excellent   - Very reliable for decision making');
console.log('  70-80%:  Good        - Suitable for planning and budgeting');
console.log('  60-70%:  Fair        - Use for trends, cross-check with other data');
console.log('  50-60%:  Moderate    - General direction only, high uncertainty');
console.log('  <50%:    Poor        - Collect more data before relying on predictions');

console.log('\n' + '='.repeat(80));
console.log('✅ Analysis Complete!');
console.log('='.repeat(80));
