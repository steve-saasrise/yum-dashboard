import { getRSSFeedService, SAAS_RSS_FEEDS, type RSSFeedSource } from './rss-feed-service';
import { getGPT5CuratorService } from './gpt5-curator-service';
import { getGPT5NewsService } from './gpt5-news-service';
import { getGPT5MiniFundingService } from './gpt5-mini-funding-service';
import type { GenerateNewsResult, GPT5NewsConfig } from './gpt5-news-service';

export interface HybridNewsConfig extends GPT5NewsConfig {
  useRSSFeeds?: boolean;
  fallbackToPureGeneration?: boolean;
  customFeeds?: RSSFeedSource[];
  minArticlesRequired?: number;
  useDedicatedFundingSearch?: boolean; // Enable GPT-5-mini funding search
  fundingSearchTimeframe?: string; // e.g., "24h", "7d", "30d"
}

export class HybridNewsService {
  private rssService = getRSSFeedService();
  private curatorService = getGPT5CuratorService();
  private fallbackService = getGPT5NewsService();
  private fundingService = getGPT5MiniFundingService();

  async generateNews(config: HybridNewsConfig): Promise<GenerateNewsResult> {
    const startTime = Date.now();
    const {
      loungeType,
      maxBullets = 5,
      maxSpecialSection = 5,
      useRSSFeeds = true,
      fallbackToPureGeneration = true,
      customFeeds,
      minArticlesRequired = 10,
      useDedicatedFundingSearch = true,
      fundingSearchTimeframe = '48h',
    } = config;

    console.log(
      `[Hybrid News] Starting generation for ${loungeType} ` +
      `(RSS: ${useRSSFeeds}, Fallback: ${fallbackToPureGeneration})`
    );

    // If RSS feeds are disabled, use pure generation
    if (!useRSSFeeds) {
      console.log('[Hybrid News] RSS disabled, using pure generation');
      return this.fallbackService.generateNews({
        loungeType,
        maxBullets,
        maxSpecialSection,
      });
    }

    try {
      // Step 1: Fetch RSS articles
      const feeds = this.selectFeedsForLounge(loungeType, customFeeds);
      const articles = await this.rssService.fetchAllFeeds(feeds);

      if (articles.length === 0) {
        throw new Error('No RSS articles fetched');
      }

      // Step 2: Deduplicate articles
      const dedupedArticles = this.rssService.dedupArticles(articles);

      console.log(
        `[Hybrid News] Fetched ${dedupedArticles.length} unique articles`
      );

      // Step 3: Check if we have enough articles
      if (dedupedArticles.length < minArticlesRequired) {
        console.log(
          `[Hybrid News] Only ${dedupedArticles.length} articles found, ` +
          `minimum ${minArticlesRequired} required`
        );

        if (fallbackToPureGeneration) {
          console.log('[Hybrid News] Falling back to pure generation');
          return this.fallbackService.generateNews({
            loungeType,
            maxBullets,
            maxSpecialSection,
          });
        }
      }

      // Step 4: Categorize articles for better curation
      const categorized = this.rssService.categorizeArticles(dedupedArticles);

      // Step 5: Prioritize and limit articles for GPT-5
      const prioritizedArticles = this.prioritizeArticles(
        dedupedArticles,
        categorized,
        50 // Send top 50 articles to GPT-5
      );

      // Step 6: Run parallel tasks - RSS curation and funding search
      const [rssResult, fundingResult] = await Promise.all([
        // Curate RSS articles with GPT-5
        this.curatorService.curateNewsFromRSS(
          prioritizedArticles,
          {
            loungeType,
            maxBullets,
            maxSpecialSection: useDedicatedFundingSearch ? 0 : maxSpecialSection, // Skip funding if using dedicated search
          }
        ),
        // Search for funding news with GPT-5-mini (if enabled)
        useDedicatedFundingSearch
          ? this.fundingService.searchFundingNews({
              loungeType,
              maxResults: maxSpecialSection,
              timeframe: fundingSearchTimeframe,
            })
          : Promise.resolve(null),
      ]);

      // Step 7: Merge results
      let result = rssResult;

      if (fundingResult && fundingResult.fundingItems.length > 0) {
        // Replace or add funding section with dedicated search results
        result.specialSection = fundingResult.fundingItems.map((item) => ({
          text: item.text,
          summary: item.summary,
          amount: item.amount,
          series: item.series,
          source: item.source,
          sourceUrl: item.sourceUrl,
        }));
        result.specialSectionTitle = 'SaaS Funding & M&A';

        console.log(
          `[Hybrid News] Added ${fundingResult.fundingItems.length} funding items from dedicated search`
        );
      }

      const duration = Date.now() - startTime;
      console.log(
        `[Hybrid News] Generated successfully in ${duration}ms ` +
        `(${result.items.length} bullets, ${result.specialSection?.length || 0} funding)`
      );

      return result;
    } catch (error) {
      console.error('[Hybrid News] Error in hybrid generation:', error);

      if (fallbackToPureGeneration) {
        console.log('[Hybrid News] Falling back to pure GPT-5 generation');
        try {
          return await this.fallbackService.generateNews({
            loungeType,
            maxBullets,
            maxSpecialSection,
          });
        } catch (fallbackError) {
          console.error('[Hybrid News] Fallback also failed:', fallbackError);
          throw fallbackError;
        }
      }

      throw error;
    }
  }

  private selectFeedsForLounge(
    loungeType: string,
    customFeeds?: RSSFeedSource[]
  ): RSSFeedSource[] {
    if (customFeeds && customFeeds.length > 0) {
      return customFeeds;
    }

    const loungeTypeLower = loungeType.toLowerCase();

    // For SaaS lounges, use all feeds
    if (loungeTypeLower.includes('saas')) {
      return SAAS_RSS_FEEDS;
    }

    // For AI lounges, filter to AI-relevant sources
    if (loungeTypeLower.includes('ai')) {
      return SAAS_RSS_FEEDS.filter(
        (feed) =>
          feed.name.includes('TechCrunch') ||
          feed.name.includes('VentureBeat') ||
          feed.category === 'funding'
      );
    }

    // For B2B lounges, focus on business sources
    if (loungeTypeLower.includes('b2b')) {
      return SAAS_RSS_FEEDS.filter(
        (feed) =>
          feed.category === 'funding' ||
          feed.category === 'wire' ||
          feed.name.includes('SaaS')
      );
    }

    // Default to all feeds
    return SAAS_RSS_FEEDS;
  }

  private prioritizeArticles(
    allArticles: any[],
    categorized: { funding: any[]; news: any[]; wire: any[] },
    limit: number
  ): any[] {
    const prioritized: any[] = [];

    // Take top funding articles first (most important for SaaS digest)
    const fundingToTake = Math.min(categorized.funding.length, Math.floor(limit * 0.4));
    prioritized.push(...categorized.funding.slice(0, fundingToTake));

    // Then news articles
    const newsToTake = Math.min(categorized.news.length, Math.floor(limit * 0.4));
    prioritized.push(...categorized.news.slice(0, newsToTake));

    // Then wire articles
    const wireToTake = Math.min(categorized.wire.length, Math.floor(limit * 0.2));
    prioritized.push(...categorized.wire.slice(0, wireToTake));

    // Fill remaining slots with any articles not yet included
    const remaining = limit - prioritized.length;
    if (remaining > 0) {
      const usedUrls = new Set(prioritized.map((a) => a.link));
      const unused = allArticles.filter((a) => !usedUrls.has(a.link));
      prioritized.push(...unused.slice(0, remaining));
    }

    console.log(
      `[Hybrid News] Prioritized ${prioritized.length} articles ` +
      `(${fundingToTake} funding, ${newsToTake} news, ${wireToTake} wire)`
    );

    return prioritized.slice(0, limit);
  }

  async testRSSFeeds(): Promise<{ feedName: string; status: string; count: number }[]> {
    console.log('[Hybrid News] Testing RSS feeds...');
    const results = [];

    for (const feed of SAAS_RSS_FEEDS) {
      try {
        const articles = await this.rssService.fetchAllFeeds([feed]);
        results.push({
          feedName: feed.name,
          status: 'success',
          count: articles.length,
        });
      } catch (error) {
        results.push({
          feedName: feed.name,
          status: 'failed',
          count: 0,
        });
      }
    }

    return results;
  }
}

let hybridNewsService: HybridNewsService | null = null;

export function getHybridNewsService(): HybridNewsService {
  if (!hybridNewsService) {
    hybridNewsService = new HybridNewsService();
  }
  return hybridNewsService;
}