# Performance Optimization Guide - Firestore Indexes

## Current Performance Issue

The accounting page is loading slowly (20+ seconds) due to inefficient Firestore queries. The main bottlenecks are:

1. Fetching all accounting entries and filtering by userId
2. Fetching all inventory transactions for accounting reports
3. Missing composite indexes in Firestore

## Solution: Create Firestore Indexes

### Option 1: Automatic Index Creation (Recommended)

When you access the accounting page, Firestore will show error messages in the console with direct links to create the required indexes. Click these links to automatically create the indexes.

### Option 2: Manual Index Creation via Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **inventorymanagement-3005-b38a3**
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Add Index** and create the following indexes:

#### Index 1: accountingEntries by userId
- **Collection ID**: `accountingEntries`
- **Fields to index**:
  - Field: `userId` | Order: Ascending
  - Field: `createdAt` | Order: Descending
- **Query scope**: Collection

#### Index 2: products by userId  
- **Collection ID**: `products`
- **Fields to index**:
  - Field: `userId` | Order: Ascending
  - Field: `createdAt` | Order: Descending
- **Query scope**: Collection

#### Index 3: categories by userId
- **Collection ID**: `categories`
- **Fields to index**:
  - Field: `userId` | Order: Ascending
  - Field: `createdAt` | Order: Descending
- **Query scope**: Collection

### Option 3: Deploy Indexes via Firebase CLI

If you have Firebase CLI installed:

```bash
# Deploy the indexes from firestore.indexes.json
firebase deploy --only firestore:indexes
```

## Expected Performance After Indexes

- **Before**: 20+ seconds to load accounting page
- **After**: 1-2 seconds to load accounting page
- **Subsequent loads**: Instant (cached)

## Other Optimizations Applied

1. ✅ Changed from client-side filtering to Firestore queries with `where` clause
2. ✅ Added batched queries for inventory transactions (max 10 items per batch)
3. ✅ Added HTTP cache headers (5-minute cache)
4. ✅ Increased React Query cache time to 10 minutes
5. ✅ Disabled unnecessary refetching on window focus/mount

## Monitoring Performance

After creating the indexes, monitor the Network tab in browser DevTools:
- API requests should complete in < 500ms
- Page should be interactive in < 2 seconds

## Note

Index creation can take a few minutes. During this time, queries may still be slow or fail. Wait for the indexes to be fully built before testing.
