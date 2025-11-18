# Production Firebase Fix - Environment Variables Setup

## Problem
Your app works locally but fails in production (Vercel) with 500 errors because Firebase Admin is not properly initialized. The error "FUNCTION_INVOCATION_FAILED" indicates the serverless function cannot connect to Firebase.

## Root Cause
Missing or improperly configured Firebase environment variables in your Vercel project settings.

## Solution

### Step 1: Get Your Firebase Credentials

You need your Firebase service account credentials from `firebase-key.json`. This file should contain:
- `project_id`
- `client_email`
- `private_key`

### Step 2: Add Environment Variables to Vercel

Go to your Vercel project settings and add the following environment variables:

#### Option A: Individual Environment Variables (RECOMMENDED)

Add these 3 separate environment variables:

1. **FIREBASE_PROJECT_ID**
   - Value: `your-project-id` (from firebase-key.json)
   - Example: `inventory-management-12345`

2. **FIREBASE_CLIENT_EMAIL**
   - Value: `your-service-account-email` (from firebase-key.json)
   - Example: `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`

3. **FIREBASE_PRIVATE_KEY**
   - Value: The entire private key from firebase-key.json INCLUDING the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
   - **IMPORTANT**: Make sure to include the ACTUAL newline characters, not `\n` text
   - Example:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASC...
   (many lines)
   ...
   -----END PRIVATE KEY-----
   ```

#### Option B: Single JSON Environment Variable (Alternative)

Add one environment variable:

**FIREBASE_SERVICE_ACCOUNT**
- Value: The entire contents of your `firebase-key.json` file as a single-line JSON string
- Example: `{"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}`

### Step 3: Configure Environment Variables in Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click on **Settings** tab
4. Click on **Environment Variables** in the left sidebar
5. For each variable:
   - Enter the **Name** (e.g., `FIREBASE_PROJECT_ID`)
   - Enter the **Value**
   - Select **Production**, **Preview**, and **Development** environments
   - Click **Save**

### Step 4: Redeploy Your Application

After adding all environment variables:

1. Go to the **Deployments** tab
2. Click on the latest deployment
3. Click the **•••** menu (three dots)
4. Click **Redeploy**
5. Wait for the deployment to complete

### Step 5: Verify the Fix

1. Open your production URL
2. Open the browser console (F12)
3. Check if the API calls are successful
4. You should see your products loading without 500 errors

## Important Notes

### For FIREBASE_PRIVATE_KEY

If you're having issues with the private key:

1. **Copy the ENTIRE key** including the header and footer:
   ```
   -----BEGIN PRIVATE KEY-----
   ...your key content...
   -----END PRIVATE KEY-----
   ```

2. **Preserve newlines**: The private key must include actual newline characters. If copying from a JSON file, the key will have `\n` which need to be actual newlines in Vercel.

3. **Test in Vercel CLI** first if possible:
   ```bash
   vercel env add FIREBASE_PRIVATE_KEY
   ```
   Then paste the entire key when prompted.

### Common Mistakes to Avoid

❌ **Don't** copy just part of the private key
❌ **Don't** add quotes around the private key in Vercel
❌ **Don't** forget to select all environments (Production, Preview, Development)
❌ **Don't** forget to redeploy after adding variables

✅ **Do** include the full key with BEGIN/END markers
✅ **Do** make sure newlines are preserved
✅ **Do** redeploy after adding all variables
✅ **Do** check the Vercel deployment logs for any errors

## Troubleshooting

### Still Getting 500 Errors?

1. **Check Vercel Logs**:
   - Go to your deployment
   - Click on **Functions** tab
   - Click on the failing function
   - Check the logs for specific error messages

2. **Verify Environment Variables**:
   - Go to Settings > Environment Variables
   - Make sure all 3 variables are set for Production
   - Click on each to verify the values are correct

3. **Check Firebase Console**:
   - Make sure your Firebase project is active
   - Verify the service account has the correct permissions
   - Check if there are any API restrictions

4. **Test Locally First**:
   ```bash
   npm run dev
   ```
   If it works locally but not in production, it's definitely an environment variable issue.

## Alternative: Using Vercel CLI

You can also add environment variables using the Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Add environment variables
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY

# Redeploy
vercel --prod
```

## What Was Fixed in the Code

The updated `api/index.js` now:

1. ✅ Checks for individual environment variables first (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
2. ✅ Falls back to FIREBASE_SERVICE_ACCOUNT JSON if individual vars aren't found
3. ✅ Properly handles escaped newlines in private keys (`\\n` → `\n`)
4. ✅ Provides detailed error logging to help debug Firebase initialization issues
5. ✅ Validates that all required fields are present before attempting initialization

## Next Steps

After setting up the environment variables and redeploying:

1. Test all major features:
   - ✓ Login/Authentication
   - ✓ Product listing
   - ✓ Product creation
   - ✓ Dashboard stats
   - ✓ Categories
   - ✓ Checkout process

2. Monitor the production logs for any remaining issues

3. If you still see errors, check the Vercel function logs for the specific Firebase error message

## Need Help?

If you're still experiencing issues after following these steps:

1. Check the Vercel deployment logs for the specific error message
2. Verify your firebase-key.json file is valid and from the correct Firebase project
3. Make sure your Firebase project is on a paid plan if you're making many API calls
4. Contact support with the specific error message from the Vercel logs
