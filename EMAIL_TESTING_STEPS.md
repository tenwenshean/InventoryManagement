# Email Testing - Quick Steps

## Option 1: Using PowerShell Script (Recommended)

1. **Get your Firebase token:**
   - Open http://localhost:5000 in your browser
   - Make sure you're logged in
   - Press `F12` to open Developer Tools
   - Go to **Console** tab
   - Type: `await firebase.auth().currentUser.getIdToken()`
   - Press Enter
   - Copy the token that appears (it's a long string, do NOT include the quotes)

2. **Run the test script:**
   - Open a NEW PowerShell window (don't close the running server)
   - Navigate to: `cd E:\inventory\InventoryManagement`
   - Run: `.\test-email.ps1`
   - Paste your token when prompted
   - Check your email inbox at: tenwenshean@gmail.com

## Option 2: Using the HTML Test Page

1. Make sure you're logged in at http://localhost:5000
2. Open: `test-email-local.html` (should already be open)
3. Enter your email: tenwenshean@gmail.com
4. Select email type: Low Stock Alert
5. Click "Send Test Email"
6. Check console for success/error
7. Check your inbox at: tenwenshean@gmail.com

## Option 3: Using Browser Console Directly

1. Go to http://localhost:5000 and log in
2. Press F12 to open Developer Tools
3. Go to Console tab
4. Paste this code and press Enter:

```javascript
// First, import the auth module
import { auth } from '/src/lib/firebaseClient.ts';

// Then send the test email
auth.currentUser.getIdToken(true).then(token => {
  fetch('http://localhost:5000/api/notifications/test-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({
      email: 'tenwenshean@gmail.com',
      type: 'low-stock'
    })
  })
  .then(r => r.json())
  .then(d => console.log('✅ Success:', d))
  .catch(e => console.error('❌ Error:', e));
});
```

## What to Expect

You should receive an email at **tenwenshean@gmail.com** with:
- Subject: "🔔 Low Stock Alert"
- Professional HTML formatted email
- Sample low stock items listed
- Your company name in the email

## Troubleshooting

If email doesn't arrive:
1. Check spam/junk folder
2. Wait 1-2 minutes (sometimes Gmail delays)
3. Check server console for errors
4. Verify .env has correct Gmail credentials:
   - EMAIL_USER=tenwenshean@gmail.com
   - EMAIL_PASS=tbkzszfdcawfaxqb

## Testing Other Email Types

Change the `type` field to test different emails:
- `"low-stock"` - Low Stock Alert
- `"daily-report"` - Daily Summary Report  
- `"weekly-summary"` - Weekly Summary Report
