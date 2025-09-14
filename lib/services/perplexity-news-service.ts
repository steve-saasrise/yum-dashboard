import OpenAI from 'openai';

export interface NewsItem {
  text: string;
  summary?: string;
  sourceUrl?: string;
  source?: string;
  amount?: string; // For fundraising items
  series?: string; // For fundraising items
}

export interface BigStory {
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
}

export interface GenerateNewsResult {
  items: NewsItem[];
  bigStory?: BigStory;
  specialSection?: NewsItem[];
  specialSectionTitle?: string;
  topic: string;
  generatedAt: string;
}

export interface NewsGenerationResult {
  success: boolean;
  content?: GenerateNewsResult;
  error?: string;
  lounge: string;
  articlesFound: number;
  articlesUsed: number;
}

export class PerplexityNewsService {
  private client: OpenAI;
  private lastRequestTime = 0;
  private minRequestInterval = 1200; // 1.2 seconds for 50 RPM limit with safety margin

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Perplexity API key is required');
    }

    // Initialize OpenAI client with Perplexity's base URL
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.perplexity.ai',
    });
  }

  private getTrustedSources(loungeType: string): string[] {
    const sources: { [key: string]: string[] } = {
      saas: [
        // Primary SaaS news sources
        'thesaasnews.com', // Dedicated SaaS funding news - BREAKING NEWS
        'techcrunch.com', // Tech news, SaaS funding rounds
        'venturebeat.com', // Enterprise tech & SaaS coverage
        
        // Major business news with SaaS coverage
        'bloomberg.com', // Business & financial news
        'reuters.com', // Global business breaking news
        'businessinsider.com', // Tech business news
        'wsj.com', // Wall Street Journal
        'forbes.com', // Business news
        'cnbc.com', // Business breaking news
        'ft.com', // Financial Times
        
        // Tech news sites with SaaS coverage
        'theinformation.com', // Premium tech news
        'axios.com', // Tech and business news
        'theverge.com', // Tech news
        'zdnet.com', // Enterprise software news
        
        // VC & funding news
        'crunchbase.com', // Funding announcements
        'pitchbook.com', // VC & PE data
        'sifted.eu', // European startup news
        
        // Enterprise IT news (SaaS adoption)
        'ciodive.com', // IT executive decisions
        'computerworld.com', // Enterprise computing news
      ],

      venture: [
        // Tier 1 - Essential VC sources
        'techcrunch.com', // #1 for breaking funding news
        'venturebeat.com', // Strong VC & AI startup coverage
        'pitchbook.com', // Premium data & verified funding
        'crunchbase.com', // Funding database & news

        // Dedicated VC publications
        'venturecapitaljournal.com', // Premium VC intelligence
        'pehub.com', // PE/VC deal insider info
        'privateequityinternational.com', // Global PE/VC news
        'vcnewsdaily.com', // Dedicated VC news

        // Financial news with VC coverage
        'wsj.com', // WSJ Pro Venture Capital
        'bloomberg.com', // Bloomberg Tech & VC
        'cnbc.com', // CNBC Venture Capital section
        'ft.com', // Financial Times PE/VC
        'forbes.com', // Forbes VC coverage

        // Regional & specialized
        'sifted.eu', // European startup ecosystem
        'axios.com', // Axios Pro Rata newsletter
        'fortune.com', // Fortune Term Sheet
        'reuters.com', // Reuters VC news

        // Data platforms with news
        'news.crunchbase.com', // Crunchbase News
        'buyoutsinsider.com', // Mid-market PE/VC
      ],

      // Placeholder for other lounges - using default sources for now
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
      ],
    };

    // Return the sources for the lounge type, limited to 20 domains max
    const selectedSources = sources[loungeType.toLowerCase()] || sources.ai;
    return selectedSources.slice(0, 20);
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
    const queries: { [key: string]: string } = {
      ai: 'Find specific news articles about AI companies announcing funding, launching products, or making breakthroughs today. Look for individual stories with details about OpenAI, Anthropic, Google AI, Microsoft AI, and AI startups. Include funding amounts and technical details from the articles.',
      saas: 'Find individual news articles about B2B SaaS companies from today. Look for specific stories about funding rounds, acquisitions, product launches from Salesforce, ServiceNow, Datadog, and SaaS startups. Focus on articles with Series A/B/C details and specific amounts.',
      venture:
        'Find specific news articles about venture capital funds and startup funding rounds from today. Look for individual stories about Series A, B, C, or D investments with fund sizes, valuations, and lead investors mentioned in the articles.',
      growth:
        'Find specific news articles about companies announcing growth metrics and milestones today. Look for individual stories with conversion rates, ARR growth, user acquisition numbers, and growth experiments detailed in the articles.',
      crypto:
        'Find specific news articles about cryptocurrency and blockchain from today. Look for individual stories about DeFi launches, token announcements, Web3 funding, and NFT updates with TVL numbers and funding amounts in the articles.',
    };

    return queries[loungeType.toLowerCase()] || queries.ai;
  }

  private getSpecialSectionInfo(loungeType: string): {
    title: string;
    focus: string;
  } {
    const topicLower = loungeType.toLowerCase();

    if (topicLower.includes('growth')) {
      return {
        title: 'Growth Metrics & Experiments',
        focus:
          'Focus on A/B test results with specific conversion improvements, growth experiments with measurable outcomes, and product-led growth metrics.',
      };
    } else if (topicLower.includes('venture')) {
      return {
        title: 'Latest Funding Rounds',
        focus:
          'Focus on Series A/B/C/D rounds with EXACT dollar amounts and SPECIFIC series names (e.g., "Series B", "Series C"). Always include the series field for each funding announcement.',
      };
    } else if (topicLower.includes('ai')) {
      return {
        title: 'AI Funding & Acquisitions',
        focus:
          'Focus on AI company funding rounds with EXACT dollar amounts and SPECIFIC series names (e.g., "Series A", "Seed"). Always include both amount and series fields.',
      };
    } else if (topicLower.includes('saas')) {
      return {
        title: 'SaaS Funding & M&A',
        focus:
          'Focus on SaaS company funding rounds with EXACT valuations and SPECIFIC series names (e.g., "Series B", "Series D"). Always include both amount and series fields.',
      };
    } else if (topicLower.includes('crypto')) {
      return {
        title: 'Crypto Funding & Token Launches',
        focus:
          'Focus on crypto/blockchain funding rounds with EXACT amounts and SPECIFIC series names if applicable. Always include amount and series fields.',
      };
    }

    return {
      title: `${loungeType} Funding & Deals`,
      focus:
        'Focus on company funding rounds with EXACT dollar amounts and SPECIFIC series names (e.g., "Series A", "Series C"). Always include both amount and series fields.',
    };
  }

  private buildSystemPrompt(loungeType: string): string {
    const { focus: specialSectionFocus } =
      this.getSpecialSectionInfo(loungeType);

    return `You are a professional news curator for a ${loungeType} focused newsletter. Your task is to create a structured daily digest from trusted, authoritative news sources.

IMPORTANT: 
- You are searching from a curated list of trusted, high-quality news sources specific to ${loungeType}
- These sources have been vetted for credibility, accuracy, and authority in their respective domains
- Prioritize source diversity - try to include news from different publications when possible to provide varied perspectives
- If the best news comes from a single source that's fine, but when multiple good stories exist, prefer variety
- CRITICAL: Always provide deep links to actual article pages, not homepage URLs or category pages. Each sourceUrl should link directly to the specific article being referenced.

Return a valid JSON object with EXACTLY this structure:

{
  "bigStory": {
    "title": "One impactful headline - make it compelling and specific",
    "summary": "2-3 sentences explaining why this matters to the ${loungeType} community",
    "source": "Source name (e.g., TechCrunch)",
    "sourceUrl": "URL to the article"
  },
  "bullets": [
    {
      "text": "Important news item with company names and brief context",
      "summary": "1-2 sentences of additional context if needed",
      "source": "Source name",
      "sourceUrl": "Direct URL to the specific article (not homepage)"
    }
  ],
  "specialSection": [
    {
      "text": "Specific deal/metric with company name and details",
      "summary": "Brief additional context",
      "amount": "$X million/billion (if applicable)",
      "series": "Series A/B/C/etc (if applicable)",
      "source": "Source name",
      "sourceUrl": "URL to the article"
    }
  ]
}

Guidelines:
- Include exactly 5 items in "bullets"
- Include 1-3 items in "specialSection" (prioritize quality over quantity - only include genuinely newsworthy items)
- ${specialSectionFocus}
- CRITICAL: Each story must be COMPLETELY UNIQUE - no duplicates across bigStory, bullets, and specialSection
- NEVER include the same company/event in multiple sections (e.g., if OpenAI's funding is the big story, don't mention it again in bullets or special section)
- ALWAYS populate the "series" field for funding announcements (e.g., "Seed", "Series A", "Series B", "Series C", "Series D", "Late Stage")
- ALWAYS populate the "amount" field with exact dollar amounts (e.g., "$5M", "$100M", "$1.2B")
- Prioritize breaking news and major announcements
- Include specific company names and dollar amounts where available
- Keep text concise but informative
- Ensure all URLs are deep links to individual articles, not category pages or homepages
- Each URL should point directly to the specific story being referenced`;
  }

  public async generateNewsForLounge(
    loungeName: string
  ): Promise<NewsGenerationResult> {
    try {
      await this.enforceRateLimit();

      // Extract lounge type from name
      let loungeType = loungeName
        .replace(/\s*(Times|Coffee|Lounge|Room|Hub)$/i, '')
        .trim();

      // Special case for B2B Growth
      if (loungeType.toLowerCase() === 'b2b growth') {
        loungeType = 'growth';
      }

      const query = this.getSearchQuery(loungeType);
      const systemPrompt = this.buildSystemPrompt(loungeType);
      const { title: specialSectionTitle } =
        this.getSpecialSectionInfo(loungeType);
      const trustedSources = this.getTrustedSources(loungeType);

      // Make Perplexity API call with search parameters
      const response = await this.client.chat.completions.create({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        temperature: 0.3,
        max_tokens: 4000,
        // @ts-expect-error - Perplexity-specific parameters
        search_recency_filter: 'day',
        return_citations: true,
        search_context_size: 'high',
        search_domain_filter: trustedSources, // Add domain filtering for trusted sources
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content generated from Perplexity');
      }

      // Parse the JSON response
      interface ParsedResponse {
        bigStory?: {
          title: string;
          summary: string;
          source?: string;
          sourceUrl?: string;
        };
        bullets?: Array<{
          text: string;
          summary?: string;
          sourceUrl?: string;
          source?: string;
        }>;
        specialSection?: Array<{
          text: string;
          summary?: string;
          amount?: string;
          series?: string;
          sourceUrl?: string;
          source?: string;
        }>;
      }

      let parsed: ParsedResponse;
      try {
        // Remove any markdown formatting if present
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        parsed = JSON.parse(cleanContent);
      } catch {
        throw new Error('Failed to parse Perplexity response as JSON');
      }

      // Extract and structure the content
      const items: NewsItem[] = [];
      let bigStory: BigStory | undefined;
      const specialSection: NewsItem[] = [];

      // Extract bigStory
      if (parsed.bigStory) {
        bigStory = {
          title: parsed.bigStory.title,
          summary: parsed.bigStory.summary,
          source: parsed.bigStory.source,
          sourceUrl: parsed.bigStory.sourceUrl,
        };
      }

      // Extract bullets
      if (parsed.bullets && Array.isArray(parsed.bullets)) {
        for (const bullet of parsed.bullets.slice(0, 5)) {
          if (bullet.text) {
            items.push({
              text: bullet.text,
              summary: bullet.summary,
              sourceUrl: bullet.sourceUrl,
              source: bullet.source,
            });
          }
        }
      }

      // Extract special section (exactly 3 items)
      if (parsed.specialSection && Array.isArray(parsed.specialSection)) {
        for (const item of parsed.specialSection.slice(0, 3)) {
          if (item.text) {
            specialSection.push({
              text: item.text,
              summary: item.summary,
              amount: item.amount,
              series: item.series,
              sourceUrl: item.sourceUrl,
              source: item.source,
            });
          }
        }
      }

      // Count citations from the response
      const citationsCount =
        items.length + (specialSection.length > 0 ? specialSection.length : 0);

      const result: GenerateNewsResult = {
        items,
        bigStory,
        specialSection: specialSection.length > 0 ? specialSection : undefined,
        specialSectionTitle:
          specialSection.length > 0 ? specialSectionTitle : undefined,
        topic: loungeType,
        generatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        content: result,
        lounge: loungeType,
        articlesFound: citationsCount,
        articlesUsed: items.length + specialSection.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lounge: loungeName,
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
    }

    return results;
  }
}

// Export a singleton instance if API key is available
let perplexityNewsService: PerplexityNewsService | null = null;

export function getPerplexityNewsService(): PerplexityNewsService {
  if (!perplexityNewsService) {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY environment variable is not set');
    }
    perplexityNewsService = new PerplexityNewsService(apiKey);
  }
  return perplexityNewsService;
}
