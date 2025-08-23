# BrightData Two-Phase Architecture Setup

## Overview

The BrightData integration now uses a two-phase architecture to separate scraping from processing:

1. **Phase 1 (Collection)**: Triggers BrightData collections without waiting for results
2. **Phase 2 (Processing)**: Separate worker processes ready snapshots asynchronously

This approach ensures:

- No timeouts during collection
- Recovery of failed/missed snapshots
- Reprocessing capability for historical data
- Cost-effective reuse of existing snapshots

## Architecture Components

### Database Table

- `brightdata_snapshots` - Tracks all BrightData collections
  - Stores snapshot IDs, status, creator URLs, and processing results
  - Enables recovery of unprocessed data

### Workers

1. **Creator Processor** (`lib/queue/workers/creator-processor.ts`)
   - Triggers BrightData collections for LinkedIn profiles
   - Saves snapshot IDs to database
   - Does NOT wait for results

2. **BrightData Processor** (`lib/queue/workers/brightdata-processor.ts`)
   - Processes ready snapshots
   - Downloads data and stores in Supabase
   - Handles retries for snapshots still running

### API Endpoints

- `/api/cron/process-brightdata-snapshots` - Cron endpoint to queue pending snapshots
- `/api/test-brightdata-recovery` - Test endpoint to check snapshot status

## Cron Job Setup (cron-job.org)

### 1. Create New Cron Job

1. Go to [cron-job.org](https://cron-job.org)
2. Sign in to your account
3. Click "CREATE CRONJOB"

### 2. Configure the Job

**Title**: Process BrightData Snapshots

**URL**:

```
https://your-app-domain.railway.app/api/cron/process-brightdata-snapshots
```

**Schedule**:

- Select "Every 30 minutes" (or custom schedule)
- Or use custom settings:
  - Minutes: `*/30` (every 30 minutes)
  - Hours: `*`
  - Days: `*`
  - Months: `*`
  - Weekdays: `*`

**Request Method**: GET

**Request Headers**:

```
Authorization: Bearer YOUR_CRON_SECRET
```

(Replace YOUR_CRON_SECRET with the value from your environment variables)

### 3. Advanced Settings

- **Timeout**: 30 seconds
- **Notify on Failure**: Enable and add your email
- **Save Responses**: Enable for debugging

### 4. Test & Enable

1. Click "TEST RUN" to verify it works
2. Check the response - should show snapshots queued
3. Enable the cron job

## Manual Operations

### Recover Historical Snapshots

Run the recovery script to process any unprocessed historical data:

```bash
npx tsx scripts/recover-brightdata-snapshots.ts
```

This will:

1. Fetch all available snapshots from BrightData
2. Check which ones are already in the database
3. Process any new snapshots found
4. Match content to creators when possible

### Check Snapshot Status

Visit the test endpoint to see current status:

```
https://your-app-domain.railway.app/api/test-brightdata-recovery
```

### Manually Trigger Processing

To manually process pending snapshots:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app-domain.railway.app/api/cron/process-brightdata-snapshots
```

## Environment Variables Required

```env
# BrightData API
BRIGHTDATA_API_KEY=your_brightdata_api_key

# Cron Authentication
CRON_SECRET=your_secure_cron_secret

# Supabase (already configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Redis (already configured)
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

## How It Works

1. **Creator Processing**:
   - When a creator with LinkedIn is processed
   - System triggers BrightData collection
   - Snapshot ID is saved to database with status "pending"
   - Worker completes immediately (no waiting)

2. **Snapshot Processing** (via cron job):
   - Cron job runs every 30 minutes
   - Finds all pending/ready snapshots
   - Queues them for processing
   - Worker checks snapshot status
   - If ready: downloads data, transforms, stores in Supabase
   - If still running: retries with exponential backoff
   - If failed: marks as failed for manual review

3. **Recovery**:
   - Can fetch historical snapshots from BrightData
   - Processes any that aren't in database
   - Matches content to creators when possible

## Monitoring

### Check Processing Status

```sql
-- View snapshot status summary
SELECT
  status,
  COUNT(*) as count,
  SUM(posts_retrieved) as total_posts
FROM brightdata_snapshots
GROUP BY status;

-- View recent snapshots
SELECT
  snapshot_id,
  status,
  posts_retrieved,
  created_at,
  processed_at
FROM brightdata_snapshots
ORDER BY created_at DESC
LIMIT 20;

-- View failed snapshots
SELECT * FROM brightdata_snapshots
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Worker Logs

- Check Railway logs for worker processing
- Look for "[BrightData Processor]" entries
- Monitor for snapshot processing success/failure

## Troubleshooting

### Snapshots Stuck in "Pending"

- Check if cron job is running
- Verify worker is deployed and running
- Check Redis connection
- Look for errors in worker logs

### Failed Snapshots

- Check the `error` field in database
- Common issues:
  - Snapshot not found (404) - may have expired
  - Bad request (400) - invalid snapshot ID
  - Timeout - snapshot took too long to complete

### Missing Data

- Run recovery script to fetch historical snapshots
- Check BrightData dashboard for collection status
- Verify creator URLs are correct LinkedIn profile URLs

## Benefits

1. **Resilient**: Collections aren't lost if processing fails
2. **Efficient**: No blocking/waiting during collection
3. **Recoverable**: Can reprocess any snapshot anytime
4. **Cost-effective**: Reuses existing snapshots
5. **Scalable**: Can process multiple snapshots in parallel
6. **Debuggable**: Full audit trail in database
