# Clear Frontend Cache Guide

## The Problem

Even after deleting data from Firebase, your browser may still show old data because of:

1. **Browser Cache** - Stores API responses
2. **localStorage** - Stores settings and preferences
3. **React Query Cache** - Stores query results (5 minute cache)
4. **Service Workers** - May cache responses

## Quick Fix - Clear Everything

### Method 1: Browser Developer Tools (Recommended)

1. **Open DevTools**: Press `F12` or `Ctrl+Shift+I`

2. **Clear localStorage**:
   - Go to **Application** tab
   - Click **Local Storage** → your site URL
   - Right-click → **Clear**
   
3. **Clear Session Storage**:
   - Go to **Session Storage** → your site URL
   - Right-click → **Clear**

4. **Clear Cache**:
   - Press `Ctrl+Shift+Delete`
   - Select "Cached images and files"
   - Click "Clear data"

5. **Hard Refresh**:
   - Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac)
   - Or hold `Ctrl` and click the refresh button

### Method 2: Incognito/Private Window

1. Open a new **Incognito/Private** window
2. Navigate to your app
3. Login again
4. Data should be fresh

### Method 3: Clear All Browser Data

1. Press `Ctrl+Shift+Delete`
2. Select:
   - ✅ Browsing history
   - ✅ Cookies and site data
   - ✅ Cached images and files
3. Time range: **All time**
4. Click **Clear data**

## Verify Data is Actually Deleted

Before clearing cache, verify the data is actually deleted from Firebase:

\`\`\`powershell
cd e:\inventory\InventoryManagement\scripts
node verify-firebase-data.js
\`\`\`

This will check Firebase and tell you:
- ✅ If data is actually deleted
- ⚠️  If data still exists (need to run cleanup script)
- 💡 If it's just a cache issue

## Expected Behavior

### If Database is Clean:
\`\`\`
✅ DATABASE IS CLEAN

No data needs to be deleted for this user.
If you're still seeing data in the frontend, try:
1. Clear browser cache
2. Clear localStorage
3. Hard refresh
\`\`\`

### If Database Still Has Data:
\`\`\`
⚠️  DATA CLEANUP NEEDED

Items to be deleted:
   - Orders: 150
   - Accounting entries: 3200
   - User inventory transactions: 1500
   
Run cleanup-firebase-data.js to delete this data
\`\`\`

## React Query Cache

Your app uses React Query which caches data for 5 minutes. To bypass:

1. **Wait 5 minutes** - Cache will expire naturally
2. **Hard refresh** - Forces new queries
3. **Restart dev server** - Clears server-side cache

## localStorage Keys to Check

Your app stores these in localStorage:
- \`settings_[userId]\` - User settings
- \`app_currentBranch\` - Current branch selection
- \`app_branches\` - Branch data
- \`app_staff\` - Staff data
- \`app_defaultUnit\` - Default unit setting
- \`loginContext\` - Login context

To manually clear in DevTools Console:
\`\`\`javascript
// Clear all app data
localStorage.clear();
sessionStorage.clear();

// Or clear specific items
localStorage.removeItem('settings_YOUR_USER_ID');
\`\`\`

## Step-by-Step: Full Clean

1. **Verify database is clean**:
   \`\`\`powershell
   node verify-firebase-data.js
   \`\`\`

2. **If data exists, run cleanup**:
   \`\`\`powershell
   node cleanup-firebase-data.js
   \`\`\`

3. **Clear browser cache**:
   - Press `F12` → Application → Clear storage → Clear site data
   
4. **Restart dev server**:
   \`\`\`powershell
   # Stop current server (Ctrl+C)
   npm run dev
   \`\`\`

5. **Hard refresh browser**:
   - Press `Ctrl+Shift+R`

6. **Verify in UI**:
   - Login again
   - Check orders page - should be empty
   - Check accounting page - should be empty
   - Check products page - should still have products

## Troubleshooting

### Still Seeing Old Data?

1. **Check different user**: Make sure you're logged in as the correct user
2. **Check Firebase Console**: Verify data is deleted in Firestore
3. **Check Network tab**: See if API is returning old data
4. **Check timestamp**: Look at createdAt dates to confirm data age

### API Still Returning Data?

If the API is still returning data:
- Data wasn't actually deleted
- Run \`verify-firebase-data.js\` to check
- Run \`cleanup-firebase-data.js\` if needed

### Frontend Showing Cached Data?

If API returns empty but UI shows data:
- Clear localStorage
- Clear browser cache
- Hard refresh
- Restart browser

## Quick Commands

\`\`\`powershell
# 1. Verify what's in database
cd e:\inventory\InventoryManagement\scripts
node verify-firebase-data.js

# 2. If data exists, clean it up
node cleanup-firebase-data.js

# 3. Restart dev server
cd ..
npm run dev
\`\`\`

Then in browser:
1. Press `F12`
2. Application → Clear site data
3. `Ctrl+Shift+R` to hard refresh
4. Login again

## Still Having Issues?

Check these files for more help:
- [CLEANUP_QUICKSTART.md](CLEANUP_QUICKSTART.md)
- [FIREBASE_QUOTA_OPTIMIZATION.md](../FIREBASE_QUOTA_OPTIMIZATION.md)
