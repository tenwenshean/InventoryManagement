# ✅ Email Notifications - Vercel Production Checklist

## 🎉 What's Ready

### ✅ Code Changes
- [x] Email service added to `api/index.js` (Vercel serverless)
- [x] Test email endpoint: `/api/notifications/test-email`
- [x] Cron endpoints for scheduled tasks:
  - `/api/cron/low-stock-check` (hourly)
  - `/api/cron/daily-report` (daily 9 AM)
  - `/api/cron/weekly-summary` (Monday 9 AM)
- [x] Vercel cron configuration in `vercel.json`
- [x] Settings page UI updated
- [x] Multi-user support

## 📋 Deployment Steps

### 1. Add Environment Variables to Vercel

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add these variables:

```
EMAIL_HOST = smtp.gmail.com
EMAIL_PORT = 587
EMAIL_USER = your-email@gmail.com
EMAIL_PASS = your-16-character-app-password
```

**Optional (for cron security):**
```
CRON_SECRET = your-random-secret-string
```

### 2. Get Gmail App Password

1. Enable 2-Factor Authentication: https://myaccount.google.com/security
2. Create App Password: https://myaccount.google.com/apppasswords
   - Select "Mail"
   - Select "Other" → Name it "Inventory System"
   - Copy the 16-character password
3. Use this password in `EMAIL_PASS` environment variable

### 3. Deploy to Vercel

```bash
git add .
git commit -m "feat: add email notifications with Vercel cron support"
git push
```

Or use Vercel CLI:
```bash
vercel --prod
```

### 4. Verify Deployment

After deployment, test the endpoint:

```bash
# Replace with your actual Vercel URL and Firebase token
curl -X POST https://your-app.vercel.app/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"type": "low-stock", "email": "your-email@gmail.com"}'
```

### 5. Enable Vercel Cron (Pro Plan Only)

⚠️ **Important:** Vercel Cron Jobs require a **Pro plan** ($20/month per team)

If you have Vercel Pro:
- Cron jobs will automatically run based on `vercel.json` schedule
- Monitor in: Vercel Dashboard → Your Project → Cron Jobs

If you're on Hobby (free) plan:
- Use **Alternative Option** below

## 🆓 Alternative for Vercel Hobby Plan

Since Vercel cron requires Pro, use a **free external cron service**:

### Option 1: Cron-job.org (Recommended)

1. Sign up at https://cron-job.org (free)
2. Create new cron jobs:

**Low Stock Check (Every Hour):**
- URL: `https://your-app.vercel.app/api/cron/low-stock-check`
- Method: POST
- Schedule: `0 * * * *`
- Headers: `x-cron-secret: your-secret` (if you set CRON_SECRET)

**Daily Report (9 AM Daily):**
- URL: `https://your-app.vercel.app/api/cron/daily-report`
- Method: POST
- Schedule: `0 9 * * *`

**Weekly Summary (Monday 9 AM):**
- URL: `https://your-app.vercel.app/api/cron/weekly-summary`
- Method: POST
- Schedule: `0 9 * * 1`

### Option 2: GitHub Actions (Free)

Create `.github/workflows/cron-jobs.yml`:

```yaml
name: Scheduled Email Notifications

on:
  schedule:
    - cron: '0 * * * *'  # Hourly low stock check
    - cron: '0 9 * * *'  # Daily report at 9 AM
    - cron: '0 9 * * 1'  # Weekly summary Monday 9 AM

jobs:
  trigger-crons:
    runs-on: ubuntu-latest
    steps:
      - name: Low Stock Check
        if: github.event.schedule == '0 * * * *'
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/low-stock-check \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
      
      - name: Daily Report
        if: github.event.schedule == '0 9 * * *'
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/daily-report \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
      
      - name: Weekly Summary
        if: github.event.schedule == '0 9 * * 1'
        run: |
          curl -X POST https://your-app.vercel.app/api/cron/weekly-summary \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

## 🧪 Testing

### Test Email Endpoint (Works Now)
```bash
curl -X POST https://your-app.vercel.app/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type": "low-stock", "email": "test@example.com"}'
```

### Test Cron Endpoints (Manual Trigger)
```bash
# Low stock check
curl -X POST https://your-app.vercel.app/api/cron/low-stock-check \
  -H "x-cron-secret: your-secret"

# Daily report
curl -X POST https://your-app.vercel.app/api/cron/daily-report \
  -H "x-cron-secret: your-secret"

# Weekly summary
curl -X POST https://your-app.vercel.app/api/cron/weekly-summary \
  -H "x-cron-secret: your-secret"
```

## 🔍 Monitoring

### Check Vercel Logs
```bash
vercel logs
```

Or in Vercel Dashboard → Your Project → Logs

### Look for:
- `[EMAIL] Email sent successfully to:` ✅
- `[CRON] Low stock check complete` ✅
- `[EMAIL] Email credentials not configured` ⚠️ (add env vars)

## 📊 What Each User Sees

### User Configuration (Settings Page)
1. User logs in with Firebase Auth
2. Goes to Settings → Email Notifications
3. Enters notification email (defaults to their Firebase Gmail)
4. Toggles notifications on/off:
   - Low Stock Alerts
   - Daily Reports
   - Weekly Summary
5. Saves settings

### Automated Emails
- Each user receives ONLY their own data
- Emails sent to their configured notification email
- Respects their toggle preferences
- No setup needed after initial deployment

## ✅ Final Checklist

Before going live:

- [ ] Email environment variables added to Vercel
- [ ] Gmail App Password created and added
- [ ] Code deployed to Vercel
- [ ] Test email endpoint works
- [ ] Settings page loads correctly
- [ ] Users can save email preferences
- [ ] Choose cron strategy (Pro plan or external service)
- [ ] Test cron endpoints manually
- [ ] Set up scheduled execution (Vercel Cron or external)
- [ ] Monitor logs for first 24 hours
- [ ] Verify users receive test emails
- [ ] Document for team

## 🎯 Success Criteria

✅ Users can configure email notifications in Settings
✅ Test emails send successfully
✅ Cron endpoints respond without errors
✅ Scheduled tasks execute on time
✅ Each user receives personalized emails
✅ No errors in Vercel logs

## 🆘 Troubleshooting

**Problem:** Test email returns 500 error
- **Solution:** Check EMAIL_USER and EMAIL_PASS in Vercel env vars

**Problem:** "Email credentials not configured"
- **Solution:** Verify env vars are set for Production environment in Vercel

**Problem:** Cron jobs not running
- **Solution:** If on Hobby plan, use external cron service (cron-job.org)

**Problem:** Emails going to spam
- **Solution:** Normal for automated emails. Users should whitelist the sender

**Problem:** Wrong timezone for scheduled tasks
- **Solution:** Cron times are in UTC. Adjust schedule accordingly

## 🚀 You're All Set!

The email notification system is production-ready for Vercel. Just add the environment variables and deploy!
