# Email Notifications - Quick Start

## What Was Changed

### ✅ Settings Page
- **Removed**: In-app notification toggles (sound, desktop)
- **Added**: Email notification configuration section
- **Features**:
  - Notification email address input
  - Low Stock Alerts toggle with description
  - Daily Reports toggle (sent at 9 AM)
  - Weekly Summary toggle (Mondays at 9 AM)
  - All settings are saved to both localStorage and Firestore

### ✅ Backend Services Created

1. **Email Service** (`server/email-service.ts`)
   - Professional HTML email templates
   - Three types of emails:
     - Low Stock Alerts
     - Daily Business Reports
     - Weekly Performance Summaries
   - Gmail-compatible (also works with other SMTP providers)

2. **Scheduled Tasks** (`server/scheduled-tasks.ts`)
   - Automated cron jobs:
     - Low stock check: Every hour
     - Daily reports: Every day at 9:00 AM
     - Weekly summaries: Every Monday at 9:00 AM
   - Respects user notification preferences

3. **Test API Endpoint** (`server/routes.ts`)
   - POST `/api/notifications/test-email`
   - Test all three email types before going live

## Setup Instructions

### 1. Configure Email (Required)

Add these to your `.env` file:

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**For Gmail:**
1. Enable 2-Factor Authentication
2. Go to: https://myaccount.google.com/apppasswords
3. Generate an "App Password" for Mail
4. Use that 16-character password in EMAIL_PASS

### 2. Restart Server

The scheduled tasks start automatically when the server starts.

### 3. Configure in Settings

1. Go to Settings page
2. Scroll to "Email Notifications"
3. Enter your notification email
4. Toggle on the notifications you want
5. Click "Save Changes"

## Testing

### Method 1: Using cURL

```bash
# Test Low Stock Alert
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"type": "low-stock", "email": "your-email@example.com"}'

# Test Daily Report
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"type": "daily-report", "email": "your-email@example.com"}'

# Test Weekly Summary
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{"type": "weekly-summary", "email": "your-email@example.com"}'
```

### Method 2: Using Postman/Insomnia

1. Create a POST request to `http://localhost:5000/api/notifications/test-email`
2. Add header: `Authorization: Bearer YOUR_FIREBASE_TOKEN`
3. Add JSON body:
   ```json
   {
     "type": "low-stock",
     "email": "your-email@example.com"
   }
   ```

## What Happens Automatically

Once configured:

- **Every Hour**: System checks for low stock products and sends alerts (max once per 24h per user)
- **Every Day at 9 AM**: Sends yesterday's business summary to users with daily reports enabled
- **Every Monday at 9 AM**: Sends last week's comprehensive summary to users with weekly reports enabled

## Files Modified

- `client/src/pages/settings.tsx` - Updated UI and state management
- `server/routes.ts` - Added test endpoint and email service import
- `server/index.ts` - Initialize scheduled tasks on startup
- `package.json` - Added nodemailer and node-cron dependencies

## Files Created

- `server/email-service.ts` - Email sending service
- `server/scheduled-tasks.ts` - Cron job scheduler
- `.env.example` - Environment variables template
- `EMAIL_NOTIFICATIONS.md` - Complete documentation
- `EMAIL_NOTIFICATIONS_QUICKSTART.md` - This file

## Troubleshooting

**Emails not sending?**
1. Check `.env` has EMAIL_USER and EMAIL_PASS
2. For Gmail, use App Password (not account password)
3. Check server logs for "Email service initialized"
4. Test with the API endpoint first

**Scheduled tasks not running?**
1. Check server logs for "Scheduled tasks initialized"
2. Verify server stays running (doesn't restart frequently)
3. Use test endpoint to verify email service works

**Need help?**
- See `EMAIL_NOTIFICATIONS.md` for detailed documentation
- Check server console for error messages
- Verify email credentials are correct

## Next Steps

1. Set up email credentials in `.env`
2. Restart the server
3. Test with the API endpoint
4. Configure your preferences in Settings
5. Wait for scheduled emails or trigger them manually for testing
