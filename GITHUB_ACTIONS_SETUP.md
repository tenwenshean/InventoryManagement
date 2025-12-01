# GitHub Actions Setup for Email Cron Jobs

## Setup Instructions (5 Minutes)

### Step 1: Add GitHub Secrets
1. Go to your GitHub repository: `https://github.com/tenwenshean/InventoryManagement`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Add these 2 secrets:

**Secret 1: VERCEL_URL**
- Name: `VERCEL_URL`
- Value: `https://your-app-name.vercel.app` (get this from Vercel dashboard)

**Secret 2: CRON_SECRET**
- Name: `CRON_SECRET`
- Value: Generate a random string:
  ```powershell
  -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
  ```

### Step 2: Enable GitHub Actions
1. Go to your repo → **Actions** tab
2. If prompted, click **"I understand my workflows, go ahead and enable them"**
3. You should see **"Scheduled Email Notifications"** workflow

### Step 3: Add CRON_SECRET to Vercel
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `CRON_SECRET` = `same_value_as_github_secret`
3. Click "Save"
4. Redeploy your app

### Step 4: Test Manually
1. Go to GitHub → **Actions** tab
2. Click **"Scheduled Email Notifications"** workflow
3. Click **"Run workflow"** dropdown
4. Select job type (e.g., "low-stock")
5. Click **"Run workflow"**
6. Wait 10-20 seconds, then refresh
7. Click on the workflow run to see logs

## Schedule

The workflow runs automatically:
- **Every hour** - Low stock check
- **Daily at 9 AM UTC** - Daily report
- **Monday 9 AM UTC** - Weekly summary

**Note:** GitHub Actions uses UTC timezone. Adjust if needed:
- 9 AM EST = 14:00 UTC → Change to `0 14 * * *`
- 9 AM PST = 17:00 UTC → Change to `0 17 * * *`
- 9 AM SGT = 01:00 UTC → Change to `0 1 * * *`

## Benefits of GitHub Actions

✅ **100% Free** - 2,000 minutes/month on free plan (plenty for cron jobs)
✅ **Reliable** - GitHub's infrastructure
✅ **Integrated** - Already using GitHub for code
✅ **Easy Testing** - Manual trigger button
✅ **Good Logs** - Detailed execution history
✅ **No Extra Signup** - Use existing GitHub account

## Drawbacks

❌ Can't run more frequently than every 5 minutes
❌ Jobs may be delayed during high load
❌ Requires GitHub account (but you already have one!)

## Comparison

| Feature | cron-job.org | GitHub Actions |
|---------|--------------|----------------|
| Cost | FREE | FREE |
| Precision | 1 minute | 5 minutes |
| Reliability | High | Medium-High |
| Setup | External site | Same repo |
| Monthly Limit | Unlimited | 2,000 minutes |
| Manual Testing | ✅ Easy | ✅ Easy |

## Recommended: Use Both!

**Primary:** cron-job.org (more reliable, better timing)
**Backup:** GitHub Actions (redundancy if cron-job.org fails)

They won't conflict - the cron endpoints can handle multiple calls safely.

## Monitoring

View execution history:
1. Go to Actions tab
2. Click "Scheduled Email Notifications"
3. See all past runs with status ✅ or ❌
4. Click any run to see detailed logs

## Troubleshooting

**Workflow not running:**
- Check if Actions are enabled in repo settings
- Verify secrets are added correctly

**Jobs fail with 401:**
- CRON_SECRET mismatch between GitHub and Vercel
- Make sure both have the exact same value

**Jobs succeed but no emails:**
- Check Vercel function logs
- Verify users have toggles enabled
- Confirm notification email is set

## Next Steps

Choose one (or both!):

**Option A: cron-job.org** (Recommended)
- See `FREE_CRON_SETUP.md`
- Better timing precision
- Dedicated cron service

**Option B: GitHub Actions**
- Already set up in `.github/workflows/cron-jobs.yml`
- Just add secrets and you're done
- Integrated with your repo

**Option C: Both**
- Maximum reliability
- Redundancy if one fails
- No conflicts
