# 📱 Phone Authentication Setup Guide

## Step 1: Enable Phone Authentication in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **inventorymanagement-3005-b38a3**
3. Click **Authentication** in the left sidebar
4. Click **Sign-in method** tab
5. Find **Phone** in the list
6. Click **Enable**
7. Click **Save**

## Step 2: Add Authorized Domains (Important!)

Firebase Phone Auth only works on authorized domains. You need to add your domains:

1. In Firebase Console → **Authentication** → **Settings** tab
2. Scroll to **Authorized domains**
3. Add these domains:
   - `localhost` (for local development)
   - Your Vercel domain (e.g., `your-app.vercel.app`)
   - Any custom domains you use

## Step 3: Configure reCAPTCHA (Optional but Recommended)

### Option A: Use Invisible reCAPTCHA (Current Setup)
- Already configured in the code
- Works automatically
- No user interaction needed
- May require verification on first use

### Option B: Use Visible reCAPTCHA
If invisible reCAPTCHA doesn't work, you can switch to visible:

In `firebaseClient.ts`, change:
```typescript
const verifier = initRecaptcha("recaptcha-container", true); // true = visible
```

## Step 4: Test Phone Numbers (For Development)

To test without sending real SMS:

1. Firebase Console → **Authentication** → **Sign-in method**
2. Scroll to **Phone numbers for testing**
3. Click **Add phone number**
4. Add test numbers with codes:
   - Phone: `+1 650-555-3434`
   - Code: `123456`
   - Phone: `+60 12-345-6789`
   - Code: `654321`

## Step 5: Verify Setup

1. Restart your dev server: `npm run dev`
2. Go to `http://localhost:5000/customer`
3. Click **Login** button
4. You should see the reCAPTCHA widget (visible or invisible)
5. Enter a phone number
6. Click **Send Verification Code**
7. Check your phone for SMS (or use test number)

## Common Issues & Solutions

### Issue 1: "reCAPTCHA not initialized"
**Solution:** Make sure Phone Authentication is enabled in Firebase Console

### Issue 2: "auth/invalid-app-credential"
**Solution:** 
- Check that your domain is in the Authorized domains list
- For localhost, make sure `localhost` is added (not `127.0.0.1`)

### Issue 3: "auth/captcha-check-failed"
**Solution:**
- Clear browser cache
- Try using visible reCAPTCHA instead
- Check browser console for errors

### Issue 4: SMS not received
**Solution:**
- Verify phone number format: `+[country code][number]`
- Check Firebase Console → Authentication → Usage for quota limits
- Use test phone numbers for development

### Issue 5: "auth/quota-exceeded"
**Solution:**
- Firebase free tier has SMS limits
- Use test phone numbers for development
- Upgrade to Blaze plan for production

## Production Checklist

Before going live:

- [ ] Phone Authentication enabled in Firebase
- [ ] Production domain added to Authorized domains
- [ ] reCAPTCHA working correctly
- [ ] Test with real phone numbers
- [ ] SMS quota sufficient (upgrade plan if needed)
- [ ] Error handling tested
- [ ] User experience tested on mobile devices

## Need Help?

Check Firebase documentation:
- [Phone Authentication Guide](https://firebase.google.com/docs/auth/web/phone-auth)
- [reCAPTCHA Setup](https://firebase.google.com/docs/auth/web/phone-auth#web-version-9_2)

## Current Configuration

Your Firebase project:
- **Project ID:** inventorymanagement-3005-b38a3
- **Auth Domain:** inventorymanagement-3005-b38a3.firebaseapp.com
- **reCAPTCHA:** Invisible (can switch to visible)
- **Default Country:** Malaysia (+60)
