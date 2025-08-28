# External Cron Job Setup

This document describes how to set up external cron jobs for the Daily News application on Railway.

## Required Cron Jobs

### 1. Generate AI News Summary

- **Schedule**: Daily at 8:25 AM ET (13:25 UTC)
- **URL**: `https://your-app.railway.app/api/cron/generate-news-summary`
- **Method**: GET
- **Headers**:
  ```
  Authorization: Bearer YOUR_CRON_SECRET
  ```
- **Purpose**: Generates AI-powered news summaries for all lounges

### 2. Send Daily Digest (Existing)

- **Schedule**: Daily at 8:30 AM ET (13:30 UTC)
- **URL**: `https://your-app.railway.app/api/cron/send-daily-digest`
- **Method**: GET
- **Headers**:
  ```
  Authorization: Bearer YOUR_CRON_SECRET
  ```
- **Purpose**: Sends email digests with AI summaries to all subscribed users

### 3. Other Existing Cron Jobs

- **Queue Creators**: As configured
- **Process BrightData Snapshots**: As configured
- **Score Relevancy**: As configured
- **Analyze Relevancy**: As configured

## Setup Instructions

### Using Cron-job.org (Free)

1. Visit [cron-job.org](https://cron-job.org)
2. Create a free account
3. Create a new cron job:
   - **Title**: "Generate AI News Summary"
   - **URL**: `https://your-app.railway.app/api/cron/generate-news-summary`
   - **Schedule**:
     - Time: 13:25 (UTC)
     - Days: Every day
   - **Advanced**:
     - Request Method: GET
     - Request Headers: `Authorization: Bearer YOUR_CRON_SECRET`

### Using EasyCron

1. Visit [easycron.com](https://www.easycron.com)
2. Sign up for free account
3. Add Cron Job:
   - **URL**: `https://your-app.railway.app/api/cron/generate-news-summary`
   - **Cron Expression**: `25 13 * * *` (13:25 UTC daily)
   - **HTTP Method**: GET
   - **HTTP Headers**:
     ```
     Authorization: Bearer YOUR_CRON_SECRET
     ```

### Using Uptime Robot

1. Visit [uptimerobot.com](https://uptimerobot.com)
2. Create account
3. Add New Monitor:
   - **Monitor Type**: HTTP(s)
   - **URL**: `https://your-app.railway.app/api/cron/generate-news-summary`
   - **Monitoring Interval**: 1440 minutes (24 hours)
   - **HTTP Method**: GET
   - **HTTP Headers**: `Authorization: Bearer YOUR_CRON_SECRET`

## Environment Variables

Make sure these are set in your Railway environment:

```env
CRON_SECRET=your-secure-random-string
OPENAI_API_KEY=your-openai-api-key
```

## Testing

You can manually trigger the cron jobs for testing:

```bash
# Test AI summary generation
curl -X GET https://your-app.railway.app/api/cron/generate-news-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test with specific lounge (POST method)
curl -X POST https://your-app.railway.app/api/cron/generate-news-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"loungeId": "uuid-here", "testMode": true}'
```

## Important Notes

1. **Timing**: The AI summary generation (8:25 AM ET) must run BEFORE the digest email (8:30 AM ET)
2. **Authentication**: Always include the `Authorization` header with your CRON_SECRET
3. **Monitoring**: Set up alerts in your cron service to notify you if jobs fail
4. **Rate Limits**: OpenAI API has rate limits - monitor usage in OpenAI dashboard
5. **Costs**: Each summary generation uses ~150-200 OpenAI tokens

## Cron Expression Reference

For services that use cron expressions:

- `25 13 * * *` = 8:25 AM ET (13:25 UTC) daily
- `30 13 * * *` = 8:30 AM ET (13:30 UTC) daily

Convert times based on your timezone:

- ET to UTC: Add 5 hours (EST) or 4 hours (EDT)
- PT to UTC: Add 8 hours (PST) or 7 hours (PDT)
