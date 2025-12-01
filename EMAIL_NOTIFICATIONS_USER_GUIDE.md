# 📧 Email Notifications - User Guide

## What You'll Receive

### 🔴 Low Stock Alerts (Instant)
Get notified when products need restocking
- **When**: Checked every hour
- **Frequency**: Max once per day
- **Contains**: List of products below threshold with current stock levels

### 📊 Daily Reports (9:00 AM)
Yesterday's business summary
- **When**: Every morning at 9:00 AM
- **Contains**: 
  - Total orders and items sold
  - Total revenue
  - Top 5 selling products
  - Current low stock count

### 📈 Weekly Summaries (Monday 9:00 AM)
Comprehensive weekly performance
- **When**: Every Monday at 9:00 AM
- **Contains**:
  - Previous week's sales overview
  - Average order value
  - Top 10 products
  - Inventory status (total, low stock, out of stock)

## How to Enable

### Step 1: Open Settings
Click the gear icon in the sidebar or navigate to `/settings`

### Step 2: Scroll to Email Notifications
Find the "Email Notifications" section (with mail icon)

### Step 3: Enter Your Email
Type the email address where you want to receive notifications

### Step 4: Toggle What You Want
- ✅ **Low Stock Alerts** - Get instant alerts when inventory is low
- ✅ **Daily Reports** - Receive daily business summaries
- ✅ **Weekly Summary** - Get comprehensive weekly reports

### Step 5: Save Changes
Click the "Save Changes" button at the top of the page

## 💡 Tips

### Best Practices
- Use a monitored email address (check it regularly)
- Enable Low Stock Alerts to never run out of inventory
- Daily Reports help track day-to-day performance
- Weekly Summaries are great for business planning

### Email Examples

**Low Stock Alert:**
```
⚠️ Low Stock Alert

The following products need restocking:

Product A: 5 units (Threshold: 10)
Product B: 2 units (Threshold: 15)
```

**Daily Report:**
```
📊 Daily Business Report - Monday, December 1, 2025

Total Orders: 15
Items Sold: 42
Total Revenue: $1,250.50
Low Stock Items: 3

Top Selling Products:
1. Product A - 10 units - $500.00
2. Product B - 8 units - $400.00
```

**Weekly Summary:**
```
📈 Weekly Business Summary - Nov 25 - Dec 1, 2025

Total Orders: 48
Items Sold: 156
Total Revenue: $5,823.75
Average Order Value: $121.33

Inventory Status:
Total Products: 125
Low Stock: 8
Out of Stock: 2

Top Products This Week:
1. Product A - 35 units - $1,750.00
```

## 🔧 Troubleshooting

### Not Receiving Emails?

1. **Check spam folder** - Sometimes automated emails go to spam
2. **Verify email address** - Make sure it's typed correctly in Settings
3. **Check toggles** - Ensure the notifications you want are enabled
4. **Wait for scheduled time** - Daily/Weekly emails only send at specific times
5. **Contact admin** - If still not working, email system may need configuration

### Wrong Email Address?

1. Go to Settings
2. Update the email address
3. Click "Save Changes"
4. Next scheduled email will go to new address

### Too Many Emails?

1. Go to Settings
2. Turn off unwanted notification types
3. Click "Save Changes"

### Want to Test?

Ask your system administrator to send a test email using the API endpoint

## ⏰ Delivery Schedule

| Notification Type | Schedule | Last Sent |
|------------------|----------|-----------|
| Low Stock Alerts | Every hour (max 1/day) | When threshold reached |
| Daily Reports | Every day at 9:00 AM | Yesterday's data |
| Weekly Summaries | Every Monday at 9:00 AM | Previous week's data |

## 🎯 What's Included

All emails include:
- Professional branding
- Clear, easy-to-read tables
- Color-coded metrics
- Mobile-responsive design
- Plain text fallback

## 📱 Mobile Friendly

All email templates are optimized for:
- Desktop email clients
- Mobile phones
- Tablets
- Webmail interfaces

## 🔒 Privacy & Security

- Only you receive your business data
- Emails sent securely via SMTP
- No data shared with third parties
- Unsubscribe anytime by disabling in Settings

## ❓ FAQ

**Q: Can I change the delivery time?**
A: Currently set to 9:00 AM. Contact admin for custom times.

**Q: Can I receive emails for specific products only?**
A: Low stock alerts cover all products below threshold. Set thresholds per product.

**Q: What if I have no sales?**
A: You'll still receive the report showing zero sales (if enabled).

**Q: Can multiple people receive the emails?**
A: One email per user. Each user sets their own notification email.

**Q: Will I get emails on weekends?**
A: Daily reports: Yes, every day. Weekly summaries: Mondays only.

## 📞 Support

Need help? 
- Check Settings to verify configuration
- Review this guide for common issues
- Contact your system administrator
- Check server logs for errors
