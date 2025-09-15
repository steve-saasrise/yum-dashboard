interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  keywords?: string[];
  creator?: string[];
  video_url?: string | null;
  description?: string;
  content?: string;
  pubDate?: string;
  pubDateTZ?: string;
  image_url?: string;
  source_id?: string;
  source_name?: string;
  source_url?: string;
  source_icon?: string;
  source_priority?: number;
  country?: string[];
  category?: string[];
  language?: string;
  ai_tag?: string;
  sentiment?: string;
  sentiment_stats?: string;
  ai_region?: string;
  ai_org?: string;
  duplicate?: boolean;
}

interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
}

export interface NewsDataServiceConfig {
  apiKey: string;
  baseUrl?: string;
  requestsPerMinute?: number;
}

export class NewsDataService {
  private apiKey: string;
  private baseUrl: string;
  private lastRequestTime = 0;
  private minRequestInterval: number;

  constructor(config: NewsDataServiceConfig) {
    if (!config.apiKey) {
      throw new Error('NewsData.io API key is required');
    }

    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://newsdata.io/api/1';
    // Default to 30 requests per minute with safety margin
    const requestsPerMinute = config.requestsPerMinute || 30;
    this.minRequestInterval = (60 * 1000) / requestsPerMinute;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private getSearchQuery(loungeType: string): string {
    // Keep queries under 100 characters for free tier
    const queries: { [key: string]: string } = {
      ai: 'artificial intelligence OR OpenAI OR GPT',
      saas: 'SaaS OR B2B software OR cloud',
      venture: 'venture capital OR Series A OR funding',
      growth: 'growth metrics OR conversion OR ARR',
      crypto: 'cryptocurrency OR bitcoin OR blockchain',
    };

    return queries[loungeType.toLowerCase()] || queries.ai;
  }

  private getCategory(loungeType: string): string[] {
    const categories: { [key: string]: string[] } = {
      ai: ['technology', 'science'],
      saas: ['business', 'technology'],
      venture: ['business'],
      growth: ['business', 'technology'],
      crypto: ['technology', 'business'],
    };

    return categories[loungeType.toLowerCase()] || ['technology'];
  }

  private getDomainFilter(loungeType: string): string[] {
    const domains: { [key: string]: string[] } = {
      saas: [
        'thesaasnews.com',  // Moved to top priority
        'techcrunch.com',
        'venturebeat.com',
        'bloomberg.com',
        'reuters.com',
        'businessinsider.com',
        'wsj.com',
        'forbes.com',
        'cnbc.com',
        'ft.com',
        'theinformation.com',
        'axios.com',
        'theverge.com',
        'zdnet.com',
        'crunchbase.com',
        'pitchbook.com',
        'sifted.eu',
        'ciodive.com',
        'computerworld.com',
      ],
      venture: [
        'techcrunch.com',
        'venturebeat.com',
        'pitchbook.com',
        'crunchbase.com',
        'venturecapitaljournal.com',
        'pehub.com',
        'privateequityinternational.com',
        'vcnewsdaily.com',
        'wsj.com',
        'bloomberg.com',
        'cnbc.com',
        'ft.com',
        'forbes.com',
        'sifted.eu',
        'axios.com',
        'fortune.com',
        'reuters.com',
        'news.crunchbase.com',
        'buyoutsinsider.com',
      ],
      ai: [
        'techcrunch.com',
        'venturebeat.com',
        'theverge.com',
        'wired.com',
        'arstechnica.com',
        'forbes.com',
        'bloomberg.com',
        'reuters.com',
        'axios.com',
        'wsj.com',
        'thenextweb.com',
        'engadget.com',
        'technologyreview.com',
      ],
      growth: [
        'techcrunch.com',
        'venturebeat.com',
        'forbes.com',
        'bloomberg.com',
        'wsj.com',
        'businessinsider.com',
        'axios.com',
        'reuters.com',
        'crunchbase.com',
        'pitchbook.com',
        'growthhackers.com',
        'saastr.com',
      ],
      crypto: [
        'coindesk.com',
        'cointelegraph.com',
        'decrypt.co',
        'theblock.co',
        'forbes.com',
        'bloomberg.com',
        'reuters.com',
        'techcrunch.com',
        'venturebeat.com',
        'axios.com',
        'bitcoinmagazine.com',
        'cryptonews.com',
      ],
    };

    return domains[loungeType.toLowerCase()] || [];
  }

  public async fetchLatestNews(
    loungeType: string,
    options: {
      size?: number;
      country?: string;
      language?: string;
      timeframe?: number;
      page?: string;
    } = {}
  ): Promise<NewsDataResponse> {
    await this.enforceRateLimit();

    const query = this.getSearchQuery(loungeType);
    const categories = this.getCategory(loungeType);
    const domains = this.getDomainFilter(loungeType);

    const params = new URLSearchParams({
      apikey: this.apiKey,
      q: query,
      language: options.language || 'en',
      size: String(options.size || 10), // Free tier limit is 10
    });

    // Add timeframe only if provided (requires paid plan)
    if (options.timeframe) {
      params.append('timeframe', String(options.timeframe));
    }

    // Add categories
    if (categories.length > 0) {
      params.append('category', categories.join(','));
    }

    // Add country filter if specified
    if (options.country) {
      params.append('country', options.country);
    }

    // Add priority domain filter to get only high-quality sources
    // top = top 10% most authoritative news domains
    // medium = top 30% of news domains
    // low = top 50% of news domains
    params.append('prioritydomain', 'top');

    // Skip domain filter for free tier - it limits results too much
    // if (domains.length > 0) {
    //   params.append('domain', domains.slice(0, 5).join(','));
    // }

    // Add page token for pagination
    if (options.page) {
      params.append('page', options.page);
    }

    const url = `${this.baseUrl}/latest?${params.toString()}`;

    try {
      console.log(`[NewsData] Fetching news for ${loungeType}...`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `NewsData API error: ${response.status} - ${errorBody}`
        );
      }

      const data: NewsDataResponse = await response.json();

      if (data.status !== 'success') {
        throw new Error(`NewsData API returned status: ${data.status}`);
      }

      console.log(
        `[NewsData] Fetched ${data.results.length} articles for ${loungeType}`
      );

      return data;
    } catch (error) {
      console.error(`[NewsData] Error fetching news:`, error);
      throw error;
    }
  }

  public async fetchNewsByQuery(
    query: string,
    options: {
      size?: number;
      category?: string[];
      country?: string;
      language?: string;
      domain?: string[];
      timeframe?: number;
      page?: string;
    } = {}
  ): Promise<NewsDataResponse> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      apikey: this.apiKey,
      q: query,
      language: options.language || 'en',
      size: String(options.size || 10), // Free tier limit is 10
    });

    if (options.timeframe) {
      params.append('timeframe', String(options.timeframe));
    }

    if (options.category && options.category.length > 0) {
      params.append('category', options.category.join(','));
    }

    if (options.country) {
      params.append('country', options.country);
    }

    if (options.domain && options.domain.length > 0) {
      params.append('domain', options.domain.slice(0, 5).join(','));
    }

    // Add priority domain filter to get only high-quality sources
    params.append('prioritydomain', 'top');

    if (options.page) {
      params.append('page', options.page);
    }

    const url = `${this.baseUrl}/latest?${params.toString()}`;

    try {
      console.log(`[NewsData] Fetching news with custom query: ${query}`);
      const response = await fetch(url);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `NewsData API error: ${response.status} - ${errorBody}`
        );
      }

      const data: NewsDataResponse = await response.json();

      if (data.status !== 'success') {
        throw new Error(`NewsData API returned status: ${data.status}`);
      }

      console.log(`[NewsData] Fetched ${data.results.length} articles`);

      return data;
    } catch (error) {
      console.error(`[NewsData] Error fetching news:`, error);
      throw error;
    }
  }

  public async fetchArchiveNews(
    loungeType: string,
    fromDate: string,
    toDate: string,
    options: {
      size?: number;
      country?: string;
      language?: string;
      page?: string;
    } = {}
  ): Promise<NewsDataResponse> {
    await this.enforceRateLimit();

    const query = this.getSearchQuery(loungeType);
    const categories = this.getCategory(loungeType);

    const params = new URLSearchParams({
      apikey: this.apiKey,
      q: query,
      language: options.language || 'en',
      size: String(options.size || 10), // Free tier limit is 10
      from_date: fromDate,
      to_date: toDate,
    });

    if (categories.length > 0) {
      params.append('category', categories.join(','));
    }

    if (options.country) {
      params.append('country', options.country);
    }

    // Add priority domain filter to get only high-quality sources
    params.append('prioritydomain', 'top');

    if (options.page) {
      params.append('page', options.page);
    }

    const url = `${this.baseUrl}/archive?${params.toString()}`;

    try {
      console.log(
        `[NewsData] Fetching archive news for ${loungeType} from ${fromDate} to ${toDate}`
      );
      const response = await fetch(url);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `NewsData API error: ${response.status} - ${errorBody}`
        );
      }

      const data: NewsDataResponse = await response.json();

      if (data.status !== 'success') {
        throw new Error(`NewsData API returned status: ${data.status}`);
      }

      console.log(
        `[NewsData] Fetched ${data.results.length} archive articles for ${loungeType}`
      );

      return data;
    } catch (error) {
      console.error(`[NewsData] Error fetching archive news:`, error);
      throw error;
    }
  }
}

// Export singleton instance if API key is available
let newsDataService: NewsDataService | null = null;

export function getNewsDataService(): NewsDataService {
  if (!newsDataService) {
    const apiKey = process.env.NEWSDATA_API_KEY;
    if (!apiKey) {
      throw new Error('NEWSDATA_API_KEY environment variable is not set');
    }
    newsDataService = new NewsDataService({ apiKey });
  }
  return newsDataService;
}
