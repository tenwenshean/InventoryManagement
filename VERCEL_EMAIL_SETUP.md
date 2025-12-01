# Vercel Production Deployment - Email Notifications

## ✅ What's Been Configured

### 1. Email Service
- ✅ Email sending function added to `api/index.js`
- ✅ Support for Gmail, Office 365, SendGrid, and custom SMTP
- ✅ Professional HTML email templates
- ✅ Test endpoint available: `POST /api/notifications/test-email`

### 2. API Route
- ✅ `/api/notifications/test-email` endpoint deployed
- ✅ Requires Firebase authentication
- ✅ Tests low stock alerts, daily reports, and weekly summaries

## 🔧 Vercel Environment Variables Setup

You must add these to your Vercel project:

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add Email Variables:**
   ```
   EMAIL_HOST = smtp.gmail.com
   EMAIL_PORT = 587
   EMAIL_USER = your-email@gmail.com
   EMAIL_PASS = your-app-password
   ```

3. **Already Configured (verify these exist):**
   - FIREBASE_PROJECT_ID
   - FIREBASE_CLIENT_EMAIL
   - FIREBASE_PRIVATE_KEY
   - GEMINI_API_KEY
   - STRIPE_SECRET_KEY

## ⚠️ Important: Scheduled Tasks on Vercel

**Vercel Serverless Functions DO NOT support cron jobs by default.**

### Option 1: Vercel Cron Jobs (Recommended)
Use Vercel's built-in cron feature:

1. **Create `vercel.json` cron configuration:**
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

2. **Create separate cron endpoints in `api/index.js`** (I'll add these next)

### Option 2: External Cron Service
Use services like:
- **Cron-job.org** (free)
- **EasyCron** (free tier)
- **GitHub Actions** (free)

Configure them to call your API endpoints:
- `POST https://your-app.vercel.app/api/cron/low-stock-check`
- `POST https://your-app.vercel.app/api/cron/daily-report`
- `POST https://your-app.vercel.app/api/cron/weekly-summary`

### Option 3: Separate Backend Server
Keep the `server/scheduled-tasks.ts` running on a separate always-on server (Heroku, Railway, etc.)

## 📧 How Email Works in Production

### For Test Emails (Already Working):
```bash
curl -X POST https://your-app.vercel.app/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer FIREBASE_TOKEN" \
  -d '{"type": "low-stock", "email": "test@example.com"}'
```

### For Automated Emails:
1. **Low Stock Alerts**: Triggered by inventory updates (instant)
2. **Daily/Weekly Reports**: Require cron setup (see options above)

## 🚀 Deployment Steps

1. **Add environment variables to Vercel**
2. **Deploy to Vercel** (email test endpoint will work)
3. **Choose cron strategy** (Option 1, 2, or 3 above)
4. **Test the endpoint** after deployment

## ✅ What Works Now

- ✅ Manual test emails via API endpoint
- ✅ Email configuration stored in user settings
- ✅ Settings page UI for email preferences
- ✅ Multi-user support (each user gets their own notifications)

## ⏳ What Needs Cron Setup

- ⏳ Automatic low stock checks (hourly)
- ⏳ Automatic daily reports (9 AM daily)
- ⏳ Automatic weekly summaries (Monday 9 AM)

## 🔐 Security Notes

- Email credentials stored in Vercel environment variables (encrypted)
- Not exposed to client-side code
- Each user only receives their own data
- Authentication required for all email endpoints

## 📝 Next Steps

1. Add EMAIL_* variables to Vercel
2. Deploy and test email endpoint
3. Choose and implement cron strategy
4. Test automated scheduled emails
5. Monitor Vercel function logs

## 💡 Recommended: Vercel Cron (Pro Plan)

If you have Vercel Pro:
- Built-in cron support
- No external dependencies
- Automatic retries
- Integrated monitoring

If using Vercel Hobby (free):
- Use external cron service (free options available)
- Or deploy scheduled tasks separately
