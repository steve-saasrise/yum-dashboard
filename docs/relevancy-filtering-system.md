# Relevancy Filtering System

## Overview

The relevancy filtering system automatically evaluates content against lounge themes and removes off-topic content from user feeds and digests. This ensures content quality and relevance without manual curation.

## How It Works

### 1. Content Evaluation

- Content is evaluated in a **separate cron job** (`/api/cron/score-relevancy`) that runs after content fetching
- Each piece of content receives a relevancy score (0-100) for EACH lounge it belongs to
- The AI considers:
  - Does the main topic align with the theme?
  - Would someone interested in this theme find it valuable?
  - Is it informative/educational vs just a casual mention?
  - **For quoted/reposted content**: Both the author's commentary AND the referenced content are evaluated
  - Content is considered relevant if EITHER the author's comment OR the quoted content is on-topic

### 2. Scoring Thresholds

- **90-100**: Directly and substantially about the theme
- **70-89**: Clearly related with valuable insights
- **50-69**: Somewhat related but not the main focus
- **30-49**: Only tangentially related
- **0-29**: Not related to the theme

### 3. Auto-Deletion

- Content is auto-deleted ONLY if it scores below threshold for ALL lounges it belongs to
- A piece of content in multiple lounges is kept if it passes ANY lounge's threshold
- Deleted content is marked with `deletion_reason: 'low_relevancy'` in the `deleted_content` table
- This hides it from regular users but preserves it in the database
- Curators/admins can still see auto-deleted content with a purple banner
- The system stores the highest score in the content table for display purposes

## Current Lounge Configurations

| Lounge              | Threshold | Theme Description                                                                                                           |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| **SaaS**            | 60        | SaaS business models, metrics (MRR, ARR, churn), growth strategies, B2B marketing/sales, pricing, customer success, funding |
| **AI**              | 60        | AI/ML research, LLMs, computer vision, NLP, AI tools, neural networks, AI ethics, practical implementation                  |
| **Crypto**          | 60        | Cryptocurrency, blockchain, DeFi, NFTs, smart contracts, Web3, DAOs, decentralized technologies                             |
| **Venture**         | 60        | VC funding, startup ecosystem, growth strategies, exits, pitch decks, valuations, entrepreneurship                          |
| **B2B Growth**      | 60        | B2B sales, ABM, lead generation, content marketing, sales enablement, customer acquisition, revenue operations              |
| **Biohacking**      | 50        | Health optimization, nutrition, fitness, sleep, mental performance, longevity, wearables, recovery                          |
| **Personal Growth** | 50        | Productivity, goal setting, time management, habits, mindset, career development, work-life balance                         |

## Implementation Components

### Database Schema

```sql
-- Content table additions
ALTER TABLE content ADD COLUMN relevancy_score NUMERIC(5,2);
ALTER TABLE content ADD COLUMN relevancy_reason TEXT;
ALTER TABLE content ADD COLUMN relevancy_checked_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE content ADD COLUMN reference_type TEXT;
ALTER TABLE content ADD COLUMN referenced_content JSONB;

-- Lounges table additions
ALTER TABLE lounges ADD COLUMN theme_description TEXT;
ALTER TABLE lounges ADD COLUMN relevancy_threshold NUMERIC(5,2) DEFAULT 60.00;

-- Deleted content tracking
ALTER TABLE deleted_content ADD COLUMN deletion_reason TEXT DEFAULT 'manual';
```

### Services

1. **RelevancyService** (`lib/services/relevancy-service.ts`)
   - Fetches content needing relevancy checks (including referenced content)
   - Evaluates content using OpenAI GPT-4o-mini
   - For quotes/reposts: Evaluates both author commentary and referenced content
   - Updates relevancy scores (stores highest score across all lounges)
   - Auto-deletes content that fails ALL lounge thresholds

2. **Content Fetching** (`app/api/cron/fetch-content/route.ts`)
   - Fetches new content from all platforms
   - Does NOT run relevancy checks (runs on external cron service without OpenAI access)
   - Stores content with `relevancy_checked_at = NULL`

3. **Relevancy Scoring** (`app/api/cron/score-relevancy/route.ts`)
   - Separate cron job that runs on Railway deployment
   - Has access to OpenAI API key
   - Processes up to 100 unscored items per run
   - Handles multi-lounge scoring and auto-deletion

4. **Digest Service** (`lib/services/digest-service.ts`)
   - Filters content by relevancy score during digest generation
   - Only includes content above threshold OR unchecked content

### Content Processing Flow

#### Step 1: Content Fetching (External Cron - cron-job.org)

The fetch-content cron job (`/api/cron/fetch-content`) runs every 30 minutes:

1. Fetch all active creators with their platform URLs
2. Process each creator's content sources (RSS, YouTube, Twitter, LinkedIn, Threads)
3. **Store content WITHOUT scoring** (no OpenAI access on external service)

For each creator:

1. **Fetch new content** from their platforms using appropriate fetchers:
   - RSS: Direct feed parsing
   - YouTube: YouTube Data API
   - Twitter/Threads: Apify scraper
   - LinkedIn: BrightData scraper
2. **Normalize content** to standard format with platform-specific metadata
3. **Store in database** with `relevancy_checked_at = NULL`

#### Step 2: Relevancy Scoring (Railway Cron)

The score-relevancy cron job (`/api/cron/score-relevancy`) runs separately:

1. **Check for unscored content**: Query for content where `relevancy_checked_at IS NULL` from last 7 days
2. **Batch process**: Fetch up to 100 items using `get_content_for_relevancy_check()` function
3. **Evaluate each item**:
   - Returns one row per content-lounge combination
   - Build full content including any referenced content (quotes/reposts)
   - Send to OpenAI GPT-4o-mini with lounge-specific theme context
   - Receive score (0-100) and reason for EACH lounge
4. **Update database**:
   - Set `relevancy_score` to the HIGHEST score across all lounges
   - Set `relevancy_reason` and `relevancy_checked_at`
   - **Multi-lounge auto-deletion logic**:
     - Check if content fails ALL lounge thresholds it belongs to
     - Only delete if score < threshold for EVERY lounge
     - If deleted: Insert into `deleted_content` table with `deletion_reason: 'low_relevancy'`

#### Step 3: Content Display

When users view content:

1. **Regular users**: Only see content that is NOT in deleted_content table
2. **Curators/Admins**: See all content with visual indicators:
   - Purple banner for auto-deleted (low relevancy)
   - Yellow banner for manually deleted
3. **Filtering**: Content API excludes deleted content for regular users via JOIN with deleted_content table

#### Important Notes

- **Two separate cron jobs**: Content fetching (external) and relevancy scoring (Railway) run independently
- **Platform type conversion**: The `platform` field is an enum in content table but text in deleted_content table - requires String() conversion
- **Multi-lounge protection**: Content in multiple lounges is protected if it passes ANY single lounge threshold
- **Score storage**: The content table stores the HIGHEST score across all lounges for display
- **Batch processing**: Processes up to 100 items per scoring run to manage API costs

### UI Components

- **Daily News Dashboard** (`components/daily-news-dashboard.tsx`)
  - Shows different banners for auto-deleted vs manually deleted content
  - Purple banner: "🤖 Auto-hidden: Low relevancy to lounge theme"
  - Yellow banner: "This content is hidden from users" (manual deletion)
- **Type Definitions** (`types/content.ts`)
  - ContentWithCreator interface includes `deletion_reason?: string` field
- **Intersection Observer Grid** (`components/intersection-observer-grid.tsx`)
  - Passes through deletion_reason to ContentCard for proper display

## Adding New Lounges

When creating a new lounge, set these fields:

```sql
UPDATE lounges SET
  theme_description = 'Detailed description of what content belongs in this lounge',
  relevancy_threshold = 60.00  -- Adjust based on how strict you want filtering
WHERE id = 'lounge-id';
```

### Theme Description Best Practices

1. **Be Specific**: List concrete topics, not vague concepts
2. **Include Examples**: "including: topic1, topic2, topic3..."
3. **Set Boundaries**: What should and shouldn't be included
4. **Consider Adjacent Topics**: Decide if related topics count

### Threshold Guidelines

- **60**: Standard threshold for business/tech lounges (SaaS, AI, Crypto, Venture, B2B Growth)
- **50**: Lenient threshold for broader topics (Biohacking, Personal Growth)
- Lower thresholds = more permissive (less content filtered)
- Higher thresholds = more strict (more content filtered)

## Handling Referenced Content

### Supported Platforms and Types

The system handles referenced content across all platforms:

- **Twitter/X**: Quote tweets
- **LinkedIn**: Reshares/reposts
- **Threads**: Quote posts and reposts

### Evaluation Logic

When content includes a reference (quote, repost, or reply):

1. **Both parts are evaluated**: The author's commentary AND the referenced content
2. **Either can make it relevant**: If EITHER part is relevant to the lounge theme, the content scores well
3. **Only filtered if BOTH are off-topic**: Content is only scored low if both the author's comment AND the referenced content are irrelevant

### Example Scenarios

| Author Comment                     | Referenced Content      | Result                                   |
| ---------------------------------- | ----------------------- | ---------------------------------------- |
| "Love this approach! 🎉"           | SaaS metrics discussion | ✅ Kept (referenced content is relevant) |
| "This applies to our SaaS pricing" | General business advice | ✅ Kept (author adds SaaS context)       |
| "So true! 😂"                      | Personal joke           | ❌ Filtered (both parts off-topic)       |
| Technical analysis                 | Celebrity news          | ✅ Kept (author's analysis is relevant)  |

This ensures curators can share relevant content with their own context without being filtered out.

## API Costs

- Each relevancy check costs approximately $0.001-0.002 (using GPT-4o-mini)
- Processing 100 items costs ~$0.10-0.20
- Checks run only on new content (last 7 days, unchecked)

## Manual Controls

### Running Relevancy Checks

```javascript
// API endpoint for admins
POST /api/admin/relevancy-check
{
  "limit": 50  // Number of items to check
}
```

### Viewing Filtered Content

```javascript
// Get content with relevancy info
GET /api/admin/relevancy-check?loungeId=xxx&lowRelevancy=true
```

### Restoring Auto-Deleted Content

Curators can restore auto-deleted content through the UI by clicking the restore button on any item marked as auto-hidden.

## Monitoring

Check the effectiveness of relevancy filtering:

```sql
-- See auto-deleted content
SELECT
  COUNT(*) as total,
  AVG(c.relevancy_score) as avg_score
FROM deleted_content dc
JOIN content c ON c.platform_content_id = dc.platform_content_id
WHERE dc.deletion_reason = 'low_relevancy';

-- Find borderline content
SELECT title, relevancy_score, relevancy_reason
FROM content
WHERE relevancy_score BETWEEN 50 AND 70
ORDER BY relevancy_score DESC;

-- Check multi-lounge content behavior
WITH content_lounges AS (
  SELECT 
    c.id,
    c.title,
    c.relevancy_score,
    COUNT(DISTINCT cl.lounge_id) as lounge_count,
    BOOL_AND(c.relevancy_score < COALESCE(l.relevancy_threshold, 60)) as fails_all
  FROM content c
  JOIN creators cr ON c.creator_id = cr.id
  JOIN creator_lounges cl ON cr.id = cl.creator_id
  JOIN lounges l ON cl.lounge_id = l.id
  WHERE c.relevancy_score IS NOT NULL
  GROUP BY c.id, c.title, c.relevancy_score
)
SELECT * FROM content_lounges
WHERE lounge_count > 1
ORDER BY relevancy_score ASC;
```

## Troubleshooting

### Content Not Being Filtered

1. Check if OpenAI API key is configured in Railway environment
2. Verify lounge has `theme_description` set
3. Check if content has been evaluated (relevancy_checked_at not null)
4. Verify score-relevancy cron job is running on cron-job.org
5. Check Railway logs for any errors in the scoring endpoint

### Too Much Content Filtered

1. Auto-deletion uses per-lounge thresholds (60 for most, 50 for Biohacking/Personal Growth)
2. Content must fail ALL lounges to be deleted (multi-lounge protection)
3. Refine the `theme_description` to be more inclusive
4. Lower the lounge's `relevancy_threshold` in the database
5. Review filtered content and adjust theme descriptions accordingly

### Auto-Deleted Content Not Showing Purple Banner

1. Ensure `deletion_reason` field is included in ContentWithCreator type
2. Verify IntersectionObserverGrid includes deletion_reason in renderItem
3. Check that the API is properly mapping deletion_reason from deleted_content table
4. Confirm user has curator/admin role to see deleted content

### Cron Job Not Scoring Content

1. **Check environment**: Ensure OPENAI_API_KEY is set in Railway (not in cron-job.org)
2. **Verify cron setup**: score-relevancy should run on cron-job.org pointing to Railway deployment
3. **Check authorization**: Cron request must include `Authorization: Bearer <CRON_SECRET>`
4. **Monitor logs**: Check Railway logs for any errors during execution
5. **Database check**: Verify `get_content_for_relevancy_check()` function returns unscored content

### Restoring Incorrectly Filtered Content

1. Curators can manually restore through the UI (undelete button)
2. Adjust theme description to prevent future false positives
3. Consider lowering the lounge's relevancy_threshold
4. Note: Manual deletion always overrides auto-deletion status

## Cron Job Configuration

### Required Cron Jobs

1. **Content Fetching** (cron-job.org → Railway)
   - URL: `https://your-app.railway.app/api/cron/fetch-content`
   - Schedule: Every 30 minutes
   - No special headers needed

2. **Relevancy Scoring** (cron-job.org → Railway)
   - URL: `https://your-app.railway.app/api/cron/score-relevancy`
   - Schedule: Every 15-30 minutes (adjust based on content volume)
   - Headers: `Authorization: Bearer <CRON_SECRET>`

### Environment Variables

Required in Railway deployment:
- `OPENAI_API_KEY`: For relevancy scoring
- `CRON_SECRET`: For authenticating cron requests
- `SUPABASE_SERVICE_ROLE_KEY`: For database operations
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL