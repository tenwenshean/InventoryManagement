/**
 * Performance Parameter Testing for Inventory Management Application
 * 
 * Firebase Free Tier (Spark) Limits:
 * - 50,000 reads/day
 * - 20,000 writes/day
 * - 20,000 deletes/day
 * 
 * Testing limits (50% of quota):
 * - 25,000 reads max
 * - 10,000 writes max
 * - 10,000 deletes max
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('../firebase-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "inventorymanagement-3005-b38a3.appspot.com"
});

const db = admin.firestore();

// ========== QUOTA CONFIGURATION ==========
const QUOTA_LIMITS = {
  reads: {
    daily: 50000,
    testLimit: 25000,  // 50% of daily
    testBudget: 5000   // For this test run
  },
  writes: {
    daily: 20000,
    testLimit: 10000,  // 50% of daily
    testBudget: 500    // For this test run
  },
  deletes: {
    daily: 20000,
    testLimit: 10000,  // 50% of daily
    testBudget: 100    // For this test run
  }
};

// ========== OPERATION COUNTERS ==========
const operationCounts = {
  reads: 0,
  writes: 0,
  deletes: 0
};

// ========== PERFORMANCE METRICS ==========
const performanceMetrics = {
  operations: [],
  summary: {}
};

// ========== UTILITY FUNCTIONS ==========

function checkQuota(operationType, count = 1) {
  const newCount = operationCounts[operationType] + count;
  if (newCount > QUOTA_LIMITS[operationType].testBudget) {
    throw new Error(`QUOTA EXCEEDED: ${operationType} would be ${newCount} > ${QUOTA_LIMITS[operationType].testBudget}`);
  }
  return true;
}

function trackOperation(operationType, count = 1) {
  operationCounts[operationType] += count;
}

async function measureOperation(name, operation, operationType = 'reads', opCount = 1) {
  checkQuota(operationType, opCount);
  
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;
  
  try {
    const result = await operation();
    const endTime = Date.now();
    const endMemory = process.memoryUsage().heapUsed;
    
    trackOperation(operationType, opCount);
    
    const metric = {
      name,
      operationType,
      operationCount: opCount,
      duration: endTime - startTime,
      memoryDelta: (endMemory - startMemory) / 1024 / 1024, // MB
      success: true,
      timestamp: new Date().toISOString()
    };
    
    performanceMetrics.operations.push(metric);
    return { result, metric };
    
  } catch (error) {
    const metric = {
      name,
      operationType,
      operationCount: opCount,
      duration: Date.now() - startTime,
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    
    performanceMetrics.operations.push(metric);
    throw error;
  }
}

// ========== TEST CASES ==========

const USER_ID = 'EFCG0Cy1Z1egAfOFd7VpHvprr242';

async function testGetProducts() {
  console.log('\n📦 Testing: Get Products');
  
  const { result, metric } = await measureOperation(
    'getProducts',
    async () => {
      const snapshot = await db.collection('products')
        .where('userId', '==', USER_ID)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Retrieved ${result.length} products in ${metric.duration}ms`);
  return result;
}

async function testGetCategories() {
  console.log('\n📁 Testing: Get Categories');
  
  const { result, metric } = await measureOperation(
    'getCategories',
    async () => {
      const snapshot = await db.collection('categories')
        .where('userId', '==', USER_ID)
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Retrieved ${result.length} categories in ${metric.duration}ms`);
  return result;
}

async function testGetOrders() {
  console.log('\n🛒 Testing: Get Orders (sampled)');
  
  const { result, metric } = await measureOperation(
    'getOrders',
    async () => {
      const snapshot = await db.collection('orders')
        .where('sellerId', '==', USER_ID)
        .limit(100)  // Sample only
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Retrieved ${result.length} orders (sampled) in ${metric.duration}ms`);
  return result;
}

async function testGetAccountingEntries() {
  console.log('\n📊 Testing: Get Accounting Entries (sampled)');
  
  const { result, metric } = await measureOperation(
    'getAccountingEntries',
    async () => {
      const snapshot = await db.collection('accountingEntries')
        .where('userId', '==', USER_ID)
        .limit(100)  // Sample only
        .get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Retrieved ${result.length} entries (sampled) in ${metric.duration}ms`);
  return result;
}

async function testCreateAndDeleteProduct() {
  console.log('\n🔄 Testing: Create and Delete Product');
  
  // Create
  const { result: createdProduct, metric: createMetric } = await measureOperation(
    'createProduct',
    async () => {
      const ref = db.collection('products').doc();
      const product = {
        id: ref.id,
        name: 'TEST_PERF_PRODUCT_' + Date.now(),
        sku: 'TEST-PERF-' + Date.now(),
        price: 99.99,
        quantity: 10,
        userId: USER_ID,
        createdAt: new Date(),
        isTestData: true
      };
      await ref.set(product);
      return product;
    },
    'writes',
    1
  );
  
  console.log(`   ✓ Created product in ${createMetric.duration}ms`);
  
  // Delete
  const { metric: deleteMetric } = await measureOperation(
    'deleteProduct',
    async () => {
      await db.collection('products').doc(createdProduct.id).delete();
      return true;
    },
    'deletes',
    1
  );
  
  console.log(`   ✓ Deleted product in ${deleteMetric.duration}ms`);
}

async function testBatchRead() {
  console.log('\n📚 Testing: Batch Read (simulating reports page)');
  
  const { result, metric } = await measureOperation(
    'batchRead_reports',
    async () => {
      // Simulate what the reports page does
      const [products, categories, orders, accounting] = await Promise.all([
        db.collection('products').where('userId', '==', USER_ID).get(),
        db.collection('categories').where('userId', '==', USER_ID).get(),
        db.collection('orders').where('sellerId', '==', USER_ID).limit(500).get(),
        db.collection('accountingEntries').where('userId', '==', USER_ID).limit(500).get()
      ]);
      
      return {
        products: products.size,
        categories: categories.size,
        orders: orders.size,
        accounting: accounting.size
      };
    },
    'reads',
    4  // 4 parallel queries
  );
  
  console.log(`   ✓ Batch read completed in ${metric.duration}ms`);
  console.log(`     Products: ${result.products}, Categories: ${result.categories}`);
  console.log(`     Orders: ${result.orders}, Accounting: ${result.accounting}`);
  return result;
}

async function testDashboardStats() {
  console.log('\n📈 Testing: Dashboard Stats Query');
  
  const { result, metric } = await measureOperation(
    'dashboardStats',
    async () => {
      const snapshot = await db.collection('products')
        .where('userId', '==', USER_ID)
        .get();
      
      const products = snapshot.docs.map(doc => doc.data());
      const totalProducts = products.length;
      const lowStockItems = products.filter(p => 
        (parseInt(p.quantity) || 0) <= (parseInt(p.minStockLevel) || 0) && (parseInt(p.minStockLevel) || 0) > 0
      ).length;
      const totalValue = products.reduce((sum, p) => {
        const price = parseFloat(p.price) || 0;
        const quantity = parseInt(p.quantity) || 0;
        return sum + (price * quantity);
      }, 0);
      
      return { totalProducts, lowStockItems, totalValue };
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Dashboard stats in ${metric.duration}ms`);
  console.log(`     Products: ${result.totalProducts}, Low Stock: ${result.lowStockItems}`);
  console.log(`     Total Value: $${result.totalValue.toFixed(2)}`);
  return result;
}

async function testSearchProducts() {
  console.log('\n🔍 Testing: Product Search');
  
  const { result, metric } = await measureOperation(
    'searchProducts',
    async () => {
      const snapshot = await db.collection('products')
        .where('userId', '==', USER_ID)
        .get();
      
      // Client-side search (as Firestore doesn't support full-text search natively)
      const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const searchTerm = 'iPhone'.toLowerCase();
      return products.filter(p => 
        (p.name || '').toLowerCase().includes(searchTerm) ||
        (p.sku || '').toLowerCase().includes(searchTerm)
      );
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Search completed in ${metric.duration}ms, found ${result.length} matching products`);
  return result;
}

async function testConcurrentReads() {
  console.log('\n⚡ Testing: Concurrent Read Stress Test (10 parallel reads)');
  
  const startTime = Date.now();
  
  // Check if we have budget for 10 reads
  checkQuota('reads', 10);
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      db.collection('products')
        .where('userId', '==', USER_ID)
        .limit(10)
        .get()
    );
  }
  
  const results = await Promise.all(promises);
  const endTime = Date.now();
  
  trackOperation('reads', 10);
  
  performanceMetrics.operations.push({
    name: 'concurrentReads_10x',
    operationType: 'reads',
    operationCount: 10,
    duration: endTime - startTime,
    success: true,
    timestamp: new Date().toISOString()
  });
  
  console.log(`   ✓ 10 concurrent reads completed in ${endTime - startTime}ms`);
  console.log(`     Average per read: ${((endTime - startTime) / 10).toFixed(2)}ms`);
}

async function testOrderCounts() {
  console.log('\n📋 Testing: Order Count by Status');
  
  const { result, metric } = await measureOperation(
    'orderCountByStatus',
    async () => {
      const snapshot = await db.collection('orders')
        .where('sellerId', '==', USER_ID)
        .get();
      
      const statusCounts = {};
      snapshot.docs.forEach(doc => {
        const status = doc.data().status || 'unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      return { total: snapshot.size, byStatus: statusCounts };
    },
    'reads',
    1
  );
  
  console.log(`   ✓ Order counts in ${metric.duration}ms`);
  console.log(`     Total: ${result.total}`);
  Object.entries(result.byStatus).forEach(([status, count]) => {
    console.log(`     ${status}: ${count}`);
  });
  return result;
}

async function testMLDataRetrieval() {
  console.log('\n🤖 Testing: ML Data Retrieval (for predictions)');
  
  const { result, metric } = await measureOperation(
    'mlDataRetrieval',
    async () => {
      const accountingSnapshot = await db.collection('accountingEntries')
        .where('userId', '==', USER_ID)
        .get();
      
      const ordersSnapshot = await db.collection('orders')
        .where('sellerId', '==', USER_ID)
        .get();
      
      // Aggregate by month
      const monthlyData = {};
      
      ordersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'completed' || data.status === 'paid') {
          const date = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseFloat(data.totalAmount || 0);
        }
      });
      
      return {
        accountingEntries: accountingSnapshot.size,
        orders: ordersSnapshot.size,
        monthlyDataPoints: Object.keys(monthlyData).length,
        monthlyData
      };
    },
    'reads',
    2  // 2 queries
  );
  
  console.log(`   ✓ ML data retrieval in ${metric.duration}ms`);
  console.log(`     Accounting entries: ${result.accountingEntries}`);
  console.log(`     Orders: ${result.orders}`);
  console.log(`     Monthly data points: ${result.monthlyDataPoints}`);
  return result;
}

// ========== GENERATE REPORT ==========

function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('                    PERFORMANCE TEST REPORT');
  console.log('='.repeat(70));
  
  // Operation Summary
  console.log('\n📊 QUOTA USAGE SUMMARY:');
  console.log('-'.repeat(50));
  
  Object.entries(operationCounts).forEach(([type, count]) => {
    const limit = QUOTA_LIMITS[type];
    const percentOfTest = ((count / limit.testBudget) * 100).toFixed(1);
    const percentOfDaily = ((count / limit.testLimit) * 100).toFixed(2);
    const percentOfTotal = ((count / limit.daily) * 100).toFixed(2);
    
    console.log(`\n  ${type.toUpperCase()}:`);
    console.log(`    Used in test:     ${count.toLocaleString()} / ${limit.testBudget.toLocaleString()} (${percentOfTest}% of test budget)`);
    console.log(`    Of safe limit:    ${count.toLocaleString()} / ${limit.testLimit.toLocaleString()} (${percentOfDaily}% of 50% quota)`);
    console.log(`    Of daily quota:   ${count.toLocaleString()} / ${limit.daily.toLocaleString()} (${percentOfTotal}% of total)`);
  });
  
  // Performance Metrics
  console.log('\n\n⚡ PERFORMANCE METRICS:');
  console.log('-'.repeat(50));
  
  const successfulOps = performanceMetrics.operations.filter(op => op.success);
  const failedOps = performanceMetrics.operations.filter(op => !op.success);
  
  console.log(`\n  Total Operations: ${performanceMetrics.operations.length}`);
  console.log(`  Successful: ${successfulOps.length}`);
  console.log(`  Failed: ${failedOps.length}`);
  
  if (successfulOps.length > 0) {
    const durations = successfulOps.map(op => op.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    
    console.log(`\n  Response Times:`);
    console.log(`    Average: ${avgDuration.toFixed(2)}ms`);
    console.log(`    Min: ${minDuration}ms`);
    console.log(`    Max: ${maxDuration}ms`);
  }
  
  // Detailed Operations
  console.log('\n\n📋 DETAILED OPERATIONS:');
  console.log('-'.repeat(70));
  console.log(`${'Operation'.padEnd(30)} ${'Type'.padEnd(10)} ${'Count'.padEnd(8)} ${'Time'.padEnd(10)} Status`);
  console.log('-'.repeat(70));
  
  performanceMetrics.operations.forEach(op => {
    const status = op.success ? '✓' : '✗';
    console.log(
      `${op.name.padEnd(30)} ${op.operationType.padEnd(10)} ${String(op.operationCount).padEnd(8)} ${(op.duration + 'ms').padEnd(10)} ${status}`
    );
  });
  
  // Recommendations
  console.log('\n\n💡 RECOMMENDATIONS:');
  console.log('-'.repeat(50));
  
  const slowOps = successfulOps.filter(op => op.duration > 1000);
  if (slowOps.length > 0) {
    console.log('\n  ⚠️  Slow Operations (>1000ms):');
    slowOps.forEach(op => {
      console.log(`      - ${op.name}: ${op.duration}ms`);
    });
    console.log('      Consider: Adding indexes, reducing query scope, or implementing caching');
  }
  
  const readHeavy = operationCounts.reads > QUOTA_LIMITS.reads.testBudget * 0.8;
  if (readHeavy) {
    console.log('\n  ⚠️  High Read Usage:');
    console.log('      - Consider implementing client-side caching');
    console.log('      - Use query limits and pagination');
    console.log('      - Batch related queries with Promise.all()');
  }
  
  if (failedOps.length > 0) {
    console.log('\n  ❌ Failed Operations:');
    failedOps.forEach(op => {
      console.log(`      - ${op.name}: ${op.error}`);
    });
  }
  
  if (slowOps.length === 0 && failedOps.length === 0) {
    console.log('\n  ✅ All operations performed within acceptable parameters');
  }
  
  // Safe Usage Estimate
  console.log('\n\n📈 DAILY OPERATION CAPACITY ESTIMATE:');
  console.log('-'.repeat(50));
  
  const avgReadsPerSession = operationCounts.reads;
  const avgWritesPerSession = operationCounts.writes;
  const avgDeletesPerSession = operationCounts.deletes;
  
  const maxReadSessions = Math.floor(QUOTA_LIMITS.reads.testLimit / Math.max(avgReadsPerSession, 1));
  const maxWriteSessions = Math.floor(QUOTA_LIMITS.writes.testLimit / Math.max(avgWritesPerSession, 1));
  const maxDeleteSessions = Math.floor(QUOTA_LIMITS.deletes.testLimit / Math.max(avgDeletesPerSession, 1));
  
  console.log(`\n  Based on this test session's usage:`);
  console.log(`    Max daily user sessions (by reads):   ~${maxReadSessions.toLocaleString()}`);
  console.log(`    Max daily user sessions (by writes):  ~${maxWriteSessions.toLocaleString()}`);
  console.log(`    Max daily user sessions (by deletes): ~${maxDeleteSessions.toLocaleString()}`);
  console.log(`\n  Limiting factor: ${
    Math.min(maxReadSessions, maxWriteSessions, maxDeleteSessions) === maxReadSessions ? 'READS' :
    Math.min(maxReadSessions, maxWriteSessions, maxDeleteSessions) === maxWriteSessions ? 'WRITES' : 'DELETES'
  }`);
  
  console.log('\n' + '='.repeat(70));
  console.log('                    END OF PERFORMANCE REPORT');
  console.log('='.repeat(70));
  
  return {
    quotaUsage: operationCounts,
    operations: performanceMetrics.operations,
    limits: QUOTA_LIMITS
  };
}

// ========== MAIN TEST RUNNER ==========

async function runPerformanceTests() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     INVENTORY MANAGEMENT - PERFORMANCE PARAMETER TESTING         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  
  console.log('\n📋 TEST CONFIGURATION:');
  console.log(`   Test Read Budget:   ${QUOTA_LIMITS.reads.testBudget.toLocaleString()} (of ${QUOTA_LIMITS.reads.testLimit.toLocaleString()} safe limit)`);
  console.log(`   Test Write Budget:  ${QUOTA_LIMITS.writes.testBudget.toLocaleString()} (of ${QUOTA_LIMITS.writes.testLimit.toLocaleString()} safe limit)`);
  console.log(`   Test Delete Budget: ${QUOTA_LIMITS.deletes.testBudget.toLocaleString()} (of ${QUOTA_LIMITS.deletes.testLimit.toLocaleString()} safe limit)`);
  console.log(`   Target User: ${USER_ID}`);
  
  console.log('\n🚀 Starting Performance Tests...');
  
  const testStartTime = Date.now();
  
  try {
    // Run all tests
    await testGetProducts();
    await testGetCategories();
    await testGetOrders();
    await testGetAccountingEntries();
    await testDashboardStats();
    await testBatchRead();
    await testSearchProducts();
    await testOrderCounts();
    await testMLDataRetrieval();
    await testConcurrentReads();
    await testCreateAndDeleteProduct();
    
    const testEndTime = Date.now();
    console.log(`\n✅ All tests completed in ${((testEndTime - testStartTime) / 1000).toFixed(2)}s`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n⚠️  Generating partial report...');
  }
  
  // Generate and save report
  const report = generateReport();
  
  // Save report to file
  const fs = require('fs');
  const reportPath = './scripts/PERFORMANCE_TEST_REPORT.md';
  
  const markdownReport = `# Performance Test Report
  
Generated: ${new Date().toISOString()}

## Quota Usage Summary

| Operation | Used | Test Budget | Safe Limit (50%) | Daily Quota | % of Safe |
|-----------|------|-------------|------------------|-------------|-----------|
| Reads | ${operationCounts.reads} | ${QUOTA_LIMITS.reads.testBudget} | ${QUOTA_LIMITS.reads.testLimit} | ${QUOTA_LIMITS.reads.daily} | ${((operationCounts.reads / QUOTA_LIMITS.reads.testLimit) * 100).toFixed(2)}% |
| Writes | ${operationCounts.writes} | ${QUOTA_LIMITS.writes.testBudget} | ${QUOTA_LIMITS.writes.testLimit} | ${QUOTA_LIMITS.writes.daily} | ${((operationCounts.writes / QUOTA_LIMITS.writes.testLimit) * 100).toFixed(2)}% |
| Deletes | ${operationCounts.deletes} | ${QUOTA_LIMITS.deletes.testBudget} | ${QUOTA_LIMITS.deletes.testLimit} | ${QUOTA_LIMITS.deletes.daily} | ${((operationCounts.deletes / QUOTA_LIMITS.deletes.testLimit) * 100).toFixed(2)}% |

## Operation Details

| Operation | Type | Count | Duration | Status |
|-----------|------|-------|----------|--------|
${performanceMetrics.operations.map(op => 
  `| ${op.name} | ${op.operationType} | ${op.operationCount} | ${op.duration}ms | ${op.success ? '✓' : '✗'} |`
).join('\n')}

## Performance Statistics

- Total Operations: ${performanceMetrics.operations.length}
- Successful: ${performanceMetrics.operations.filter(op => op.success).length}
- Failed: ${performanceMetrics.operations.filter(op => !op.success).length}

### Response Times
${(() => {
  const durations = performanceMetrics.operations.filter(op => op.success).map(op => op.duration);
  if (durations.length === 0) return '- No successful operations';
  return `
- Average: ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms
- Min: ${Math.min(...durations)}ms
- Max: ${Math.max(...durations)}ms
`;
})()}

## Recommendations

${(() => {
  const recommendations = [];
  const slowOps = performanceMetrics.operations.filter(op => op.success && op.duration > 1000);
  if (slowOps.length > 0) {
    recommendations.push('### ⚠️ Slow Operations (>1000ms)');
    slowOps.forEach(op => recommendations.push(`- ${op.name}: ${op.duration}ms`));
    recommendations.push('Consider: Adding indexes, reducing query scope, or implementing caching');
  }
  
  if (operationCounts.reads > QUOTA_LIMITS.reads.testBudget * 0.8) {
    recommendations.push('### ⚠️ High Read Usage');
    recommendations.push('- Consider implementing client-side caching');
    recommendations.push('- Use query limits and pagination');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('✅ All operations performed within acceptable parameters');
  }
  
  return recommendations.join('\n');
})()}

## Capacity Estimate

Based on this test session:
- Max daily sessions (by reads): ~${Math.floor(QUOTA_LIMITS.reads.testLimit / Math.max(operationCounts.reads, 1)).toLocaleString()}
- Max daily sessions (by writes): ~${Math.floor(QUOTA_LIMITS.writes.testLimit / Math.max(operationCounts.writes, 1)).toLocaleString()}
- Max daily sessions (by deletes): ~${Math.floor(QUOTA_LIMITS.deletes.testLimit / Math.max(operationCounts.deletes, 1)).toLocaleString()}
`;

  fs.writeFileSync(reportPath, markdownReport);
  console.log(`\n📄 Report saved to: ${reportPath}`);
  
  process.exit(0);
}

// Run tests
runPerformanceTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
