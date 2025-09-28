import { NextRequest, NextResponse } from 'next/server';
import { SAAS_RSS_FEEDS, RSSFeedSource, getRSSFeedService } from '@/lib/services/rss-feed-service';
import Parser from 'rss-parser';

export async function GET(request: NextRequest) {
  try {
    // Check for API key (disabled for testing)
    // const apiKey = request.headers.get('x-api-key');
    // if (apiKey !== process.env.TEST_API_KEY) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
      },
    });

    const results = [];

    // Test each feed individually
    for (const feed of SAAS_RSS_FEEDS) {
      const feedResult = {
        name: feed.name,
        url: feed.url,
        category: feed.category,
        priority: feed.priority,
        status: 'success' as 'success' | 'error',
        articleCount: 0,
        last24h: 0,
        last48h: 0,
        error: null as string | null,
        sampleTitles: [] as string[],
      };

      try {
        console.log(`Testing ${feed.name}...`);
        const startTime = Date.now();

        const parsedFeed = await parser.parseURL(feed.url);
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        const fortyEightHours = 48 * 60 * 60 * 1000;

        const articles = parsedFeed.items || [];
        feedResult.articleCount = articles.length;

        // Count articles by age
        articles.forEach((article) => {
          if (article.pubDate) {
            const pubDate = new Date(article.pubDate).getTime();
            const age = now - pubDate;

            if (age <= twentyFourHours) {
              feedResult.last24h++;
            }
            if (age <= fortyEightHours) {
              feedResult.last48h++;
            }
          }
        });

        // Get sample titles (first 3)
        feedResult.sampleTitles = articles
          .slice(0, 3)
          .map(a => a.title || 'No title')
          .filter(Boolean);

        console.log(`${feed.name}: ${feedResult.articleCount} total, ${feedResult.last24h} in 24h, ${feedResult.last48h} in 48h (${Date.now() - startTime}ms)`);

      } catch (error) {
        feedResult.status = 'error';
        feedResult.error = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to fetch ${feed.name}:`, error);
      }

      results.push(feedResult);
    }

    // Also test the main service's fetch and deduplication
    const service = getRSSFeedService();
    const allArticles = await service.fetchAllFeeds();
    const dedupedArticles = service.dedupArticles(allArticles);
    const categorized = service.categorizeArticles(dedupedArticles);

    const summary = {
      timestamp: new Date().toISOString(),
      feeds: results,
      aggregated: {
        totalFetched: allArticles.length,
        afterDedup: dedupedArticles.length,
        categorized: {
          funding: categorized.funding.length,
          news: categorized.news.length,
          wire: categorized.wire.length,
        },
      },
      health: {
        working: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'error').length,
        feeds24h: results.filter(r => r.last24h > 0).length,
        feeds48h: results.filter(r => r.last48h > 0).length,
      },
    };

    return NextResponse.json(summary, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    console.error('[Test RSS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to test RSS feeds',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}