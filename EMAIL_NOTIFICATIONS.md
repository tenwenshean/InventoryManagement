# Email Notifications Setup Guide

## Overview

The inventory management system now includes a fully functional email notification system that sends:
- **Low Stock Alerts**: Instant notifications when products fall below their threshold
- **Daily Reports**: Daily business summaries with sales metrics and top products
- **Weekly Summaries**: Comprehensive weekly performance reports

## Features Implemented

### 1. Settings Page Updates
- ✅ Removed in-app notification settings
- ✅ Added email notification configuration
- ✅ Individual toggles for each notification type
- ✅ Notification email address field
- ✅ Descriptive text for each notification type

### 2. Email Service
- Professional HTML email templates
- Automatic fallback to plain text
- Support for Gmail and other SMTP providers
- Error handling and logging

### 3. Scheduled Tasks
- **Low Stock Check**: Runs every hour
  - Checks all products against their low stock thresholds
  - Sends alerts once per 24-hour period to avoid spam
  - Only sends if user has enabled low stock email alerts

- **Daily Report**: Runs every day at 9:00 AM
  - Yesterday's sales summary
  - Total orders and revenue
  - Top 5 selling products
  - Current low stock count
  - Only sends if user has enabled daily reports

- **Weekly Summary**: Runs every Monday at 9:00 AM
  - Previous week's performance overview
  - Sales metrics and trends
  - Top 10 selling products
  - Inventory status (total, low stock, out of stock)
  - Only sends if user has enabled weekly summaries

## Email Configuration

### For Gmail (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Create an App Password**:
   - Go to Google Account Settings
   - Security > 2-Step Verification
   - Scroll to "App passwords"
   - Generate a new app password for "Mail"
3. **Add to .env file**:
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

### For Other Email Providers

**Office 365/Outlook:**
```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

**SendGrid:**
```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=your-sendgrid-api-key
```

**Custom SMTP:**
```env
EMAIL_HOST=your-smtp-server.com
EMAIL_PORT=587
EMAIL_USER=your-username
EMAIL_PASS=your-password
```

## User Guide

### Configuring Email Notifications

1. Navigate to **Settings** page
2. Scroll to **Email Notifications** section
3. Enter your **Notification Email** address
4. Toggle the notifications you want:
   - **Low Stock Alerts**: Get instant alerts when inventory is low
   - **Daily Reports**: Receive daily business summaries (sent at 9 AM)
   - **Weekly Summary**: Get comprehensive weekly reports (Mondays at 9 AM)
5. Click **Save Changes**

### Testing Email Notifications

You can test the email functionality using the API endpoint:

```bash
# Test Low Stock Alert
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type": "low-stock", "email": "test@example.com"}'

# Test Daily Report
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type": "daily-report", "email": "test@example.com"}'

# Test Weekly Summary
curl -X POST http://localhost:5000/api/notifications/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"type": "weekly-summary", "email": "test@example.com"}'
```

## Email Templates

### Low Stock Alert
- Header with warning icon
- Table showing products below threshold
- Current stock vs. threshold comparison
- Professional red gradient design

### Daily Report
- Date and business name
- Key metrics cards:
  - Total Orders
  - Items Sold
  - Total Revenue
  - Low Stock Items
- Top 5 selling products table
- Revenue breakdown

### Weekly Summary
- Week date range
- Comprehensive sales overview
- Average order value
- Inventory status summary
- Top 10 products of the week
- Professional analytics design

## Scheduled Task Times

All times are based on the server's timezone:

| Task | Schedule | Description |
|------|----------|-------------|
| Low Stock Check | Every hour (`0 * * * *`) | Checks inventory levels |
| Daily Report | Daily at 9:00 AM (`0 9 * * *`) | Sends previous day's summary |
| Weekly Summary | Monday at 9:00 AM (`0 9 * * 1`) | Sends previous week's report |

## Troubleshooting

### Emails Not Sending

1. **Check Environment Variables**:
   - Ensure EMAIL_USER and EMAIL_PASS are set
   - Verify SMTP host and port are correct

2. **Check Server Logs**:
   - Look for "Email service initialized" message
   - Check for authentication errors

3. **Gmail-Specific Issues**:
   - Make sure you're using an App Password, not your account password
   - Enable "Less secure app access" if not using 2FA
   - Check if Gmail is blocking the connection

4. **Test Endpoint**:
   - Use the test endpoint to verify email configuration
   - Check response for specific error messages

### Scheduled Tasks Not Running

1. **Check Server Startup**:
   - Look for "Scheduled tasks initialized" in logs
   - Verify all three tasks are listed

2. **Manual Testing**:
   - Use test endpoints to verify email service works
   - Check that users have notifications enabled in settings

3. **Database Connection**:
   - Ensure database is accessible
   - Verify user settings are saving correctly

## Technical Details

### Files Added/Modified

**New Files:**
- `server/email-service.ts` - Email service with templates
- `server/scheduled-tasks.ts` - Cron job scheduler
- `.env.example` - Environment variable template
- `EMAIL_NOTIFICATIONS.md` - This documentation

**Modified Files:**
- `client/src/pages/settings.tsx` - Updated UI and state management
- `server/routes.ts` - Added test endpoint
- `server/index.ts` - Initialize scheduled tasks
- `package.json` - Added nodemailer and node-cron

### Dependencies Added
- `nodemailer` - Email sending library
- `@types/nodemailer` - TypeScript types
- `node-cron` - Task scheduling
- `@types/node-cron` - TypeScript types

## Security Considerations

1. **Never commit .env file** - Contains sensitive credentials
2. **Use App Passwords** - Don't use actual account passwords
3. **Email Rate Limiting** - Low stock alerts limited to once per 24 hours
4. **Authentication Required** - All endpoints require valid user token
5. **User-Specific Data** - Each user only receives their own data

## Future Enhancements

Potential improvements:
- Custom email templates editor
- Configurable notification times
- Email delivery status tracking
- Unsubscribe functionality
- Multi-language support
- SMS notifications integration
- Custom alert thresholds per product
- Email preview before saving settings

## Support

For issues or questions:
1. Check server logs for error messages
2. Verify email configuration in .env
3. Test with the provided API endpoints
4. Ensure user settings are saved correctly
