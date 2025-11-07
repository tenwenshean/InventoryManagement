# Deployment Checklist - Accounting Database Fix

## Pre-Deployment

- [x] Fixed Firestore query order in `server/storage.ts`
- [x] Added composite indexes to `firestore.indexes.json`
- [x] Tested locally - dev server starts successfully
- [x] Created documentation for the fix

## Deployment Steps

### 1. Deploy Firestore Indexes First ⚠️ IMPORTANT

```powershell
# Make sure you're logged into Firebase
firebase login

# Deploy indexes (this must be done BEFORE pushing code)
firebase deploy --only firestore:indexes
```

**Expected Output:**
```
=== Deploying to 'your-project-id'...

i  firestore: uploading indexes file firestore.indexes.json
✔  firestore: deployed indexes in firestore.indexes.json successfully
```

**Index Build Time**: 5-30 minutes (depends on data size)

### 2. Monitor Index Creation

While indexes are building:

1. Open [Firebase Console](https://console.firebase.google.com)
2. Navigate to: **Firestore Database** → **Indexes**
3. Watch for these indexes to change from "Building" to "Enabled":
   - `accountingEntries` collection:
     - userId (Ascending) + createdAt (Descending)
     - userId (Ascending) + createdAt (Ascending)
   - `inventoryTransactions` collection:
     - productId (Ascending) + createdAt (Descending)
     - productId (Ascending) + createdAt (Ascending)

### 3. Wait for Indexes to Complete

⚠️ **DO NOT deploy code until indexes are fully built!**

Queries will fail if code is deployed before indexes are ready.

### 4. Commit and Push Code

Once indexes show "Enabled" status:

```powershell
# Check what files changed
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "Fix: Resolve accounting entries Firestore query issues for production

- Restructured getAccountingEntries query to apply where clauses before orderBy
- Added required composite indexes for userId + createdAt queries
- Fixed date range filtering for month-based accounting queries
- Ensures consistency between localhost and production databases"

# Push to production
git push origin main
```

### 5. Verify Deployment

After pushing code:

1. Wait for your production deployment to complete
2. Navigate to your production URL
3. Test the accounting page:
   - [ ] Page loads without errors
   - [ ] Journal entries display correctly
   - [ ] Month selector shows available months
   - [ ] Filtering by month works
   - [ ] Balance sheet displays proper data
   - [ ] Income statement displays proper data
   - [ ] Can create new journal entries
   - [ ] Can delete journal entries

### 6. Check Browser Console

Open DevTools (F12) and verify:
- [ ] No Firestore errors in console
- [ ] No 500 errors on `/api/accounting/entries`
- [ ] Requests return data successfully
- [ ] Cache headers are present (`X-Cache: HIT` or `MISS`)

### 7. Monitor Production Logs

Check your production logs for:
- Any Firestore query errors
- Performance issues
- Unexpected behavior

## Common Issues & Solutions

### Issue: "Missing index" error in production

**Symptom**: Error message about missing composite index

**Solution**:
1. Firebase Console will show the exact index needed
2. Click the link in the error to auto-create the index
3. Wait for build to complete
4. Refresh the page

### Issue: No data showing after deployment

**Symptom**: Accounting page shows no entries

**Possible Causes**:
1. Indexes still building - wait and refresh
2. Cache needs clearing - hard refresh (Ctrl+Shift+R)
3. User authentication issue - check if logged in

**Solution**:
```powershell
# Clear all caches
firebase deploy --only firestore:indexes --force
```

### Issue: Different data on localhost vs production

**Symptom**: Entries appear on localhost but not production

**Possible Causes**:
1. Different Firebase projects/environments
2. userId mismatch between environments
3. Data not synced to production Firestore

**Solution**:
- Verify `firebase-key.json` points to production
- Check Firebase Console to see actual data
- Verify userId in production matches entries

## Rollback Plan

If critical issues occur:

### Option 1: Revert Code Only
```powershell
git revert HEAD
git push origin main
```

### Option 2: Full Rollback (Code + Indexes)
```powershell
# Revert code
git revert HEAD
git push origin main

# Note: Indexes cannot be easily removed once deployed
# They don't hurt to keep, but if needed, manually delete via Firebase Console
```

## Post-Deployment Validation

After 24 hours, verify:
- [ ] No increase in Firestore errors
- [ ] Query performance is acceptable
- [ ] Cache hit rate is good (check `X-Cache` headers)
- [ ] User reports are positive
- [ ] No data inconsistencies reported

## Performance Monitoring

Monitor these metrics:
- Firestore read operations (should decrease due to caching)
- API response times for `/api/accounting/entries`
- Cache hit rate
- User session duration on accounting page

## Support Information

If issues persist:
1. Check the detailed fix documentation in `ACCOUNTING_DATABASE_FIX.md`
2. Review Firestore query rules documentation
3. Check Firebase status page: https://status.firebase.google.com/

## Completion Checklist

- [ ] Indexes deployed and built
- [ ] Code pushed to production
- [ ] Production site tested
- [ ] No console errors
- [ ] Data displays correctly
- [ ] Monitoring set up
- [ ] Team notified of changes
- [ ] Documentation updated

---

**Date Deployed**: _______________

**Deployed By**: _______________

**Production URL**: _______________

**Issues Encountered**: _______________
