# 🚚 Easy Parcel Quick Setup Guide

## ⚡ 5-Minute Setup

### Step 1: Get Your API Key (2 minutes)
1. Go to https://www.easyparcel.com/
2. Sign up for a business account
3. Go to Settings → API
4. Copy your API key

### Step 2: Add to Environment (1 minute)

**If deploying to Vercel:**
```bash
# In Vercel Dashboard:
# Settings → Environment Variables → Add New

Name: EASYPARCEL_API_KEY
Value: [paste your API key]
```

**If running locally:**
```bash
# Add to .env file
EASYPARCEL_API_KEY=your_api_key_here
```

### Step 3: Complete Business Profile (2 minutes)
1. Login to your seller account
2. Go to **Settings**
3. Fill in **Business Address** (must include valid Malaysian postcode)
4. Save

### Step 4: Test It! (1 minute)
1. Go to **Orders** page
2. Click **Create Shipment** on any order
3. Select courier and create
4. Download and print waybill
5. Done! 🎉

## 📋 Checklist

- [ ] Easy Parcel account created
- [ ] API key obtained
- [ ] Environment variable `EASYPARCEL_API_KEY` added
- [ ] Application redeployed (if on Vercel)
- [ ] Business address completed in Settings
- [ ] Test shipment created successfully
- [ ] Waybill printed

## 🎯 Usage

### For Sellers:
1. **Orders page** → Click "Create Shipment"
2. Enter weight and select courier
3. Print waybill
4. Ship package

### For Customers:
1. **Profile page** → View orders
2. Click "Track Order" on shipped items
3. See real-time tracking updates

## 🆘 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| "Shipping service not configured" | Add EASYPARCEL_API_KEY to environment variables |
| "No courier services available" | Complete business address with valid postcode |
| Waybill won't open | Allow pop-ups in browser settings |
| Can't find API key | Login to Easy Parcel → Settings → API |

## 📞 Need Help?

- Check the full documentation: `EASYPARCEL_INTEGRATION.md`
- Easy Parcel Support: api@easyparcel.com
- Easy Parcel Docs: https://docs.easyparcel.com/

---

**That's it! You're ready to start shipping with Easy Parcel! 📦✨**
