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
      ai: 'What are the latest AI and machine learning developments, funding rounds, product launches, and major announcements from OpenAI, Anthropic, Google AI, Microsoft AI, and AI startups in the past 24 hours from a variety of credible tech and business news sources? Include specific funding amounts and technical breakthroughs. Look across different publications for diverse perspectives.',
      saas: "What are today's B2B SaaS news from a diverse range of major tech publications including enterprise software funding rounds, IPOs, acquisitions, product announcements, and ARR milestones from companies like Salesforce, ServiceNow, Datadog, and emerging SaaS startups? Focus on Series A/B/C funding with specific amounts from multiple reputable sources for broader coverage.",
      venture:
        'What venture capital funds raised new funds today and which startups received Series A, B, C, or D funding in the last 24 hours according to various established business and tech news outlets? Include specific fund sizes, valuations, lead investors, and notable portfolio company exits or IPOs. Search across different sources for comprehensive coverage.',
      growth:
        'What companies announced growth metrics, scaling milestones, A/B test results, or product-led growth experiments today in various credible business and tech publications? Include specific conversion rate improvements, ARR growth percentages, user acquisition numbers, and CAC payback periods. Look for diverse sources to get a complete picture.',
      crypto:
        "What are today's cryptocurrency and blockchain news from a variety of established crypto and tech news sources including DeFi protocol launches, token launches, Web3 funding rounds, NFT marketplace updates, and layer-2 developments? Include TVL numbers, funding amounts, and major partnership announcements. Search multiple sources for varied perspectives.",
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

    return `You are a professional news curator for a ${loungeType} focused newsletter. Your task is to create a structured daily digest from credible news sources and authoritative publications.

IMPORTANT: 
- Focus on credible, established news sources and avoid content farms, promotional material, or low-quality sources
- Prioritize source diversity - try to include news from different publications when possible to provide varied perspectives
- If the best news comes from a single source that's fine, but when multiple good stories exist, prefer variety
- Mix major publications, industry-specific news sites, and reputable tech/business media

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
      "sourceUrl": "URL to the article"
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
- ALWAYS populate the "series" field for funding announcements (e.g., "Seed", "Series A", "Series B", "Series C", "Series D", "Late Stage")
- ALWAYS populate the "amount" field with exact dollar amounts (e.g., "$5M", "$100M", "$1.2B")
- Prioritize breaking news and major announcements
- Include specific company names and dollar amounts where available
- Keep text concise but informative
- Ensure all URLs are from the search results provided`;
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
