# Hybrid RSS + GPT-5 News System

## Overview

The hybrid news system combines real-time RSS feed fetching with GPT-5 AI curation to deliver high-quality, verifiable SaaS industry news. This approach solves the hallucination problem of pure AI generation while maintaining intelligent content curation.

## Architecture

```
RSS Feeds → Parser → Deduplication → GPT-5 Curator → Formatted Digest
```

## Key Components

### 1. RSS Feed Service (`lib/services/rss-feed-service.ts`)
- Fetches from 7 primary SaaS news sources
- Filters articles from last 24 hours (prefers fresh content)
- Falls back to 48 hours if fewer than 10 articles found
- Deduplicates based on company/funding amounts
- Categorizes into funding, news, and wire services

### 2. GPT-5 Curator Service (`lib/services/gpt5-curator-service.ts`)
- Takes RSS articles as input
- Uses GPT-5 to select most impactful stories
- Generates summaries explaining why each story matters
- Ensures no duplicate stories across sections

### 3. Hybrid News Service (`lib/services/hybrid-news-service.ts`)
- Orchestrates the entire flow
- Handles fallback to pure generation if RSS fails
- Prioritizes articles by relevance
- Configurable per lounge type

## RSS Feed Sources

| Source | Category | Priority | Focus |
|--------|----------|----------|-------|
| TechCrunch | Mixed | 1 | Breaking tech/SaaS news |
| TechCrunch Funding | Funding | 1 | VC and funding rounds |
| The SaaS News | Funding | 1 | Specialized SaaS funding |
| Crunchbase News | Funding | 1 | Verified funding data |
| VentureBeat | News | 2 | Enterprise tech |
| PR Newswire | Wire | 2 | Official announcements |
| Business Wire | Wire | 3 | SEC filings, IPOs |

## Configuration

### Environment Variables

```bash
# Enable hybrid mode (RSS + GPT-5)
USE_HYBRID_NEWS=true

# OpenAI API key for GPT-5
OPENAI_API_KEY=your_key_here

# Test API key for test endpoints
TEST_API_KEY=your_test_key
```

### Configuration Options

```typescript
{
  loungeType: string,           // e.g., "SaaS Pulse"
  maxBullets: number,           // Main news items (default: 5)
  maxSpecialSection: number,    // Funding items (default: 5)
  useRSSFeeds: boolean,         // Enable RSS fetching
  fallbackToPureGeneration: boolean, // Fallback if RSS fails
  minArticlesRequired: number,  // Minimum articles needed (default: 10)
}
```

## Usage

### In Production (Cron Job)

The system runs via cron job every day to generate news digests:

```typescript
// Automatically uses hybrid mode if USE_HYBRID_NEWS=true
await queueAINewsGeneration([saasLounge], false);
```

### Testing Endpoints

#### Test RSS Feeds Only
```bash
GET /api/test-news/generate-saas-news-hybrid?testRss=true
```

#### Test Hybrid Generation
```bash
GET /api/test-news/generate-saas-news-hybrid?mode=hybrid
```

#### Test with Custom Config
```bash
POST /api/test-news/generate-saas-news-hybrid
{
  "loungeType": "SaaS Pulse",
  "maxBullets": 5,
  "useRSSFeeds": true,
  "fallbackToPureGeneration": true
}
```

## Benefits

1. **Real URLs**: Every article links to actual published content
2. **Timeliness**: Prioritizes news from last 24 hours, expands to 48 hours when needed
3. **Verification**: All stories are verifiable and real
4. **Intelligent Curation**: GPT-5 selects most important stories
5. **Context**: AI explains why each story matters
6. **Deduplication**: No repeated stories across sections
7. **Fallback**: Gracefully handles RSS failures

## Monitoring

The system logs detailed information:
- RSS feed fetch status and counts
- Article deduplication stats
- GPT-5 curation results
- Real vs generated URL counts
- Processing times

## Database Storage

News is saved with metadata indicating source:
- `model_used`: "hybrid-gpt5-rss" or "gpt-5"
- `generation_mode`: "hybrid" or "pure"
- `articles_found`: Number of RSS articles
- `articles_used`: Number in final digest

## Future Enhancements

- [ ] Add more specialized SaaS RSS feeds
- [ ] Implement feed quality monitoring
- [ ] Add user-configurable feed preferences
- [ ] Cache RSS results for efficiency
- [ ] Add sentiment analysis
- [ ] Track story engagement metrics