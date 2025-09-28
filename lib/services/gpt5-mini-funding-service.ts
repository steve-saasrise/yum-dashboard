import OpenAI from 'openai';

export interface FundingItem {
  text: string;
  summary: string;
  amount: string;
  series?: string;
  investors?: string;
  valuation?: string;
  source: string;
  sourceUrl: string;
  company?: string;
  industry?: string;
  date?: string;
}

export interface FundingSearchResult {
  fundingItems: FundingItem[];
  searchedAt: string;
  totalFound: number;
}

export interface FundingSearchConfig {
  loungeType?: string;
  maxResults?: number;
  timeframe?: string; // e.g., "24h", "7d", "30d"
  minAmount?: string; // e.g., "$1M", "$10M"
}

export class GPT5MiniFundingService {
  private client: OpenAI;
  private model: string = 'gpt-5-mini'; // Using GPT-5-mini for cost efficiency

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  private getAllowedDomains(loungeType: string): string[] {
    const baseDomains = [
      'thesaasnews.com', // Primary funding source - no RSS feed
      'crunchbase.com',  // Funding database
      'pitchbook.com',   // VC and PE data
      'techcrunch.com',  // Major tech news
      'venturebeat.com', // Tech funding news
      'sifted.eu',       // European startups
      'eu-startups.com', // EU funding
      'betakit.com',     // Canadian startups
      'tech.eu',         // European tech
      'prnewswire.com',  // Press releases
      'businesswire.com', // Business announcements
      'globenewswire.com', // Global announcements
    ];

    // Add specialized domains based on lounge type
    if (loungeType.includes('crypto')) {
      return [
        ...baseDomains,
        'coindesk.com',
        'theblock.co',
        'decrypt.co',
      ];
    } else if (loungeType.includes('ai')) {
      return [
        ...baseDomains,
        'aiindex.stanford.edu',
        'theaivalley.com',
      ];
    } else if (loungeType.includes('health') || loungeType.includes('bio')) {
      return [
        ...baseDomains,
        'fiercebiotech.com',
        'medtechdive.com',
        'mobihealthnews.com',
      ];
    }

    return baseDomains;
  }

  private buildSearchQueries(config: FundingSearchConfig): string {
    const loungeType = config.loungeType?.toLowerCase() || 'saas';
    const timeframe = config.timeframe || '24h';

    const queries = [];

    // Primary funding query - always search thesaasnews.com first
    queries.push(`site:thesaasnews.com funding OR "series" OR "raises"`);

    // Type-specific queries
    if (loungeType.includes('saas') || loungeType.includes('b2b')) {
      queries.push(`"SaaS startup" OR "B2B software" funding "Series A" OR "Series B" OR "Series C"`);
      queries.push(`site:crunchbase.com SaaS OR "software as a service" funding`);
      queries.push(`"enterprise software" OR "cloud computing" raises OR secures`);
    } else if (loungeType.includes('ai')) {
      queries.push(`"AI startup" OR "artificial intelligence" funding OR investment from:${timeframe}`);
      queries.push(`"machine learning" OR "deep learning" OR "LLM" raises from:${timeframe}`);
      queries.push(`site:crunchbase.com AI OR "artificial intelligence" Series from:${timeframe}`);
    } else if (loungeType.includes('crypto')) {
      queries.push(`"crypto startup" OR "blockchain" funding OR investment from:${timeframe}`);
      queries.push(`"DeFi" OR "Web3" OR "NFT" raises OR secures from:${timeframe}`);
      queries.push(`cryptocurrency OR token "Series A" OR "seed funding" from:${timeframe}`);
    } else if (loungeType.includes('venture')) {
      queries.push(`"venture capital" OR "VC funding" "closes fund" OR "raises fund" from:${timeframe}`);
      queries.push(`"Series A" OR "Series B" OR "Series C" OR "Series D" from:${timeframe}`);
      queries.push(`startup funding OR investment "led by" OR "participated" from:${timeframe}`);
    }

    // General funding queries (broader search without time restriction)
    queries.push(`"$" million OR billion "Series" OR "funding round"`);
    queries.push(`"M&A" OR acquisition OR "acquires" OR "acquired by" tech`);

    return queries.join('\n');
  }

  public async searchFundingNews(
    config: FundingSearchConfig = {}
  ): Promise<FundingSearchResult> {
    try {
      const maxResults = config.maxResults || 10;
      const loungeType = config.loungeType || 'saas';
      const allowedDomains = this.getAllowedDomains(loungeType);

      console.log(
        `[GPT-5-mini Funding] Searching for ${loungeType} funding news from specialized sources...`
      );

      const searchQueries = this.buildSearchQueries(config);

      // Use the Responses API with web_search tool
      const response = await (this.client as any).responses.create({
        model: this.model,
        reasoning: {
          effort: 'low', // Low effort for cost efficiency with mini model
        },
        tools: [
          {
            type: 'web_search',
            search_context_size: 'low', // Low context for focused search and cost efficiency
            filters: {
              allowed_domains: allowedDomains.slice(0, 20), // API limit is 20 domains
            },
          },
        ],
        include: ['web_search_call.action.sources'],
        instructions: `You are a specialized funding news aggregator. Focus on finding REAL, RECENT funding rounds and M&A activity.`,
        input: `Search for and extract ${maxResults} RECENT funding rounds and M&A deals.

Priority search queries:
${searchQueries}

CRITICAL REQUIREMENTS:
1. Include RECENT funding news (prioritize last ${config.timeframe || '48 hours'} but include older if needed)
2. MUST have actual funding amounts (e.g., "$15 million", "$2.5 billion")
3. MUST use real article URLs from search results - NO fake URLs
4. Focus on thesaasnews.com as primary source when available
5. Include company name, amount raised, series/round, and investors when available
6. Prioritize larger funding rounds and well-known companies
7. Include both funding rounds AND acquisitions/M&A deals

Extract funding items and return as JSON. If no funding news is found, return empty array.

ALWAYS return this EXACT JSON structure (even with 0 items):

{
  "fundingItems": [
    {
      "text": "Company raises $X million in Series Y",
      "summary": "Brief 1-2 sentence description of the deal and why it matters",
      "amount": "$X million",
      "series": "Series A/B/C/D or Acquisition",
      "investors": "Lead investor and notable participants",
      "company": "Company name",
      "industry": "Industry/sector",
      "source": "Publication name",
      "sourceUrl": "ACTUAL article URL from search results"
    }
  ]
}

If no funding items found, return: {"fundingItems": []}

IMPORTANT:
- Prioritize thesaasnews.com articles when found
- All sourceUrl fields MUST be actual URLs from web search results
- Focus on substantial funding rounds (preferably $1M+)
- Include variety: different stages (seed to Series D), industries, and geographies`,
      });

      // Extract output from response
      let content = '';

      if (response.output_text) {
        content = response.output_text;
      } else if (response.output && Array.isArray(response.output)) {
        const outputTextItem = response.output.find(
          (item: any) =>
            item.type === 'output_text' ||
            (item.type === 'message' && item.content?.[0]?.type === 'output_text')
        );

        if (outputTextItem) {
          if (outputTextItem.type === 'output_text') {
            content = outputTextItem.text || '';
          } else if (outputTextItem.content?.[0]?.text) {
            content = outputTextItem.content[0].text;
          }
        }
      } else if (response.text) {
        content = response.text;
      }

      // Log web search sources for debugging
      if (response.web_search_sources) {
        const saasnewsSources = response.web_search_sources.filter(
          (s: any) => s.url?.includes('thesaasnews.com')
        );
        console.log(
          `[GPT-5-mini Funding] Found ${response.web_search_sources.length} sources (${saasnewsSources.length} from thesaasnews.com)`
        );
      }

      if (!content) {
        throw new Error('No output_text found in GPT-5-mini response');
      }

      console.log('[GPT-5-mini Funding] Response content length:', content.length);

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('[GPT-5-mini Funding] Response content (first 500 chars):', content.substring(0, 500));

        // If no JSON found, check if it's a "no results" message
        if (content.toLowerCase().includes('blocked') ||
            content.toLowerCase().includes('no ') ||
            content.toLowerCase().includes('unable') ||
            content.toLowerCase().includes('cannot find')) {
          console.log('[GPT-5-mini Funding] No funding items found in search window');
          return {
            fundingItems: [],
            searchedAt: new Date().toISOString(),
            totalFound: 0,
          };
        }

        throw new Error('No JSON found in GPT-5-mini response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and clean funding items
      const fundingItems = (parsed.fundingItems || []).map((item: any) => ({
        text: item.text || '',
        summary: item.summary || '',
        amount: item.amount || 'Undisclosed',
        series: item.series || '',
        investors: item.investors || '',
        valuation: item.valuation || '',
        source: item.source || '',
        sourceUrl: item.sourceUrl || '',
        company: item.company || '',
        industry: item.industry || '',
        date: item.date || new Date().toISOString(),
      }));

      const result: FundingSearchResult = {
        fundingItems,
        searchedAt: new Date().toISOString(),
        totalFound: fundingItems.length,
      };

      console.log(
        `[GPT-5-mini Funding] Found ${result.totalFound} funding items from specialized sources`
      );

      // Log sample of sources for verification
      if (fundingItems.length > 0) {
        const sources = fundingItems.map((item: FundingItem) => item.source);
        const uniqueSources = [...new Set(sources)];
        console.log(`[GPT-5-mini Funding] Sources used: ${uniqueSources.join(', ')}`);

        const thesaasnewsCount = fundingItems.filter(
          (item: FundingItem) => item.sourceUrl.includes('thesaasnews.com')
        ).length;
        if (thesaasnewsCount > 0) {
          console.log(`[GPT-5-mini Funding] ${thesaasnewsCount} items from thesaasnews.com`);
        }
      }

      return result;
    } catch (error: any) {
      console.error('[GPT-5-mini Funding] Error searching funding news:', error);

      // Return empty result on error
      return {
        fundingItems: [],
        searchedAt: new Date().toISOString(),
        totalFound: 0,
      };
    }
  }
}

// Export singleton instance
let gpt5MiniFundingService: GPT5MiniFundingService | null = null;

export function getGPT5MiniFundingService(): GPT5MiniFundingService {
  if (!gpt5MiniFundingService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    gpt5MiniFundingService = new GPT5MiniFundingService(apiKey);
  }
  return gpt5MiniFundingService;
}