# Quick Testing Guide

## 🧪 Fast Local Testing (5 minutes)

### 1. Start the Server
```bash
npm run dev
```
Expected: Server running on port 5000

### 2. Open Browser
Navigate to: `http://localhost:5000`

### 3. Login
Use your Google or Phone authentication

### 4. Test Reports Page

#### Go to Reports (/reports)

**Test 1: Check all tabs load**
- Click "Sales & Inventory" tab → Should see 4 charts
- Click "Accounting & Finance" tab → Should see financial charts
- Click "AI Predictions" tab → Should see ML forecasts
- Click "Business Insights" tab → Should see KPIs

**Test 2: Check ML Insights**
- Look for colored alert at top of page
- Should show trend (INCREASING/DECREASING/STABLE)
- Should show a recommendation message

**Test 3: Test Time Range Filter**
- Click dropdown next to "Last 30 days"
- Change to "Last 7 days"
- Charts should update

### 5. Test Chatbot

**Open Chatbot** (click chat icon in bottom right)

**Test Conversations:**
```
You: "What's my stock status?"
AI: Should mention low stock items or confirm good inventory levels

You: "How are my sales?"
AI: Should provide revenue information

You: "Help"
AI: Should list available features

You: "Predict next month"
AI: Should mention ML forecasting capabilities
```

### 6. Verify API Endpoints

**Option A: Use Browser DevTools**
1. Open DevTools (F12)
2. Go to Network tab
3. Navigate to Reports page
4. Look for `/api/reports/data` request
5. Check response includes: `predictions`, `accountingData`, `cashFlow`, `insights`

**Option B: Use curl (if available)**
```bash
# Get auth token from browser DevTools → Application → Cookies
curl "http://localhost:5000/api/reports/data?range=30days" \
  -H "Cookie: connect.sid=YOUR_SESSION_ID"
```

### 7. Check Console for Errors
- Open browser DevTools (F12)
- Check Console tab
- Should see NO red errors
- Some warnings OK

## ✅ Quick Verification Checklist

- [ ] Server starts without errors
- [ ] Can login successfully
- [ ] Reports page loads all 4 tabs
- [ ] At least 1 chart displays data
- [ ] ML insights alert appears (even if no data)
- [ ] Chatbot opens and closes
- [ ] Can send a message to chatbot
- [ ] Chatbot responds (even if generic)
- [ ] No console errors (warnings OK)
- [ ] Page is responsive (resize browser)

## 🎯 Expected Results

### If you have data (products, transactions, accounting entries):
✅ All charts show meaningful data
✅ ML predictions appear with confidence scores
✅ Chatbot gives specific inventory insights
✅ Financial charts show revenue/expense trends
✅ AI insights show actual trends and recommendations

### If you have limited/no data:
✅ Charts show placeholder or "No data" message
✅ ML predictions say "Not enough data"
✅ Chatbot gives generic helpful responses
✅ No errors occur (graceful degradation)
✅ UI still looks professional

## 🚨 Common Issues & Quick Fixes

**Issue: "Loading..." never finishes**
Fix: Check server terminal for errors, restart server

**Issue: Charts not visible**
Fix: Scroll down, check browser zoom level, resize window

**Issue: "Failed to fetch" error**
Fix: Verify server is running on port 5000

**Issue: Chatbot won't open**
Fix: Hard refresh (Ctrl+Shift+R), clear browser cache

**Issue: No predictions shown**
Fix: Normal if <3 months of data exists

## ⚡ Production Readiness Test

Before pushing to live, verify:

1. **Build succeeds**: Run `npm run build` → No errors
2. **Type check passes**: Run `npm run check` → No TypeScript errors
3. **Server stable**: Let server run for 5 minutes → No crashes
4. **No memory leaks**: Check task manager → Memory stable
5. **Mobile works**: Test on phone or use DevTools mobile view

## 📊 Test with Sample Data

If you need test data, you can:

1. **Add Test Products**: Go to Inventory → Add a few products
2. **Add Transactions**: Record some in/out movements
3. **Add Accounting Entries**: Go to Accounting → Add revenue/expenses
4. **Wait 1 minute**: Let data sync
5. **Refresh Reports page**: Should now see data in charts

## ✨ Success Criteria

**PASS if:**
- All tabs in Reports page are clickable
- At least one chart renders (even if empty)
- Chatbot opens and accepts messages
- No red console errors
- Server stays running

**READY FOR DEPLOYMENT if:**
- All above PASS criteria met
- Predictions tab shows forecasts (or "not enough data")
- Accounting charts display data
- Chatbot gives relevant responses
- Mobile view looks good

---

**Time to complete**: ~5 minutes
**Status**: If checklist passes → READY TO PUSH 🚀
