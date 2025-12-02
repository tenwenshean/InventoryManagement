# Email Notification System Testing Guide

## Quick Test Summary

### ✅ What We're Testing
1. Daily report endpoint (with low stock alerts)
2. Weekly summary endpoint (with low stock alerts)
3. Both local development and production on Vercel

---

## 🏠 LOCAL TESTING

### Prerequisites
- Server running locally (usually `npm run dev`)
- EMAIL_USER and EMAIL_PASS configured in `.env`
- You're logged into the app

### Test Method 1: Using Browser Console (Easiest)

1. **Open your app** at `http://localhost:5000` (or your local port)
2. **Log in** to your account
3. **Open Browser Developer Tools** (F12)
4. **Go to Console tab**
5. **Copy and paste these commands:**

#### Test Daily Report (includes low stock):
```javascript
fetch('http://localhost:5000/api/notifications/test-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    type: 'daily-report',
    email: 'YOUR_EMAIL@example.com'  // Replace with your email
  })
})
.then(r => r.json())
.then(data => console.log('✅ Response:', data))
.catch(err => console.error('❌ Error:', err));
```

#### Test Weekly Summary (includes low stock):
```javascript
fetch('http://localhost:5000/api/notifications/test-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    type: 'weekly-summary',
    email: 'YOUR_EMAIL@example.com'  // Replace with your email
  })
})
.then(r => r.json())
.then(data => console.log('✅ Response:', data))
.catch(err => console.error('❌ Error:', err));
```

### Test Method 2: Using PowerShell

1. **Get your auth token** from browser:
   - Open DevTools (F12) → Console
   - Type: `localStorage.getItem('token')`
   - Copy the token value

2. **Run in PowerShell:**

```powershell
# Replace YOUR_TOKEN and YOUR_EMAIL with actual values
$token = "YOUR_TOKEN_HERE"
$email = "YOUR_EMAIL@example.com"

# Test Daily Report
$body = @{
    type = "daily-report"
    email = $email
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/notifications/test-email" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "✅ Daily report test sent! Check your email."

# Test Weekly Summary
$body = @{
    type = "weekly-summary"
    email = $email
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/notifications/test-email" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "✅ Weekly summary test sent! Check your email."
```

---

## ☁️ PRODUCTION TESTING (Vercel)

### Prerequisites
- App deployed to Vercel
- EMAIL_USER and EMAIL_PASS configured in Vercel environment variables
- You're logged into the production app

### Test Method 1: Using Browser Console (Easiest)

1. **Open your production app** at `https://YOUR-APP.vercel.app`
2. **Log in** to your account
3. **Open Browser Developer Tools** (F12)
4. **Go to Console tab**
5. **Copy and paste these commands:**

#### Test Daily Report:
```javascript
fetch('https://YOUR-APP.vercel.app/api/notifications/test-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    type: 'daily-report',
    email: 'YOUR_EMAIL@example.com'  // Replace with your email
  })
})
.then(r => r.json())
.then(data => console.log('✅ Response:', data))
.catch(err => console.error('❌ Error:', err));
```

#### Test Weekly Summary:
```javascript
fetch('https://YOUR-APP.vercel.app/api/notifications/test-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  },
  body: JSON.stringify({
    type: 'weekly-summary',
    email: 'YOUR_EMAIL@example.com'  // Replace with your email
  })
})
.then(r => r.json())
.then(data => console.log('✅ Response:', data))
.catch(err => console.error('❌ Error:', err));
```

### Test Method 2: Using PowerShell

```powershell
# Replace YOUR_APP, YOUR_TOKEN, and YOUR_EMAIL
$vercelUrl = "https://YOUR-APP.vercel.app"
$token = "YOUR_TOKEN_HERE"
$email = "YOUR_EMAIL@example.com"

# Test Daily Report
$body = @{
    type = "daily-report"
    email = $email
} | ConvertTo-Json

Invoke-RestMethod -Uri "$vercelUrl/api/notifications/test-email" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "✅ Production daily report test sent!"

# Test Weekly Summary
$body = @{
    type = "weekly-summary"
    email = $email
} | ConvertTo-Json

Invoke-RestMethod -Uri "$vercelUrl/api/notifications/test-email" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $body

Write-Host "✅ Production weekly summary test sent!"
```

---

## 🧪 TEST CRON ENDPOINTS DIRECTLY

### Local Cron Test

```powershell
# Set your CRON_SECRET from .env file
$cronSecret = "YOUR_CRON_SECRET"

# Test Daily Report Cron
Invoke-RestMethod -Uri "http://localhost:5000/api/cron/daily-report" `
    -Method POST `
    -Headers @{
        "x-cron-secret" = $cronSecret
        "Content-Type" = "application/json"
    }

Write-Host "✅ Daily report cron executed locally"

# Test Weekly Summary Cron
Invoke-RestMethod -Uri "http://localhost:5000/api/cron/weekly-summary" `
    -Method POST `
    -Headers @{
        "x-cron-secret" = $cronSecret
        "Content-Type" = "application/json"
    }

Write-Host "✅ Weekly summary cron executed locally"
```

### Production Cron Test

```powershell
# Use your production CRON_SECRET from Vercel env vars
$vercelUrl = "https://YOUR-APP.vercel.app"
$cronSecret = "YOUR_CRON_SECRET"

# Test Daily Report Cron
Invoke-RestMethod -Uri "$vercelUrl/api/cron/daily-report" `
    -Method POST `
    -Headers @{
        "x-cron-secret" = $cronSecret
        "Content-Type" = "application/json"
    }

Write-Host "✅ Production daily report cron executed"

# Test Weekly Summary Cron
Invoke-RestMethod -Uri "$vercelUrl/api/cron/weekly-summary" `
    -Method POST `
    -Headers @{
        "x-cron-secret" = $cronSecret
        "Content-Type" = "application/json"
    }

Write-Host "✅ Production weekly summary cron executed"
```

---

## ✅ What to Check in Email

### Daily Report Email Should Contain:
- ✅ Subject: "📊 Daily Business Report - [Date]"
- ✅ Total Sales, Orders, Revenue stats
- ✅ **⚠️ Low Stock Alert section** (if you have low stock products)
  - Product names
  - Current stock levels (in red)
  - Threshold values
- ✅ Top Selling Products table

### Weekly Summary Email Should Contain:
- ✅ Subject: "📈 Weekly Business Summary - [Date Range]"
- ✅ Weekly stats (Sales, Orders, Revenue, Avg Order Value)
- ✅ **⚠️ Low Stock Alert section** (if you have low stock products)
  - Product names
  - Current stock levels (in red)
  - Threshold values
- ✅ Top Products This Week
- ✅ Inventory Status (Total, Low Stock Count, Out of Stock)

---

## 🔍 Troubleshooting

### No Email Received?

**1. Check Email Configuration:**
```javascript
// In browser console on your app
fetch('http://localhost:5000/api/health')
  .then(r => r.json())
  .then(data => console.log(data))
```

**2. Check Server Logs:**
- Look for `[EMAIL]` or `[CRON]` log entries
- Check for error messages

**3. Check Spam Folder:**
- Automated emails often go to spam first

**4. Verify Environment Variables:**
- Local: Check `.env` file has EMAIL_USER and EMAIL_PASS
- Production: Check Vercel Dashboard → Settings → Environment Variables

### Low Stock Section Not Showing?

**Add a test low stock product:**
1. Go to Products page
2. Create/edit a product
3. Set Quantity to 5
4. Set Low Stock Threshold to 10
5. Save
6. Run test again

---

## 📊 Expected Responses

### Success Response:
```json
{
  "message": "Test email sent successfully",
  "email": "your-email@example.com",
  "type": "daily-report"
}
```

### Error Response:
```json
{
  "message": "Failed to send test email. Check server logs and email configuration."
}
```

### Cron Success Response:
```json
{
  "message": "Daily report complete",
  "emailsSent": 1
}
```

---

## 🎯 Quick Test Checklist

- [ ] Local daily report test
- [ ] Local weekly summary test
- [ ] Production daily report test
- [ ] Production weekly summary test
- [ ] Low stock products appear in emails
- [ ] Emails have correct formatting
- [ ] Both cron endpoints work locally
- [ ] Both cron endpoints work on production
- [ ] cron-job.org successfully triggers endpoints

---

## 💡 Pro Tips

1. **Create test low stock products** before testing to see the alert section
2. **Check both inbox and spam** folder
3. **Wait 30-60 seconds** for email delivery
4. **Check Vercel function logs** if production tests fail
5. **Use browser console method** - it's the easiest!

---

## 🚀 Ready to Test?

**FASTEST METHOD:**
1. Open your app in browser
2. Press F12
3. Paste the browser console commands above
4. Check your email!

That's it! 🎉
