# Hybrid News System Implementation Guide

## Quick Start

### 1. Enable Hybrid Mode

Add to your `.env.local`:
```bash
USE_HYBRID_NEWS=true
```

### 2. Deploy the Updated Worker

The system will automatically use the hybrid worker when `USE_HYBRID_NEWS=true`.

To use the new worker immediately, update your worker startup file:

```typescript
// In your worker startup file
import { createAINewsProcessorWorkerHybrid } from '@/lib/queue/workers/ai-news-processor-hybrid';

// Replace the old worker with:
const aiNewsWorker = createAINewsProcessorWorkerHybrid();
```

### 3. Test the Implementation

#### Test RSS Feed Connectivity
```bash
curl http://localhost:3000/api/test-news/generate-saas-news-hybrid?testRss=true
```

#### Test Full Hybrid Generation
```bash
curl http://localhost:3000/api/test-news/generate-saas-news-hybrid?mode=hybrid
```

#### Compare Modes
```bash
# Pure GPT-5 (old way)
curl http://localhost:3000/api/test-news/generate-saas-news-sync

# Hybrid RSS + GPT-5 (new way)
curl http://localhost:3000/api/test-news/generate-saas-news-hybrid
```

## Migration Path

### Phase 1: Testing (Current)
- Run both systems in parallel
- Compare output quality
- Monitor for RSS feed reliability

### Phase 2: Gradual Rollout
```bash
# Start with 20% hybrid
USE_HYBRID_NEWS=true
HYBRID_ROLLOUT_PERCENTAGE=20

# Increase gradually
HYBRID_ROLLOUT_PERCENTAGE=50
HYBRID_ROLLOUT_PERCENTAGE=100
```

### Phase 3: Full Migration
- Set `USE_HYBRID_NEWS=true` in production
- Remove fallback to old system
- Deprecate pure GPT-5 service

## Key Differences

### Old System (Pure GPT-5)
- ❌ Generated/fake URLs
- ❌ May hallucinate companies
- ❌ Inconsistent timing
- ✅ Always generates content

### New System (Hybrid)
- ✅ Real, verifiable URLs
- ✅ Only real companies/news
- ✅ Always last 24 hours
- ✅ Fallback if RSS fails

## Monitoring

Check logs for hybrid mode indicators:
```
[AI News Worker] Mode: HYBRID RSS+GPT5
[RSS Feed] Fetched 47 articles from 7 feeds
[GPT-5 Curator] Curated in 2341ms
[Hybrid News] 5/5 items have real article URLs
```

## Troubleshooting

### RSS Feeds Not Working
1. Check network connectivity
2. Verify RSS feed URLs are accessible
3. Check for rate limiting
4. Review feed parser errors in logs

### Fallback to Pure Generation
The system automatically falls back when:
- RSS feeds are unavailable
- Less than 10 articles found
- Parser errors occur

### Performance Issues
- RSS fetching is parallelized
- 30-minute cache for RSS results
- GPT-5 calls are rate-limited
- Total generation: ~5-10 seconds

## Production Checklist

- [ ] Set `USE_HYBRID_NEWS=true` in production env
- [ ] Verify all RSS feeds are accessible from production
- [ ] Monitor first 24 hours of generation
- [ ] Compare quality metrics with old system
- [ ] Update monitoring dashboards
- [ ] Document any custom feed additions

## Support

For issues or questions:
1. Check logs for detailed error messages
2. Test RSS feeds individually
3. Verify GPT-5 API key and limits
4. Review hybrid news documentation