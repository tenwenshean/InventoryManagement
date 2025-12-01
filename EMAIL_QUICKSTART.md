# Email Notifications - Quick Start (5 Minutes)

## ✅ What You Need

1. Your app deployed on Vercel
2. Gmail account for sending emails
3. A free cron service account (we'll set this up)

## 🚀 Setup Steps

### 1️⃣ Gmail App Password (2 minutes)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification** (if not already)
3. Go to **App Passwords**: https://myaccount.google.com/apppasswords
4. Create new app password:
   - App: Mail
   - Device: Other (custom name) → "Inventory System"
5. **Copy the 16-character password** (format: `xxxx xxxx xxxx xxxx`)

### 2️⃣ Add to Vercel (1 minute)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your project → **Settings** → **Environment Variables**
3. Add these 4 variables:

| Name | Value |
|------|-------|
| `EMAIL_HOST` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` |
| `EMAIL_USER` | `your-email@gmail.com` |
| `EMAIL_PASS` | `your 16-char app password` |

4. Click **Save**
5. Redeploy (Vercel will auto-deploy on next push, or click "Redeploy" button)

### 3️⃣ Set Up Free Cron Jobs (2 minutes)

**Option A: cron-job.org (Easiest)**

1. Sign up at [cron-job.org](https://cron-job.org) (free, no credit card)
2. After logging in, click **"Create cron job"**
3. Create these 3 jobs:

**Job 1: Hourly Low Stock Check**
```
Title: Low Stock Check
URL: https://YOUR-APP.vercel.app/api/cron/low-stock-check
Schedule: 0 * * * * (every hour)
Method: POST
```

**Job 2: Daily Report at 9 AM**
```
Title: Daily Report
URL: https://YOUR-APP.vercel.app/api/cron/daily-report
Schedule: 0 9 * * * (daily 9 AM)
Method: POST
```

**Job 3: Weekly Summary (Monday 9 AM)**
```
Title: Weekly Summary
URL: https://YOUR-APP.vercel.app/api/cron/weekly-summary
Schedule: 0 9 * * 1 (Monday 9 AM)
Method: POST
```

4. Click **"Execute now"** on each job to test
5. ✅ Done!

**Option B: GitHub Actions (Already Configured!)**

See `GITHUB_ACTIONS_SETUP.md` - just add 2 secrets and you're done.

### 4️⃣ Configure in App (30 seconds)

1. Go to your app: `https://your-app.vercel.app/settings`
2. Scroll to **Email Notifications**
3. Enter your notification email
4. Enable the toggles you want:
   - ☑️ Low Stock Alerts
   - ☑️ Daily Reports
   - ☑️ Weekly Summary
5. Click **"Save Changes"**

## 🎉 That's It!

You're done! Emails will now send automatically based on your schedule.

## 🧪 Test It Now

### Test from cron-job.org:
1. Go to your dashboard
2. Click **"Execute now"** on any job
3. Check the email inbox you configured
4. Look in spam if not in inbox

### Test from GitHub Actions:
1. Go to your repo → **Actions** tab
2. Click **"Scheduled Email Notifications"**
3. Click **"Run workflow"** → Select job type → **"Run workflow"**
4. Wait 20 seconds, check your email

## 📧 What Emails Look Like

### Low Stock Alert
- Subject: `⚠️ Low Stock Alert - X Product(s) Need Restocking`
- Shows: List of your low stock products with current quantity
- When: Hourly check (but max once per 24 hours)

### Daily Report
- Subject: `📊 Daily Business Report - Dec 1`
- Shows: Yesterday's sales, orders, revenue, top products
- When: Daily at 9 AM

### Weekly Summary
- Subject: `📈 Weekly Business Summary - Nov 24 to Dec 1`
- Shows: Week's performance, top products, inventory status
- When: Every Monday at 9 AM

## ⚙️ Important Notes

✅ **Per-User Data:** Each user only sees their own products/sales
✅ **Toggle Control:** Emails only send if toggle is enabled in Settings
✅ **Email Required:** Must enter notification email in Settings
✅ **24hr Cooldown:** Low stock alerts won't spam (max once daily)

## 🆘 Troubleshooting

**No emails arriving?**
1. Check spam/junk folder
2. Wait 1-2 minutes (Gmail can delay)
3. Verify toggle is enabled in Settings
4. Check notification email is entered
5. Test cron job with "Execute now"

**Cron job fails?**
1. Check your Vercel URL is correct
2. Verify app is deployed successfully
3. Check Vercel function logs for errors

**Gmail not working?**
1. Verify 2-Step Verification is enabled
2. Generate fresh App Password
3. Copy password without spaces
4. Redeploy after adding env vars

## 📚 Detailed Guides

- **Full setup:** `EMAIL_NOTIFICATIONS_DEPLOYMENT.md`
- **Free cron options:** `FREE_CRON_SETUP.md`
- **GitHub Actions:** `GITHUB_ACTIONS_SETUP.md`
- **User guide:** `EMAIL_NOTIFICATIONS_USER_GUIDE.md`

## 🎯 Quick Checklist

- [ ] Gmail App Password created
- [ ] Email env vars added to Vercel
- [ ] App redeployed
- [ ] cron-job.org account created (or GitHub Actions enabled)
- [ ] 3 cron jobs configured
- [ ] Tested with "Execute now"
- [ ] Email received successfully
- [ ] Settings configured in app

**Total time:** ~5 minutes
**Total cost:** $0.00 forever! 🎉
