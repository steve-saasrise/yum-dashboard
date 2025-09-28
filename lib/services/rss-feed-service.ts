import Parser from 'rss-parser';

export interface RSSFeedSource {
  name: string;
  url: string;
  category: 'funding' | 'news' | 'wire' | 'mixed';
  priority: number;
}

export interface RSSArticle {
  title: string;
  link: string;
  pubDate: string;
  content?: string;
  contentSnippet?: string;
  source: string;
  sourceCategory: string;
  guid?: string;
}

export const SAAS_RSS_FEEDS: RSSFeedSource[] = [
  // Primary funding/investment news
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'mixed',
    priority: 1,
  },
  {
    name: 'TechCrunch Venture',
    url: 'https://techcrunch.com/category/venture/feed/',
    category: 'funding',
    priority: 1,
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    category: 'funding',
    priority: 1,
  },
  // Startup funding news
  {
    name: 'TechStartups',
    url: 'https://techstartups.com/feed/',
    category: 'funding',
    priority: 1,
  },
  {
    name: 'EU-Startups',
    url: 'https://www.eu-startups.com/feed/',
    category: 'funding',
    priority: 2,
  },
  {
    name: 'Sifted',
    url: 'https://sifted.eu/feed',
    category: 'funding',
    priority: 2,
  },
  // Primary tech news sources
  {
    name: 'SiliconANGLE',
    url: 'https://siliconangle.com/feed/',
    category: 'news',
    priority: 1,
  },
  {
    name: 'CNBC Technology',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',
    category: 'news',
    priority: 1,
  },
  {
    name: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'news',
    priority: 1,
  },
  {
    name: 'VentureBeat',
    url: 'https://feeds.feedburner.com/venturebeat/SZYF',
    category: 'news',
    priority: 2,
  },
];

export class RSSFeedService {
  private parser: Parser;
  private readonly maxAge = 48 * 60 * 60 * 1000; // 48 hours in ms (fallback)
  private readonly preferredMaxAge = 24 * 60 * 60 * 1000; // 24 hours in ms (preferred)
  private readonly minArticlesRequired = 10; // Minimum articles needed before falling back to 48 hours
  private readonly cacheTimeout = 30 * 60 * 1000; // 30 minutes cache

  constructor() {
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
      },
      customFields: {
        item: [
          ['media:content', 'media:content', { keepArray: false }],
          ['description', 'description'],
        ],
      },
    });
  }

  async fetchAllFeeds(
    feeds: RSSFeedSource[] = SAAS_RSS_FEEDS
  ): Promise<RSSArticle[]> {
    console.log(`[RSS Feed] Fetching from ${feeds.length} RSS feeds...`);

    const fetchPromises = feeds.map(async (feed) => {
      try {
        return await this.fetchFeed(feed);
      } catch (error) {
        console.error(`[RSS Feed] Error fetching ${feed.name}:`, error);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const allArticles = results.flat();

    console.log(`[RSS Feed] Fetched ${allArticles.length} total articles`);

    return this.filterRecentArticles(allArticles);
  }

  private async fetchFeed(feedSource: RSSFeedSource): Promise<RSSArticle[]> {
    try {
      console.log(`[RSS Feed] Fetching ${feedSource.name}...`);
      const startTime = Date.now();

      const feed = await this.parser.parseURL(feedSource.url);

      const articles: RSSArticle[] = [];

      for (const item of feed.items || []) {
        if (!item.title || !item.link) continue;

        articles.push({
          title: this.cleanText(item.title),
          link: item.link,
          pubDate: item.pubDate || new Date().toISOString(),
          content: this.cleanText(item.content || item.description || ''),
          contentSnippet: this.cleanText(
            item.contentSnippet ||
              this.extractSnippet(item.content || item.description || '')
          ),
          source: feedSource.name,
          sourceCategory: feedSource.category,
          guid: item.guid || item.link,
        });
      }

      console.log(
        `[RSS Feed] ${feedSource.name}: ${articles.length} articles (${Date.now() - startTime}ms)`
      );

      return articles;
    } catch (error) {
      console.error(`[RSS Feed] Failed to fetch ${feedSource.name}:`, error);
      throw error;
    }
  }

  private filterRecentArticles(articles: RSSArticle[]): RSSArticle[] {
    const now = Date.now();
    const twentyFourHoursAgo = now - this.preferredMaxAge;
    const fortyEightHoursAgo = now - this.maxAge;

    // First, try to get articles from last 24 hours
    let recentArticles = articles.filter((article) => {
      try {
        const pubDate = new Date(article.pubDate).getTime();
        return pubDate > twentyFourHoursAgo;
      } catch {
        return false;
      }
    });

    console.log(
      `[RSS Feed] Found ${recentArticles.length} articles from last 24 hours`
    );

    // If we don't have enough articles, fall back to 48 hours
    if (recentArticles.length < this.minArticlesRequired) {
      console.log(
        `[RSS Feed] Not enough articles (< ${this.minArticlesRequired}), falling back to 48 hours`
      );

      recentArticles = articles.filter((article) => {
        try {
          const pubDate = new Date(article.pubDate).getTime();
          return pubDate > fortyEightHoursAgo;
        } catch {
          return false;
        }
      });

      console.log(
        `[RSS Feed] Expanded to ${recentArticles.length} articles from last 48 hours`
      );
    }

    // Sort by publication date (newest first)
    recentArticles.sort((a, b) => {
      const dateA = new Date(a.pubDate).getTime();
      const dateB = new Date(b.pubDate).getTime();
      return dateB - dateA;
    });

    return recentArticles;
  }

  private cleanText(text: string): string {
    if (!text) return '';

    // Remove HTML tags
    let cleaned = text.replace(/<[^>]*>/g, '');

    // Decode HTML entities
    cleaned = cleaned
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ');

    // Remove excess whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned;
  }

  private extractSnippet(content: string, maxLength: number = 200): string {
    const cleaned = this.cleanText(content);
    if (cleaned.length <= maxLength) return cleaned;

    // Try to break at a sentence
    const truncated = cleaned.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');

    if (lastPeriod > maxLength * 0.7) {
      return truncated.substring(0, lastPeriod + 1);
    }

    // Otherwise break at word boundary
    const lastSpace = truncated.lastIndexOf(' ');
    return truncated.substring(0, lastSpace) + '...';
  }

  dedupArticles(articles: RSSArticle[]): RSSArticle[] {
    const seen = new Map<string, RSSArticle>();

    for (const article of articles) {
      // Create a normalized key for deduplication
      const key = this.createDedupeKey(article);

      if (!seen.has(key)) {
        seen.set(key, article);
      } else {
        // Keep the article with higher priority source
        const existing = seen.get(key)!;
        const existingPriority =
          SAAS_RSS_FEEDS.find((f) => f.name === existing.source)?.priority ||
          999;
        const currentPriority =
          SAAS_RSS_FEEDS.find((f) => f.name === article.source)?.priority ||
          999;

        if (currentPriority < existingPriority) {
          seen.set(key, article);
        }
      }
    }

    const dedupedArticles = Array.from(seen.values());
    console.log(
      `[RSS Feed] Deduped from ${articles.length} to ${dedupedArticles.length} articles`
    );

    return dedupedArticles;
  }

  private createDedupeKey(article: RSSArticle): string {
    // Try to extract company name and funding amount for better deduplication
    const title = article.title.toLowerCase();

    // Extract funding amount if present
    const amountMatch = title.match(/\$[\d.]+[mb]/i);
    const amount = amountMatch ? amountMatch[0] : '';

    // Extract company name (usually first few words before "raises" or "secures")
    const companyMatch = title.match(
      /^([^,]+?)(?:\s+raises|\s+secures|\s+closes|\s+gets)/i
    );
    const company = companyMatch
      ? companyMatch[1].trim()
      : title.substring(0, 30);

    // Create key from company + amount (if funding) or just normalized title
    if (amount && company) {
      return `${company}_${amount}`.replace(/[^a-z0-9_]/g, '');
    }

    // Fallback to normalized title
    return title.substring(0, 50).replace(/[^a-z0-9]/g, '');
  }

  categorizeArticles(articles: RSSArticle[]): {
    funding: RSSArticle[];
    news: RSSArticle[];
    wire: RSSArticle[];
  } {
    const categorized = {
      funding: [] as RSSArticle[],
      news: [] as RSSArticle[],
      wire: [] as RSSArticle[],
    };

    for (const article of articles) {
      const titleLower = article.title.toLowerCase();

      // Check if it's a funding article based on keywords
      const fundingKeywords = [
        'raises',
        'secures',
        'funding',
        'series',
        'seed',
        'investment',
        'valuation',
        'acquires',
        'acquisition',
        'merger',
        'm&a',
        'ipo',
        'closes $',
        'raises $',
      ];

      const isFunding = fundingKeywords.some((keyword) =>
        titleLower.includes(keyword)
      );

      if (isFunding || article.sourceCategory === 'funding') {
        categorized.funding.push(article);
      } else if (article.sourceCategory === 'wire') {
        categorized.wire.push(article);
      } else {
        categorized.news.push(article);
      }
    }

    console.log(
      `[RSS Feed] Categorized: ${categorized.funding.length} funding, ` +
        `${categorized.news.length} news, ${categorized.wire.length} wire`
    );

    return categorized;
  }
}

let rssFeedService: RSSFeedService | null = null;

export function getRSSFeedService(): RSSFeedService {
  if (!rssFeedService) {
    rssFeedService = new RSSFeedService();
  }
  return rssFeedService;
}
