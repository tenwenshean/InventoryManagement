# 🚀 Firebase Quota Cleanup - Quick Start Guide

## What This Does

This cleanup will:
1. ✅ Delete old inventory transactions (older than 6 months) 
2. ✅ Clear ALL orders for tenwenshean@gmail.com
3. ✅ Clear ALL accounting entries for tenwenshean@gmail.com
4. ✅ Clear ALL inventory transactions for tenwenshean@gmail.com
5. ✅ Keep products and user account intact
6. ✅ Analyze what's causing high quota usage
7. ✅ Provide optimization recommendations

## ⚠️ IMPORTANT - Before Running

1. **Backup First** (if needed)
   - This script DELETES data permanently
   - User products are PRESERVED
   - Orders and transactions are DELETED

2. **Verify Target User**
   - The script targets: `tenwenshean@gmail.com`
   - Make sure this is correct!

## 🎯 Step-by-Step Instructions

### Step 1: Run the Cleanup Script

Open PowerShell in the scripts directory and run:

\`\`\`powershell
cd e:\inventory\InventoryManagement\scripts
node cleanup-firebase-data.js
\`\`\`

**Expected Output:**
\`\`\`
═══════════════════════════════════════════════════════
   Firebase Data Cleanup & Quota Optimization Tool
═══════════════════════════════════════════════════════

📧 Finding user ID for tenwenshean@gmail.com...
✓ Found user ID: [user-id]

🗑️  Step 1: Deleting inventory transactions...
   Read X inventory transactions
   Found Y old transactions to delete
   ✓ Successfully deleted Y transactions

🗑️  Step 2: Clearing orders and accounting...
   ✓ Deleted X orders
   ✓ Deleted Y accounting entries
   ✓ Deleted Z inventory transactions

📊 Step 3: Analyzing potential quota usage issues...
   [Shows collection sizes and recommendations]

✅ Cleanup completed successfully!
\`\`\`

### Step 2: Analyze Code Patterns (Optional)

\`\`\`powershell
node analyze-firebase-quota.js
\`\`\`

This will scan your codebase and identify patterns causing high quota usage.

### Step 3: Check Results in Firebase Console

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Check the collections:
   - `orders` - Should have fewer documents
   - `inventoryTransactions` - Should have fewer documents
   - `accountingEntries` - Should have fewer documents
   - `products` - Should be UNCHANGED

4. Go to Usage tab:
   - Monitor read/write counts over next 24 hours
   - Should see significant reduction

## 📊 What Gets Deleted

### For tenwenshean@gmail.com:
- ❌ All orders (both as customer and seller)
- ❌ All accounting entries
- ❌ All inventory transactions
- ✅ Products (KEPT)
- ✅ User account (KEPT)
- ✅ Categories (KEPT)

### For All Users:
- ❌ Inventory transactions older than 6 months

## 🔧 If Something Goes Wrong

If the script fails or you need to stop it:
1. Press `Ctrl+C` to stop the script
2. Check the error message
3. Common issues:
   - **Firebase credentials**: Make sure `firebase-key.json` exists
   - **Network error**: Check internet connection
   - **Permission error**: Verify Firebase service account has proper permissions

## 📈 Expected Quota Savings

Based on your data:

**Before Cleanup:**
- Estimated: 3000+ transactions
- Daily quota usage: High (potentially hitting limits)

**After Cleanup:**
- Reduced data by ~80-90%
- Daily quota usage: Much lower
- Room for growth

## 🎯 Next Steps After Cleanup

1. **Monitor for 24 hours**
   - Check Firebase Console → Usage
   - Verify quota reduction

2. **Apply Code Optimizations** (See [FIREBASE_QUOTA_OPTIMIZATION.md](../FIREBASE_QUOTA_OPTIMIZATION.md))
   - Add caching to dashboard
   - Add pagination to queries
   - Limit AI chat data fetching

3. **Set Up Firestore Indexes**
   - Create composite indexes for frequently queried fields
   - Check Firebase Console for index recommendations

4. **Schedule Regular Cleanups**
   - Run this script monthly
   - Or set up Cloud Function for automatic cleanup

## 💡 Pro Tips

1. **Cache Dashboard Stats**: Add 5-minute caching to reduce reads by 90%
2. **Paginate Large Lists**: Limit queries to 50-100 items
3. **Use Firestore Indexes**: Speed up queries and reduce costs
4. **Archive Old Data**: Move data older than 1 year to Cloud Storage
5. **Monitor Usage**: Set up Firebase alerts for quota thresholds

## 🆘 Need Help?

Check these files:
- [FIREBASE_QUOTA_OPTIMIZATION.md](../FIREBASE_QUOTA_OPTIMIZATION.md) - Detailed optimization guide
- [firebase-optimization-patches.js](firebase-optimization-patches.js) - Code patches to apply
- Firebase Console → Usage → View detailed usage

## 🎬 Ready to Run?

\`\`\`powershell
# Navigate to scripts directory
cd e:\inventory\InventoryManagement\scripts

# Run the cleanup
node cleanup-firebase-data.js
\`\`\`

⚠️  **One more time**: This will PERMANENTLY DELETE data. User products are safe, but orders and transactions for tenwenshean@gmail.com will be removed.

Are you ready? If yes, run the command above! 🚀
