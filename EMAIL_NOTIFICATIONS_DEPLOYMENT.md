# Email Notifications - Production Deployment Checklist

## ✅ Pre-Deployment Verification

### 1. Code Files Updated
- ✅ `client/src/pages/settings.tsx` - Email notification UI with toggles
- ✅ `server/email-service.ts` - Email service with HTML templates
- ✅ `server/scheduled-tasks.ts` - Cron jobs for local development
- ✅ `server/routes.ts` - Test email endpoint with per-user data
- ✅ `api/index.js` - Vercel serverless functions with complete implementation

### 2. Email Templates
All three email types have professional HTML templates:
- ✅ Low Stock Alert (`generateLowStockEmail`)
- ✅ Daily Report (`generateDailyReportEmail`)
- ✅ Weekly Summary (`generateWeeklySummaryEmail`)

### 3. Per-User Data Filtering
All endpoints correctly filter by `userId`:
- ✅ Low stock products - queries `WHERE userId == req.user.uid`
- ✅ Daily reports - fetches orders for specific user
- ✅ Weekly summaries - fetches orders and products for specific user

## 🚀 Vercel Deployment Steps

### Step 1: Environment Variables
Add these to your Vercel project settings (Project Settings → Environment Variables):

```env
# Email Configuration (Required)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_sender_email@gmail.com
EMAIL_PASS=your_gmail_app_password

# Firebase (Required - already configured)
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY=your_private_key

# Optional: Cron Security
CRON_SECRET=your_random_secret_key
```

### Step 2: Verify Vercel Configuration
Check `vercel.json` has:

```json
{
  "crons": [
    {
      "path": "/api/cron/low-stock-check",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/daily-report",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 9 * * 1"
    }
  ]
}
```

### Step 3: Deploy to Vercel
```bash
git add .
git commit -m "Add email notification system"
git push origin main
```

Vercel will automatically deploy.

### Step 4: Set Up Cron Jobs (Choose One FREE Option)

⚠️ **Vercel Cron requires Pro plan ($20/month)**. Use one of these FREE alternatives instead:

#### **Option A: cron-job.org (Recommended - 100% Free)**
- ✅ Most reliable timing
- ✅ Unlimited jobs
- ✅ Easy setup (5 minutes)
- ✅ Great monitoring dashboard

**Setup:** See `FREE_CRON_SETUP.md` for detailed instructions

Quick setup:
1. Sign up at [cron-job.org](https://cron-job.org) (free)
2. Create 3 jobs pointing to your Vercel endpoints:
   - `https://your-app.vercel.app/api/cron/low-stock-check` (hourly)
   - `https://your-app.vercel.app/api/cron/daily-report` (daily 9 AM)
   - `https://your-app.vercel.app/api/cron/weekly-summary` (Monday 9 AM)
3. Add header: `x-cron-secret: your_secret_key`
4. Test with "Execute now" button

#### **Option B: GitHub Actions (100% Free)**
- ✅ Integrated with your repo
- ✅ 2,000 free minutes/month
- ✅ Easy manual testing
- ✅ Already configured!

**Setup:** See `GITHUB_ACTIONS_SETUP.md` for detailed instructions

Quick setup:
1. Add GitHub secrets: `VERCEL_URL` and `CRON_SECRET`
2. Enable Actions in your repo
3. Workflow file already exists: `.github/workflows/cron-jobs.yml`
4. Test manually from Actions tab

#### **Option C: Both (Maximum Reliability)**
Use both services for redundancy. They won't conflict!

## 🧪 Testing on Production

### 1. Test Settings Page
1. Go to `https://your-domain.vercel.app/settings`
2. Enter notification email address
3. Enable email toggles
4. Click "Save Changes"
5. Verify settings saved (check browser console for API response)

### 2. Verify Email Sending Works
Since test buttons are removed, you can manually test using curl:

**Test Low Stock Alert:**
```bash
curl -X POST https://your-domain.vercel.app/api/cron/low-stock-check \
  -H "x-cron-secret: your_secret_key" \
  -H "Content-Type: application/json"
```

**Test Daily Report:**
```bash
curl -X POST https://your-domain.vercel.app/api/cron/daily-report \
  -H "x-cron-secret: your_secret_key" \
  -H "Content-Type: application/json"
```

**Test Weekly Summary:**
```bash
curl -X POST https://your-domain.vercel.app/api/cron/weekly-summary \
  -H "x-cron-secret: your_secret_key" \
  -H "Content-Type: application/json"
```

### 3. Check Vercel Logs
- Go to Vercel Dashboard → Your Project → Functions
- Click on the cron function to view logs
- Look for "[CRON]" prefixed messages
- Verify "X emails sent" in response

## 📧 Email Frequency Schedule

| Email Type | Frequency | Schedule | Condition |
|------------|-----------|----------|-----------|
| Low Stock Alert | Every hour | `0 * * * *` | Only if products are low in stock |
| Daily Report | Once daily | `0 9 * * *` (9 AM) | Only if toggle enabled |
| Weekly Summary | Weekly | `0 9 * * 1` (Mon 9 AM) | Only if toggle enabled |

**Important Notes:**
- Low stock alerts have 24-hour cooldown (won't spam)
- All emails only send if user has enabled the specific toggle
- All emails require valid notification email address
- Each user only receives emails about their own products/data

## 🔒 Security

### CRON_SECRET (Optional but Recommended)
Add to Vercel environment variables to prevent unauthorized cron calls:

```env
CRON_SECRET=your_random_long_string_here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```

### Gmail App Password Setup
1. Enable 2-Factor Authentication on Gmail
2. Go to Google Account → Security → 2-Step Verification → App Passwords
3. Generate new app password for "Mail"
4. Use this password in `EMAIL_PASS` (not your regular Gmail password)

## 🐛 Troubleshooting

### Emails Not Sending
1. Check Vercel logs for errors
2. Verify EMAIL_* environment variables are set correctly
3. Test Gmail credentials locally first
4. Check spam folder in recipient inbox
5. Verify user has toggle enabled in settings
6. Ensure notification email is entered in settings

### Cron Jobs Not Running
**If on Vercel Pro:**
- Check Vercel Dashboard → Deployments → Cron Logs
- Verify cron schedule in `vercel.json`

**If on Free Plan:**
- Check external cron service (cron-job.org) logs
- Verify URL is correct (use production domain)
- Check `x-cron-secret` header is included

### Wrong User Data Showing
This should be fixed! All queries now filter by `userId`:
```javascript
.where('userId', '==', user.uid)
```

If still seeing wrong data:
- Check Vercel deployment was successful
- Verify latest code is deployed (check git commit hash)
- Clear Firestore cache if needed

## ✅ Final Verification Checklist

Before marking as complete:

- [ ] Environment variables added to Vercel
- [ ] Code deployed to Vercel successfully
- [ ] Settings page loads and saves correctly
- [ ] Email credentials tested (sent test email)
- [ ] Cron jobs configured (Vercel Pro or external service)
- [ ] Verified emails show per-user data only
- [ ] Checked spam folder for test emails
- [ ] Documented cron schedule for team
- [ ] Set up monitoring/alerts for failed emails (optional)

## 📚 Related Documentation

- `EMAIL_NOTIFICATIONS.md` - Complete technical documentation
- `EMAIL_NOTIFICATIONS_QUICKSTART.md` - Quick start guide
- `EMAIL_NOTIFICATIONS_USER_GUIDE.md` - End-user instructions
- `VERCEL_EMAIL_SETUP.md` - Vercel-specific setup
- `.env.example` - Environment variable template

## 🎉 Success Criteria

Email notification system is fully deployed when:
1. ✅ Users can configure email settings
2. ✅ Low stock alerts send automatically (hourly check)
3. ✅ Daily reports arrive at 9 AM (if enabled)
4. ✅ Weekly summaries arrive Monday 9 AM (if enabled)
5. ✅ Each user only sees their own data
6. ✅ Emails have professional HTML formatting
7. ✅ All emails arrive in inbox (not spam)
