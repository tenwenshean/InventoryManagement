# Quick Deployment Commands

## 🚀 Step-by-Step Deployment

### 1️⃣ Deploy Firestore Indexes (Do This FIRST!)

```powershell
firebase deploy --only firestore:indexes
```

### 2️⃣ Wait for Indexes to Build

Check status at: https://console.firebase.google.com
- Navigate to: Firestore Database → Indexes
- Wait until all indexes show "Enabled" (not "Building")
- This can take 5-30 minutes

### 3️⃣ Commit and Push Code

```powershell
git add .
git commit -m "Fix: Resolve accounting entries Firestore query issues for production"
git push origin main
```

### 4️⃣ Test Production

- Open your production site
- Navigate to Accounting page
- Verify entries load correctly
- Check browser console for errors (F12)

---

## 📋 Quick Test Commands

### Test Locally Before Deploying
```powershell
npm run dev
```
Then visit: http://localhost:5000

### Check Git Status
```powershell
git status
git diff
```

### View Current Firebase Project
```powershell
firebase projects:list
firebase use
```

---

## 🔍 Troubleshooting Commands

### If Indexes Fail
```powershell
firebase deploy --only firestore:indexes --force
```

### Check Firebase Login
```powershell
firebase login
firebase login --reauth
```

### View Production Logs (if using Firebase Hosting)
```powershell
firebase hosting:channel:list
```

---

## ⚠️ Important Notes

1. **ALWAYS deploy indexes BEFORE pushing code**
2. **WAIT for indexes to finish building** (check Firebase Console)
3. **Test locally first** with `npm run dev`
4. **Check browser console** after deployment for errors

---

## 📞 Need Help?

Refer to:
- `ACCOUNTING_DATABASE_FIX.md` - Detailed technical explanation
- `DEPLOYMENT_CHECKLIST.md` - Complete deployment workflow
