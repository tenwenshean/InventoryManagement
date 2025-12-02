# Free Cron Alternative Setup Guide

## Problem
Vercel Hobby plan doesn't guarantee precise cron job timing. To get scheduled email notifications working for free, we'll use an external cron service.

## Solution: Using cron-job.org (100% Free)

### Why cron-job.org?
- ✅ Completely free forever
- ✅ Precise scheduling (down to the minute)
- ✅ Reliable execution monitoring
- ✅ Email alerts if jobs fail
- ✅ No credit card required

## Setup Instructions

### Step 1: Create Free Account
1. Go to [https://cron-job.org](https://cron-job.org)
2. Click "Sign up" (top right)
3. Enter email and password
4. Verify email address
5. Log in to dashboard

### Step 2: Add Your Cron Jobs

After deployment, you'll add 2 cron jobs. Your Vercel URL will be something like:
`https://your-app-name.vercel.app`

**Note:** Low stock alerts are now included in the daily report to stay within Vercel's free tier (2 cron jobs).

#### Job 1: Daily Report (9:00 AM Daily)

1. Click **"Create cron job"**
2. Fill in:
   - **Title:** `Daily Business Report - 9 AM (includes low stock alerts)`
   - **Address (URL):** `https://YOUR-VERCEL-URL.vercel.app/api/cron/daily-report`
   - **Schedule:** 
     - Type: `Every day`
     - Time: `09:00`
     - Or use: `0 9 * * *`
   - **Request method:** `POST`
   - **Advanced settings:**
     - Add Header: `x-cron-secret` = `YOUR_SECRET_KEY`
3. Click **"Create"**

#### Job 2: Weekly Summary (Monday 9:00 AM)

1. Click **"Create cron job"**
2. Fill in:
   - **Title:** `Weekly Summary - Monday 9 AM`
   - **Address (URL):** `https://YOUR-VERCEL-URL.vercel.app/api/cron/weekly-summary`
   - **Schedule:** 
     - Type: `Every week`
     - Day: `Monday`
     - Time: `09:00`
     - Or use: `0 9 * * 1`
   - **Request method:** `POST`
   - **Advanced settings:**
     - Add Header: `x-cron-secret` = `YOUR_SECRET_KEY`
3. Click **"Create"**

### Step 3: Set Up Security (Optional but Recommended)

1. Generate a random secret key:
   ```bash
   # On Windows PowerShell:
   -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
   ```

2. Add to Vercel Environment Variables:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `CRON_SECRET` = `your_generated_secret`
   - Click "Save"

3. Use this same secret in cron-job.org headers (see above)

### Step 4: Test Your Jobs

1. In cron-job.org dashboard, find your job
2. Click **"Execute now"** button
3. Check **"History"** tab to see result:
   - ✅ Green = Success (200 response)
   - ❌ Red = Failed
4. Click on execution to see detailed logs

### Step 5: Monitor & Alerts

**Enable Email Notifications:**
1. Go to cron-job.org → Settings → Notifications
2. Enable "Email notification on execution failure"
3. You'll get alerted if any job fails

**Check Execution History:**
- View all past executions
- See response codes and timing
- Download logs if needed

## Alternative Free Services

If cron-job.org doesn't work for you, try these:

### 1. EasyCron (Free Plan)
- URL: https://www.easycron.com
- Free tier: 1-minute precision, unlimited jobs
- Setup: Similar to cron-job.org

### 2. cron-job.io
- URL: https://cron-job.io
- Free tier: Basic scheduling
- Setup: Similar interface

### 3. GitHub Actions (If using GitHub)
Already configured in your repo! See `.github/workflows/cron-jobs.yml`

## Vercel Configuration Update

Since we're using external cron service, the `crons` section in `vercel.json` won't be used, but it's harmless to keep it there.

## Complete Setup Checklist

- [ ] Create account on cron-job.org
- [ ] Deploy your app to Vercel
- [ ] Note your Vercel URL (e.g., `https://your-app.vercel.app`)
- [ ] Generate CRON_SECRET and add to Vercel env vars
- [ ] Create 2 cron jobs on cron-job.org:
  - [ ] Daily report (9 AM) - includes low stock alerts
  - [ ] Weekly summary (Monday 9 AM)
- [ ] Test each job using "Execute now"
- [ ] Enable failure email notifications
- [ ] Verify emails are being received

## Testing

### Test Immediately
On cron-job.org, use "Execute now" button to test without waiting.

### Expected Response
Each job should return:
```json
{
  "message": "Daily report complete",
  "emailsSent": 1
}
```

### Troubleshooting

**Job fails with 401 Unauthorized:**
- Check `CRON_SECRET` matches in both Vercel and cron-job.org

**Job succeeds but no email:**
- Check user has toggle enabled in Settings
- Verify notification email is entered
- Check spam folder
- View Vercel function logs for errors

**Daily report doesn't show low stock products:**
- Verify products are actually below their low stock threshold
- Check product `lowStockThreshold` values in database
- Low stock section only appears if there are low stock items

**Job shows "Connection timeout":**
- Your Vercel function might be taking too long
- Check Vercel function logs
- Increase timeout if needed (already set to 30s)

## Cost Comparison

| Service | Price | Features |
|---------|-------|----------|
| **cron-job.org** | **FREE** | Unlimited jobs, 1-min precision |
| Vercel Cron (Hobby) | FREE | Unreliable timing (±59 min) |
| Vercel Cron (Pro) | $20/month | Precise timing |
| EasyCron Free | FREE | Good alternative |

## Benefits of External Cron

✅ **100% Free** - No credit card needed
✅ **More Reliable** - Dedicated cron service
✅ **Better Monitoring** - Detailed execution logs
✅ **Email Alerts** - Get notified on failures
✅ **Easy Testing** - "Execute now" button
✅ **Portable** - Works with any hosting (not just Vercel)

## Your Current Setup

Once you deploy, your endpoints are ready at:
- `https://your-vercel-url.vercel.app/api/cron/daily-report` (includes low stock alerts)
- `https://your-vercel-url.vercel.app/api/cron/weekly-summary`

All the serverless function code is already implemented in `api/index.js`! Just point cron-job.org to these URLs.

## What Changed?

**Low stock alerts are now integrated into the daily report** to stay within Vercel's free tier limit of 2 cron jobs. 

- The daily report email now includes a dedicated "⚠️ Low Stock Alert" section listing all products that need restocking
- You'll see product names, current stock levels, and thresholds in the same email as your daily business summary
- This gives you a complete daily overview without needing a separate hourly check

## Next Steps

1. **Deploy to Vercel** (if not already done)
2. **Get your Vercel URL** from the deployment
3. **Sign up for cron-job.org** (takes 2 minutes)
4. **Create the 2 cron jobs** using your Vercel URL
5. **Test with "Execute now"** button
6. **Done!** ✅ Emails will send on schedule

No credit card, no payment, completely free forever! 🎉
