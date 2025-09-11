import OpenAI from 'openai';

export interface BraveNewsArticle {
  title: string;
  url: string;
  description?: string;
  age?: string;
  publishedDate?: string;
  source?: string;
}

export interface BraveSearchResponse {
  type?: string;
  results?: Array<{
    type?: string;
    title: string;
    url: string;
    description?: string;
    age?: string;
    page_age?: string;
    meta_url?: {
      hostname?: string;
      netloc?: string;
    };
  }>;
  query?: {
    original?: string;
    altered?: string;
    spellcheck_off?: boolean;
  };
}

export interface NewsGenerationResult {
  success: boolean;
  content?: string;
  error?: string;
  lounge: string;
  articlesFound: number;
  articlesUsed: number;
}

export class BraveNewsService {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/news/search';
  private lastRequestTime = 0;
  private minRequestInterval = 1100; // 1.1 seconds to be safe with rate limit
  private openai: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Brave API key is required');
    }
    this.apiKey = apiKey;

    // Initialize OpenAI
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
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

  private async searchNews(
    query: string,
    count: number = 50
  ): Promise<BraveNewsArticle[]> {
    await this.enforceRateLimit();

    const params = new URLSearchParams({
      q: query,
      count: count.toString(),
      freshness: 'pd', // Past day only
      country: 'us',
      search_lang: 'en',
      safesearch: 'moderate',
    });

    try {
      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('Brave API error response:', errorBody);
        throw new Error(
          `Brave API error: ${response.status} ${response.statusText}`
        );
      }

      const data: BraveSearchResponse = await response.json();

      if (!data.results || data.results.length === 0) {
        return [];
      }

      return data.results.map((article) => ({
        title: article.title,
        url: article.url,
        description: article.description,
        age: article.age,
        publishedDate: article.page_age,
        source: article.meta_url?.hostname || article.meta_url?.netloc,
      }));
    } catch (error) {
      console.error('Error fetching news from Brave:', error);
      throw error;
    }
  }

  private queryIndex: { [key: string]: number } = {};

  private getSearchQueries(loungeType: string): string[] {
    const queries: { [key: string]: string[] } = {
      ai: [
        // Funding focused
        'AI startup raises million series funding',
        'OpenAI Anthropic Google funding round',
        'artificial intelligence company acquisition',
        'generative AI investment venture capital',
        // Product launches
        'OpenAI ChatGPT new model release',
        'Google Gemini AI announcement',
        'Anthropic Claude update features',
        // General AI news
        'AI breakthrough technology announcement',
      ],
      saas: [
        // Funding focused
        'SaaS startup raises million funding',
        'B2B software company acquisition',
        'enterprise software IPO announcement',
        'cloud SaaS merger acquisition deal',
        // Growth metrics
        'SaaS company revenue growth ARR',
        'software company valuation unicorn',
        // General SaaS news
        'B2B SaaS product launch announcement',
      ],
      venture: [
        // Funding rounds
        'startup raises series A B C funding',
        'venture capital new fund billion',
        'unicorn startup valuation funding',
        'seed funding round tech startup',
        // VC news
        'venture capital firm investment',
        'VC portfolio company exit IPO',
        // General venture news
        'startup funding announcement today',
      ],
      growth: [
        // Metrics focused
        'startup revenue growth ARR MRR',
        'company reaches million users milestone',
        'SaaS growth metrics CAC LTV',
        'startup doubles revenue year over year',
        // Growth strategies
        'product led growth success story',
        'company expansion international market',
        // General growth news
        'startup growth announcement metrics',
      ],
      crypto: [
        // Funding focused
        'crypto startup raises funding',
        'blockchain company investment round',
        'cryptocurrency exchange acquisition',
        'DeFi protocol funding announcement',
        // Market news
        'Bitcoin Ethereum price movement',
        'crypto regulation SEC announcement',
        // General crypto news
        'blockchain technology breakthrough',
      ],
    };

    return queries[loungeType.toLowerCase()] || queries.ai;
  }

  private getNextQuery(loungeType: string): string {
    const queries = this.getSearchQueries(loungeType);
    const key = loungeType.toLowerCase();

    // Initialize or increment index
    if (!this.queryIndex[key]) {
      this.queryIndex[key] = 0;
    }

    const query = queries[this.queryIndex[key] % queries.length];
    this.queryIndex[key]++;

    return query;
  }

  private async fetchNewsForLounge(
    loungeType: string
  ): Promise<BraveNewsArticle[]> {
    const allArticles: BraveNewsArticle[] = [];
    const seenUrls = new Set<string>();
    const maxQueries = 3; // Run up to 3 different queries
    const minArticles = 10; // Try to get at least 10 articles

    for (let i = 0; i < maxQueries; i++) {
      // Get next query in rotation
      const searchQuery = this.getNextQuery(loungeType);
      console.log(`[${loungeType}] Query ${i + 1}: "${searchQuery}"`);

      try {
        const articles = await this.searchNews(searchQuery, 50);

        // Add unique articles
        for (const article of articles) {
          if (!seenUrls.has(article.url)) {
            seenUrls.add(article.url);
            allArticles.push(article);
          }
        }

        console.log(
          `[${loungeType}] Total unique articles: ${allArticles.length}`
        );

        // If we have enough articles, stop
        if (allArticles.length >= minArticles) {
          break;
        }
      } catch (error) {
        console.error(`[${loungeType}] Query failed:`, error);
      }
    }

    return allArticles;
  }

  private buildGPTPrompt(
    loungeType: string,
    articles: BraveNewsArticle[]
  ): string {
    const loungeContext: { [key: string]: string } = {
      ai: 'AI and machine learning',
      saas: 'SaaS and B2B software',
      venture: 'venture capital and startup funding',
      growth: 'startup growth and scaling',
      crypto: 'cryptocurrency and blockchain',
    };

    const specialSectionPrompt: { [key: string]: string } = {
      ai: 'AI Funding & Acquisitions (include $ amounts)',
      saas: 'SaaS Funding & M&A (include $ amounts)',
      venture: 'Latest Funding Rounds (include $ amounts)',
      growth: 'Growth Metrics & Experiments (include specific numbers)',
      crypto: 'Crypto Funding & Token Launches (include $ amounts)',
    };

    const context = loungeContext[loungeType.toLowerCase()] || 'technology';
    const specialSection =
      specialSectionPrompt[loungeType.toLowerCase()] || 'Industry Updates';

    const articlesText = articles
      .slice(0, 20)
      .map(
        (article, i) =>
          `${i + 1}. ${article.title}\n   ${article.description || 'No description'}\n   Source: ${article.source || 'Unknown'}\n   URL: ${article.url}`
      )
      .join('\n\n');

    return `You are a curator for a ${context} focused newsletter. Based on these news articles from the last 24 hours, create a concise daily digest.

Articles:
${articlesText}

Create a news digest with EXACTLY this structure:

**Big Story**
[One impactful headline - make it compelling and specific]
[2-3 sentence summary explaining why this matters]

**Headlines**
• [Bullet 1 - Important story with brief context]
• [Bullet 2 - Important story with brief context]  
• [Bullet 3 - Important story with brief context]
• [Bullet 4 - Important story with brief context]
• [Bullet 5 - Important story with brief context]

**${specialSection}**
• [Specific deal/metric with $ amount or numbers]
• [Specific deal/metric with $ amount or numbers]
• [Specific deal/metric with $ amount or numbers]

Guidelines:
- Focus on ${context} news only
- Include specific company names and dollar amounts
- Keep bullets concise but informative
- Prioritize breaking news and major announcements
- For the special section, ONLY include items with specific metrics or dollar amounts`;
  }

  public async generateNewsForLounge(
    loungeType: string
  ): Promise<NewsGenerationResult> {
    try {
      console.log(`\n=== Generating news for ${loungeType} lounge ===`);

      // Fetch articles from Brave
      const articles = await this.fetchNewsForLounge(loungeType);

      if (articles.length === 0) {
        return {
          success: false,
          error: 'No articles found for this lounge',
          lounge: loungeType,
          articlesFound: 0,
          articlesUsed: 0,
        };
      }

      // Generate summary with GPT
      const prompt = this.buildGPTPrompt(loungeType, articles);
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional news curator. Create concise, informative digests.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_completion_tokens: 3000,
      });

      const content = completion.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content generated from GPT');
      }

      return {
        success: true,
        content,
        lounge: loungeType,
        articlesFound: articles.length,
        articlesUsed: Math.min(20, articles.length),
      };
    } catch (error) {
      console.error(`Error generating news for ${loungeType}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lounge: loungeType,
        articlesFound: 0,
        articlesUsed: 0,
      };
    }
  }

  public async generateNewsForAllLounges(): Promise<NewsGenerationResult[]> {
    const lounges = ['AI', 'SaaS', 'Venture', 'Growth', 'Crypto'];
    const results: NewsGenerationResult[] = [];

    for (const lounge of lounges) {
      const result = await this.generateNewsForLounge(lounge);
      results.push(result);

      // Add extra delay between different lounges to respect rate limit
      if (lounge !== lounges[lounges.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return results;
  }
}

// Export a singleton instance if API key is available
let braveNewsService: BraveNewsService | null = null;

export function getBraveNewsService(): BraveNewsService {
  if (!braveNewsService) {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY environment variable is not set');
    }
    braveNewsService = new BraveNewsService(apiKey);
  }
  return braveNewsService;
}
