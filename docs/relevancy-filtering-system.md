# Relevancy Filtering System

## Overview

The relevancy filtering system automatically evaluates content against lounge themes and removes off-topic content from user feeds and digests. This ensures content quality and relevance without manual curation.

## How It Works

### 1. Content Evaluation

- When new content is fetched, it's evaluated against each lounge's theme using OpenAI
- Each piece of content receives a relevancy score (0-100)
- The AI considers:
  - Does the main topic align with the theme?
  - Would someone interested in this theme find it valuable?
  - Is it informative/educational vs just a casual mention?

### 2. Scoring Thresholds

- **90-100**: Directly and substantially about the theme
- **70-89**: Clearly related with valuable insights
- **50-69**: Somewhat related but not the main focus
- **30-49**: Only tangentially related
- **0-29**: Not related to the theme

### 3. Auto-Deletion

- Content scoring below 60 (across all lounges) is automatically soft-deleted
- Deleted content is marked with `deletion_reason: 'low_relevancy'` in the `deleted_content` table
- This hides it from regular users but preserves it in the database
- Curators/admins can still see auto-deleted content with a purple banner
- The system uses the highest score across all lounges a creator belongs to

## Current Lounge Configurations

| Lounge              | Threshold | Theme Description                                                                                                           |
| ------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| **SaaS**            | 75        | SaaS business models, metrics (MRR, ARR, churn), growth strategies, B2B marketing/sales, pricing, customer success, funding |
| **AI**              | 70        | AI/ML research, LLMs, computer vision, NLP, AI tools, neural networks, AI ethics, practical implementation                  |
| **Crypto**          | 70        | Cryptocurrency, blockchain, DeFi, NFTs, smart contracts, Web3, DAOs, decentralized technologies                             |
| **Venture**         | 70        | VC funding, startup ecosystem, growth strategies, exits, pitch decks, valuations, entrepreneurship                          |
| **B2B Growth**      | 70        | B2B sales, ABM, lead generation, content marketing, sales enablement, customer acquisition, revenue operations              |
| **Biohacking**      | 65        | Health optimization, nutrition, fitness, sleep, mental performance, longevity, wearables, recovery                          |
| **Personal Growth** | 65        | Productivity, goal setting, time management, habits, mindset, career development, work-life balance                         |

## Implementation Components

### Database Schema

```sql
-- Content table additions
ALTER TABLE content ADD COLUMN relevancy_score NUMERIC(5,2);
ALTER TABLE content ADD COLUMN relevancy_reason TEXT;
ALTER TABLE content ADD COLUMN relevancy_checked_at TIMESTAMP WITH TIME ZONE;

-- Lounges table additions
ALTER TABLE lounges ADD COLUMN theme_description TEXT;
ALTER TABLE lounges ADD COLUMN relevancy_threshold NUMERIC(5,2) DEFAULT 70.00;

-- Deleted content tracking
ALTER TABLE deleted_content ADD COLUMN deletion_reason TEXT DEFAULT 'manual';
```

### Services

1. **RelevancyService** (`lib/services/relevancy-service.ts`)
   - Fetches content needing relevancy checks
   - Evaluates content using OpenAI
   - Updates relevancy scores
   - Auto-deletes low-scoring content

2. **Content Fetching** (`app/api/cron/fetch-content/route.ts`)
   - Runs relevancy checks after fetching new content
   - Processes in batches to manage API costs

3. **Digest Service** (`lib/services/digest-service.ts`)
   - Filters content by relevancy score during digest generation
   - Only includes content above threshold OR unchecked content

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
  relevancy_threshold = 70.00  -- Adjust based on how strict you want filtering
WHERE id = 'lounge-id';
```

### Theme Description Best Practices

1. **Be Specific**: List concrete topics, not vague concepts
2. **Include Examples**: "including: topic1, topic2, topic3..."
3. **Set Boundaries**: What should and shouldn't be included
4. **Consider Adjacent Topics**: Decide if related topics count

### Threshold Guidelines

- **75+**: Strict filtering for focused lounges (e.g., SaaS)
- **70**: Standard filtering for most technical lounges
- **65**: Lenient filtering for broader topics (e.g., Personal Growth)
- **60 or below**: Very permissive, only filters clearly off-topic content

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
WHERE relevancy_score BETWEEN 60 AND 80
ORDER BY relevancy_score DESC;
```

## Troubleshooting

### Content Not Being Filtered

1. Check if OpenAI API key is configured
2. Verify lounge has `theme_description` set
3. Check if content has been evaluated (relevancy_checked_at not null)
4. Verify deletion_reason is being passed through IntersectionObserverGrid component

### Too Much Content Filtered

1. The auto-deletion threshold is fixed at 60 (not per-lounge)
2. Refine the `theme_description` to be more inclusive
3. Review filtered content and adjust theme descriptions accordingly

### Auto-Deleted Content Not Showing Purple Banner

1. Ensure `deletion_reason` field is included in ContentWithCreator type
2. Verify IntersectionObserverGrid includes deletion_reason in renderItem
3. Check that the API is properly mapping deletion_reason from deleted_content table
4. Confirm user has curator/admin role to see deleted content

### Restoring Incorrectly Filtered Content

1. Curators can manually restore through the UI (undelete button)
2. Adjust theme description to prevent future false positives
3. Consider creating a more specific theme description
4. Note: Manual deletion always overrides auto-deletion status
