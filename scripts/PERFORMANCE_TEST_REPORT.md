# Performance Test Report
  
Generated: 2025-12-13T06:01:51.438Z

## Quota Usage Summary

| Operation | Used | Test Budget | Safe Limit (50%) | Daily Quota | % of Safe |
|-----------|------|-------------|------------------|-------------|-----------|
| Reads | 23 | 5000 | 25000 | 50000 | 0.09% |
| Writes | 1 | 500 | 10000 | 20000 | 0.01% |
| Deletes | 1 | 100 | 10000 | 20000 | 0.01% |

## Operation Details

| Operation | Type | Count | Duration | Status |
|-----------|------|-------|----------|--------|
| getProducts | reads | 1 | 3902ms | ✓ |
| getCategories | reads | 1 | 155ms | ✓ |
| getOrders | reads | 1 | 200ms | ✓ |
| getAccountingEntries | reads | 1 | 185ms | ✓ |
| dashboardStats | reads | 1 | 122ms | ✓ |
| batchRead_reports | reads | 4 | 484ms | ✓ |
| searchProducts | reads | 1 | 159ms | ✓ |
| orderCountByStatus | reads | 1 | 372ms | ✓ |
| mlDataRetrieval | reads | 2 | 1086ms | ✓ |
| concurrentReads_10x | reads | 10 | 160ms | ✓ |
| createProduct | writes | 1 | 68ms | ✓ |
| deleteProduct | deletes | 1 | 51ms | ✓ |

## Performance Statistics

- Total Operations: 12
- Successful: 12
- Failed: 0

### Response Times

- Average: 578.67ms
- Min: 51ms
- Max: 3902ms


## Recommendations

### ⚠️ Slow Operations (>1000ms)
- getProducts: 3902ms
- mlDataRetrieval: 1086ms
Consider: Adding indexes, reducing query scope, or implementing caching

## Capacity Estimate

Based on this test session:
- Max daily sessions (by reads): ~1,086
- Max daily sessions (by writes): ~10,000
- Max daily sessions (by deletes): ~10,000
