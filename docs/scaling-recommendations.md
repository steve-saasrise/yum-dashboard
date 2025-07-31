# Scaling Recommendations for Content Fetching & AI Summarization

## Current System Analysis

### System Overview
- **Current Capacity**: ~50-100 creators reliably
- **Cron Schedule**: Every 30 minutes
- **Processing Model**: Sequential, single-process
- **Infrastructure**: Railway/Vercel with HTTP timeout constraints

### Identified Bottlenecks

1. **Sequential Processing**: Creators processed one-by-one in a for loop
2. **No Queue System**: Everything runs in a single HTTP request
3. **No Retry Mechanism**: Failed fetches are logged but not retried
4. **Memory Constraints**: All content held in memory during processing
5. **Single Process**: No worker pool or parallel processing

## Priority 1: Implement Queue System (Critical)

### Recommended: BullMQ with Upstash Redis
You already have Upstash Redis, making this a natural choice.

```typescript
// Example queue structure
const queues = {
  contentFetch: new Queue('content-fetch'),
  aiSummary: new Queue('ai-summary'),
  apiRateLimit: new Queue('api-rate-limit')
};
```

### Queue Benefits
- Decouples fetching from processing
- Automatic retry with exponential backoff
- Priority queuing for active creators
- Survives process crashes
- Distributed processing capability

### Implementation Steps
1. Install BullMQ: `npm install bullmq`
2. Create queue workers for content fetching
3. Create queue workers for AI summarization
4. Update cron job to enqueue tasks instead of processing directly
5. Add monitoring dashboard (Bull Board)

## Priority 2: Parallelize Processing

### Current vs Recommended
```typescript
// Current (Sequential)
for (const creator of creators) {
  await processCreator(creator);
}

// Recommended (Parallel with limits)
const CONCURRENT_CREATORS = 10;
await pLimit(CONCURRENT_CREATORS, creators, processCreator);
```

### Parallel Processing Strategy
- Process 5-10 creators concurrently
- Use `Promise.allSettled()` for error resilience
- Implement per-API rate limiting
- Add circuit breakers for failing services

## Priority 3: Database Optimization

### Add Missing Indexes
```sql
-- Composite index for content fetching queries
CREATE INDEX idx_content_creator_created 
ON content(creator_id, created_at DESC);

-- Index for pending summaries
CREATE INDEX idx_content_summary_pending 
ON content(summary_status, created_at) 
WHERE summary_status = 'pending';
```

### Implement Batching
```typescript
// Batch insert content items
const batchInsert = async (items: CreateContentInput[]) => {
  const BATCH_SIZE = 100;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await supabase.from('content').insert(batch);
  }
};
```

## Priority 4: Tiered Processing System

### Creator Activity Tiers
```typescript
interface CreatorTier {
  interval: number;  // minutes
  priority: number;  // queue priority
  maxItems: number;  // items per fetch
}

const CREATOR_TIERS = {
  HOT: { interval: 30, priority: 10, maxItems: 20 },
  ACTIVE: { interval: 120, priority: 5, maxItems: 15 },
  NORMAL: { interval: 360, priority: 3, maxItems: 10 },
  COLD: { interval: 720, priority: 1, maxItems: 5 }
};
```

### Tier Assignment Logic
- HOT: Published in last 24 hours
- ACTIVE: Published in last 7 days
- NORMAL: Published in last 30 days
- COLD: No recent activity

## Priority 5: Cost Optimization

### AI Summary Optimization
1. **Content Deduplication**: Hash content before summarizing
2. **Tiered Models**: Use cheaper models for shorter content
3. **Summary Caching**: Cache similar content summaries
4. **Batch Processing**: Group similar content for bulk summarization

### API Cost Management
```typescript
const API_BUDGETS = {
  OPENAI_DAILY: 50.00,
  APIFY_DAILY: 20.00,
  YOUTUBE_DAILY: 10000 // quota units
};
```

## Priority 6: Monitoring & Observability

### Key Metrics to Track
- Queue depth and processing time
- API usage and costs per creator
- Success/failure rates by platform
- Content duplication rates
- Summary generation costs

### Recommended Tools
- Bull Board for queue monitoring
- Grafana for metrics visualization
- Sentry for error tracking
- Custom dashboard for creator health

## Priority 7: Infrastructure Scaling

### Short Term (Current: Railway)
1. Increase memory limits
2. Add worker dynos for processing
3. Implement health checks
4. Add automatic scaling rules

### Long Term Options
1. **Kubernetes**: For complex scaling needs
2. **AWS Lambda**: For serverless processing
3. **Temporal**: For complex workflows
4. **Apache Kafka**: For event streaming

## Implementation Roadmap

### Phase 1 (Week 1-2): Foundation
- [ ] Implement BullMQ queue system
- [ ] Create basic worker processes
- [ ] Add retry logic
- [ ] Set up monitoring

### Phase 2 (Week 3-4): Optimization
- [ ] Add parallel processing
- [ ] Implement tiered creator system
- [ ] Optimize database queries
- [ ] Add cost tracking

### Phase 3 (Week 5-6): Scale
- [ ] Add circuit breakers
- [ ] Implement content deduplication
- [ ] Add advanced monitoring
- [ ] Performance testing

### Phase 4 (Week 7-8): Polish
- [ ] Add admin dashboard
- [ ] Implement auto-scaling
- [ ] Add alerting system
- [ ] Documentation

## Estimated Capacity After Implementation

| Metric | Current | After Phase 1 | After Phase 2 | After Phase 4 |
|--------|---------|---------------|---------------|---------------|
| Creators | 50-100 | 200-500 | 500-2,000 | 5,000-10,000+ |
| Content/Day | ~2,000 | ~10,000 | ~50,000 | ~200,000+ |
| AI Summaries/Day | ~1,000 | ~5,000 | ~20,000 | ~100,000 |
| Monthly Cost | ~$10 | ~$50 | ~$200 | ~$500-1,000 |

## Quick Wins (Can implement today)

1. **Increase batch size for AI summaries** from 5 to 10
2. **Add composite database indexes** (provided above)
3. **Implement Promise.allSettled()** for creator processing
4. **Add basic retry logic** with exponential backoff
5. **Cache YouTube channel IDs** to reduce API calls

## Critical Path

The most important change is implementing the queue system. Without it, you'll hit hard limits around 100 active creators due to:
- HTTP timeout constraints (10 minutes on Vercel)
- Memory limitations
- No failure recovery
- API rate limit coordination

Start with BullMQ + Upstash Redis for immediate relief, then build out the other optimizations incrementally.