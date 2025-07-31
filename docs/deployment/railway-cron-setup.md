# Railway Cron Job Setup

## Overview

Since Railway doesn't have built-in cron job support like Vercel, you have several options for scheduling your content fetching tasks.

## Option 1: Railway Cron (Recommended)

Railway now supports cron jobs through their CLI. This is the simplest approach if you want to keep everything within Railway.

### Setup Steps:

1. **Install Railway CLI** (if not already installed):

   ```bash
   npm install -g @railway/cli
   ```

2. **Create a cron service in your Railway project**:

   ```bash
   railway run railway cron create --name "fetch-content" --schedule "0 */6 * * *" --command "curl -X GET https://your-app.railway.app/api/cron/fetch-content -H 'Authorization: Bearer YOUR_CRON_SECRET'"
   ```

3. **Set your CRON_SECRET environment variable** in Railway:
   - Go to your Railway project dashboard
   - Navigate to Variables
   - Add: `CRON_SECRET=your-secure-random-string-here`

## Option 2: External Cron Service (Alternative)

Use a dedicated cron job service for more flexibility and monitoring:

### Recommended Services:

1. **Cron-job.org** (Free tier available)
   - Create account at https://cron-job.org
   - Add new cron job with:
     - URL: `https://your-app.railway.app/api/cron/fetch-content`
     - Schedule: Every 6 hours
     - Request method: GET
     - Headers: `Authorization: Bearer YOUR_CRON_SECRET`

2. **EasyCron** (Free tier: 1 cron job)
   - Similar setup to cron-job.org
   - Better monitoring and alerting

3. **Uptime Robot** (Free tier: 50 monitors)
   - Can be used as a cron service
   - Includes uptime monitoring

## Option 3: GitHub Actions (Free for public repos)

Create `.github/workflows/fetch-content.yml`:

```yaml
name: Fetch Content
on:
  schedule:
    - cron: '0 */6 * * *' # Every 6 hours
  workflow_dispatch: # Allow manual trigger

jobs:
  fetch:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger content fetch
        run: |
          curl -X GET ${{ secrets.APP_URL }}/api/cron/fetch-content \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub:

- `APP_URL`: Your Railway app URL
- `CRON_SECRET`: Your cron secret

## Security Configuration

1. **Always set CRON_SECRET in production**:

   ```
   CRON_SECRET=your-very-secure-random-string-here
   ```

2. **Generate a secure secret**:
   ```bash
   openssl rand -base64 32
   ```

## Testing Your Cron Endpoint

Test locally:

```bash
curl -X GET http://localhost:3000/api/cron/fetch-content
```

Test in production (with auth):

```bash
curl -X GET https://your-app.railway.app/api/cron/fetch-content \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring

1. **Add logging** to track cron executions
2. **Set up alerts** for failed runs
3. **Monitor the `/api/cron/fetch-content` response** for stats

## Recommended Schedule

- **Every 6 hours**: `0 */6 * * *` (Good balance)
- **Every 4 hours**: `0 */4 * * *` (More frequent updates)
- **Every 12 hours**: `0 */12 * * *` (Conservative approach)

Choose based on:

- Your API rate limits (YouTube, Apify)
- Content update frequency
- Cost considerations
