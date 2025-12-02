# 🧪 Testing Your Email Notification System

## Choose Your Testing Method

### ⭐ Method 1: HTML Test Page (EASIEST!)

**Perfect for both local and production testing with a nice UI**

1. **Open the test page:**
   - Double-click `test-email-tester.html` in this folder
   - Or drag it into your browser

2. **Get your auth token:**
   - Open your app in another tab
   - Log in
   - Press F12 → Console
   - Type: `localStorage.getItem('token')`
   - Copy the token

3. **Fill in the form:**
   - Select environment (Local or Production)
   - Paste your token
   - Enter your email
   - Click test buttons!

4. **Check your email** (including spam folder!)

---

### 🖥️ Method 2: PowerShell Script

**Interactive command-line testing**

1. **Run the script:**
   ```powershell
   .\test-emails.ps1
   ```

2. **Follow the prompts:**
   - Enter your email
   - Choose environment (local/production)
   - Paste your auth token
   - Tests will run automatically

3. **Check your email!**

---

### 📘 Method 3: Follow the Full Guide

Open `test-email-system.md` for comprehensive testing instructions including:
- Browser console commands
- Manual API testing
- Cron endpoint testing
- Troubleshooting tips

---

## 🎯 Quick Start (1 Minute Test)

**Fastest way to test:**

1. Open `test-email-tester.html` in your browser
2. Open your app, press F12, Console tab
3. Type: `localStorage.getItem('token')` and copy the result
4. Paste token in test page
5. Enter your email
6. Click "Test Daily Report"
7. Check your inbox!

---

## ✅ What You Should See

### In Your Email:

**Daily Report Email:**
- ✉️ Subject: "📊 Daily Business Report - [Date]"
- 📊 Sales statistics
- ⚠️ **Low Stock Alert section** (with product details)
- 📈 Top selling products

**Weekly Summary Email:**
- ✉️ Subject: "📈 Weekly Business Summary - [Date Range]"
- 📊 Weekly statistics
- ⚠️ **Low Stock Alert section** (with product details)
- 📦 Inventory status

---

## 🔍 Testing Checklist

- [ ] Test locally with HTML page
- [ ] Test production with HTML page
- [ ] Verify low stock section appears (add low stock products first!)
- [ ] Check emails arrive in inbox
- [ ] Test cron endpoints (optional)
- [ ] Verify on production (Vercel)

---

## 💡 Pro Tips

1. **Create test low stock products** before testing:
   - Go to Products → Add Product
   - Set Quantity: 5
   - Set Low Stock Threshold: 10
   - Save

2. **Check spam folder** - automated emails often go there first

3. **Use HTML tester** - it's the easiest and most visual

4. **Production testing** - make sure EMAIL_USER and EMAIL_PASS are set in Vercel env vars

---

## 🐛 Troubleshooting

### No email received?
- Check spam/junk folder
- Verify EMAIL_USER and EMAIL_PASS are set
- Check server logs for errors
- Wait 1-2 minutes (email delivery can be slow)

### "Unauthorized" error?
- Your token expired - log in again and get a fresh token
- Token not copied correctly - copy the entire value

### Low stock section not showing?
- You need products with quantity ≤ threshold
- Create a test product with low stock

---

## 🚀 Ready to Test?

**START HERE:** Open `test-email-tester.html` in your browser!

It's that simple! 🎉
