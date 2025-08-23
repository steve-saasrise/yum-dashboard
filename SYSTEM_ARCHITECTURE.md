# Lounge.ai System Architecture

## Overview

Lounge.ai (formerly Daily News) is a content aggregation platform that unifies content from multiple social media platforms into a single intelligent dashboard. The system uses a distributed architecture with queue-based processing to handle content fetching, AI summarization, and relevancy scoring at scale.

## Core Components

### 1. Web Application (Next.js)

- **Main deployment**: Runs on Railway as the primary web service
- **Framework**: Next.js 15.2.4 with App Router
- **Database**: Supabase PostgreSQL with Row Level Security
- **Cache**: Upstash Redis for session management and job queuing
- **Authentication**: Supabase Auth (magic links, OAuth, email/password)

### 2. Queue System (BullMQ + Redis)

- **Queue Infrastructure**: BullMQ with Upstash Redis
- **Purpose**: Handles asynchronous content fetching and processing
- **Implementation Date**: July 31, 2025
- **Key Queues**:
  - `creator-processing`: Processes individual creators
  - `content-fetch`: Fetches content from platforms
  - `ai-summary`: Generates AI summaries for content
  - `brightdata-processing`: Processes BrightData snapshots (Phase 2)

### 3. Worker Service

- **Separate deployment**: Runs as `queue-workers` service on Railway
- **Start command**: `npm run workers` (via `RAILWAY_SERVICE_TYPE=workers`)
- **Workers**:
  - **Creator Processor Worker**: Triggers content collection from all platforms
  - **Summary Processor Worker**: Generates AI summaries using OpenAI
  - **BrightData Processor Worker**: Processes LinkedIn snapshots asynchronously (Phase 2)

## Content Flow Architecture

### Step 1: Cron Job Trigger

```
cron-job.org → GET /api/cron/queue-creators (every X hours)
```

- External cron service calls the endpoint
- Authenticated via `CRON_SECRET` environment variable
- Completes within seconds (avoids 30-second timeout)

### Step 2: Creator Queueing

```
/api/cron/queue-creators → Redis Queue
```

- Fetches all active creators from database
- Queues each creator as a job in BullMQ
- Implements deduplication (skips already-queued creators)
- Returns immediately with queue statistics

### Step 3: Worker Processing

```
Worker Service → Process Queue Jobs
```

The separate worker deployment processes jobs:

1. **Creator Processor** (`lib/queue/workers/creator-processor.ts`):
   - Pulls jobs from `creator-processing` queue
   - For each creator, fetches URLs from `creator_urls` table
   - Processes each platform:
     - **RSS**: Direct parsing via RSS Parser
     - **YouTube**: YouTube Data API (with quota management)
     - **Twitter/X**: Apify Actor API
     - **Threads**: Apify Actor API
     - **LinkedIn**: Triggers BrightData collection (Phase 1 only)
   - Stores content in database (except LinkedIn)
   - Queues new content for AI summarization

2. **Summary Processor** (`lib/queue/workers/summary-processor.ts`):
   - Pulls jobs from `ai-summary` queue
   - Generates brief and detailed summaries using OpenAI
   - Updates content records with summaries

3. **BrightData Processor** (`lib/queue/workers/brightdata-processor.ts`):
   - Pulls jobs from `brightdata-processing` queue
   - Checks snapshot status via BrightData API
   - Downloads ready snapshots
   - Transforms and stores LinkedIn content
   - Retries if snapshot still running

### Step 4: Content Display

```
Dashboard → Supabase → Displayed to Users
```

- Content is fetched from database with relevancy scores
- Only scored content (relevancy_score >= 0) shown to users
- Infinite scroll with intersection observer
- Real-time updates when new content arrives

## Platform Integration Details

### Content Fetching Services

#### RSS Feeds

- **Service**: `RSSFetcher`
- **Library**: rss-parser
- **Limits**: 20 items per feed

#### YouTube

- **Service**: `YouTubeFetcher`
- **API**: YouTube Data API v3
- **Quota**: Limited by API quota
- **Storage**: Direct to Supabase with deduplication

#### Twitter/X

- **Service**: `ApifyFetcher`
- **API**: Apify Actor (Twitter Scraper)
- **Features**: Extracts quotes, retweets, media
- **Avatar extraction**: Updates creator avatars

#### Threads

- **Service**: `ApifyFetcher`
- **API**: Apify Actor (Threads Scraper)
- **Username extraction**: From URL pattern

#### LinkedIn (Two-Phase Architecture)

- **Service**: `BrightDataFetcher`
- **API**: BrightData Scraping Browser (Dataset ID: `gd_lyy3tktm25m4avu764`)
- **Phase 1 - Collection Trigger**:
  - Creator processor triggers collection without waiting
  - Snapshot ID saved to `brightdata_snapshots` table
  - Completes immediately (no timeout risk)
- **Phase 2 - Snapshot Processing**:
  - Separate cron job (`/api/cron/process-brightdata-snapshots`) runs every 30 minutes
  - BrightData processor worker downloads ready snapshots
  - Retries with exponential backoff if snapshot still running
  - Stores content in database when complete
- **Cost optimization**: 48-hour lookback window
- **Recovery**: Can retrieve and process historical snapshots

## Relevancy System

### Scoring Pipeline

1. **Cron Job**: `/api/cron/score-relevancy` runs periodically
2. **AI Analysis**: Uses OpenAI to score content relevancy (0-100)
3. **Filtering**: Only content with scores >= 0 shown to users
4. **Learning**: Admin dashboard for improving scoring

### Relevancy Features

- Content without scores hidden from users
- Batch processing for efficiency
- Admin tools for manual scoring
- Analytics dashboard for monitoring

## Database Schema

### Key Tables

- **users**: User accounts and profiles
- **creators**: Content creators/sources
- **creator_urls**: Platform URLs for each creator
- **lounges**: Topic groupings (formerly topics)
- **content**: Aggregated content from all platforms
- **lounge_digest_subscriptions**: Email digest preferences
- **brightdata_snapshots**: Tracks BrightData collection snapshots (Phase 2 processing)

### Row Level Security (RLS)

- User-scoped access to creators
- Public read access to content
- Admin-only access to system lounges

## Deployment Architecture

### Railway Services

#### 1. Main Application

```json
{
  "startCommand": "npm run ${RAILWAY_SERVICE_TYPE:-start}",
  "RAILWAY_SERVICE_TYPE": "" // Not set, uses default
}
```

- Serves the Next.js application
- Handles API endpoints
- Manages authentication

#### 2. Queue Workers

```json
{
  "startCommand": "npm run ${RAILWAY_SERVICE_TYPE:-start}",
  "RAILWAY_SERVICE_TYPE": "workers"
}
```

- Runs `npm run workers` → `tsx workers.ts`
- Processes background jobs
- Must have same environment variables as main app

### Environment Variables

#### Required for Both Services

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

#### API Keys

- `OPENAI_API_KEY` - AI summaries
- `YOUTUBE_API_KEY` - YouTube content
- `APIFY_API_KEY` - Twitter/Threads
- `BRIGHTDATA_API_KEY` - LinkedIn
- `CRON_SECRET` - Cron authentication

## Email Digest System

### Components

- **Digest Service**: `lib/services/digest-service.ts`
- **Email Templates**: React Email components
- **Cron Endpoint**: `/api/cron/send-daily-digest`
- **Subscription Management**: Per-lounge settings

### Features

- AI-powered summaries of top content
- Relevancy-based content selection
- Referenced content inclusion
- Customizable per lounge

## Security Features

### Authentication Layers

1. Magic link authentication
2. Email/password with validation
3. Google OAuth
4. Session management (30-minute timeout)
5. Cross-tab synchronization

### GDPR Compliance

- Consent management dashboard
- Data export functionality
- Secure account deletion
- Consent history tracking

## Monitoring & Debugging

### Queue Monitoring

- `/api/cron/queue-creators` returns queue statistics
- BullMQ dashboard (if configured)
- Redis queue inspection

### Logging Points

- Worker job completion/failure
- Content fetch statistics per creator
- AI summary generation
- Error tracking in catch blocks

### Debug Endpoints

- `/api/test-brightdata` - Test LinkedIn fetching
- `/api/test-brightdata-recovery` - Check BrightData snapshot status
- `/api/debug-linkedin` - LinkedIn data inspection
- `/api/test-apify` - Test Twitter/Threads
- `/api/cron/process-brightdata-snapshots` - Manually trigger snapshot processing
- Various platform-specific test endpoints

## Common Issues & Solutions

### Issue: Content Not Updating

**Diagnosis Path**:

1. Check if cron job is calling `/api/cron/queue-creators`
2. Verify Redis connection and queue creation
3. Confirm worker deployment is running
4. Check worker logs for processing errors

### Issue: Workers Not Processing

**Solution**: Ensure `RAILWAY_SERVICE_TYPE=workers` is set in worker deployment

### Issue: LinkedIn Content Missing (RESOLVED)

**Problem**: LinkedIn posts were being fetched by BrightData but failing validation when stored.

**Root Cause**: Media URLs in LinkedIn posts were missing required `url` fields or using incorrect field names:

- Videos with only thumbnails had empty `url` strings
- Link previews used `link_url` instead of `url` field

**Solution**:

- Fixed media URL validation by skipping videos without URLs
- Corrected link preview field from `link_url` to `url`
- Increased lookback window from 24 to 48 hours to prevent missing posts

**Known Issue**: BrightData may return LinkedIn posts without `id` or `url` fields. System now skips these invalid posts to prevent broken links.

### Issue: No AI Summaries

**Check**:

- OpenAI API key configured
- Content queued for summaries
- Summary worker running

### Issue: Queue Lock Timeout (RESOLVED)

**Problem**: BullMQ jobs failing with "could not renew lock" errors after 30 seconds when processing BrightData API calls that take 135+ seconds.

**Solution**: Increased `lockDuration` and `stalledInterval` to 300000ms (5 minutes) in queue configuration. Reduced worker concurrency from 10 to 3 to prevent lock contention.

### Issue: Twitter Validation Errors

**Problem**: "Validation error: Required" when storing Twitter content with media URLs.

**Root Cause**: Media items in `media_urls` array must have a valid `url` field (required by MediaUrlSchema). Link previews and media without URLs were causing validation failures.

**Solution**: Filter out media items without valid URLs before storing. Ensure link previews have a `url` field (use link URL as fallback).

### Issue: Invalid LinkedIn URLs

**Problem**: When BrightData doesn't provide post URLs, system was generating invalid fallback URLs like `https://www.linkedin.com/feed/update/linkedin-1755884526777-jef97cg`.

**Solution**: Skip LinkedIn posts that don't have both valid `id` and `url` fields from BrightData rather than attempting to generate URLs.

### Issue: BrightData Timeout (RESOLVED)

**Problem**: LinkedIn data collection via BrightData takes 2-3 minutes, causing worker timeouts and lost data.

**Solution - Two-Phase Architecture**:
- **Phase 1**: Creator processor triggers collection and saves snapshot ID (instant)
- **Phase 2**: Separate worker processes snapshots when ready (async)
- **Recovery**: Script to retrieve historical snapshots that were never processed
- **Monitoring**: Database tracks all snapshots with status (pending/ready/processing/processed/failed)

## Development Workflow

### Local Development

```bash
# Main app
npm run dev

# Workers (separate terminal)
npm run workers:dev
```

### Testing

- Unit tests for services
- Platform detector tests
- Content normalization tests
- Mock data for API testing

### Deployment

1. Push to GitHub
2. Railway auto-deploys both services
3. Workers restart and resume processing
4. Cron jobs continue on schedule

## Performance Optimizations

### Queue Optimizations

- Deduplication prevents duplicate jobs
- Batch processing for efficiency
- Concurrency limits (5 for creator processor)
- Rate limiting (10 jobs/second)

### Database Optimizations

- Indexes on frequently queried columns
- RLS policies for security
- Batch inserts for content

### Caching Strategy

- 1-minute cache for queue statistics
- Redis session management
- Content deduplication cache

## Future Considerations

### Scalability

- Queue system can handle increased load
- Workers can be scaled horizontally
- Redis can be upgraded for more capacity

### Cost Management

- LinkedIn: 48-hour window balances completeness vs API costs
- YouTube: Quota management prevents overuse
- Batch processing minimizes API calls

### Architecture Improvements (IMPLEMENTED)

- **✅ Separate Collection from Processing**: Decoupled BrightData triggers from data retrieval (Two-Phase Architecture)
- **✅ Snapshot Tracking**: Added `brightdata_snapshots` table to track collections and processing status
- **✅ Smart Collection**: Can reuse existing snapshots via recovery script
- **Future: Webhook Integration**: Use BrightData webhooks for real-time snapshot notifications

### Feature Expansion

- Additional platform support
- Advanced AI features
- Real-time notifications
- Mobile app integration
