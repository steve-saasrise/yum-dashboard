import OpenAI from 'openai';

export interface NewsItem {
  text: string;
  summary?: string;
  sourceUrl?: string;
  source?: string;
  amount?: string;
  series?: string;
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

export interface GPT5NewsConfig {
  loungeType: string;
  maxBullets?: number;
  maxSpecialSection?: number;
}

export class GPT5NewsService {
  private client: OpenAI;
  private model: string = 'gpt-5'; // Using GPT-5 model

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  private buildPrompt(config: GPT5NewsConfig): string {
    const maxBullets = config.maxBullets || 5;
    const maxSpecialSection = config.maxSpecialSection || 5;

    return `You are a professional SaaS news curator creating a daily digest for September 15, 2025.

Generate realistic, current SaaS industry news that would be highly relevant today. Focus on:
- Major SaaS companies (Salesforce, HubSpot, Zoom, Slack, Notion, etc.)
- B2B software trends and innovations
- Funding rounds (Series A/B/C/D) with specific amounts
- Product launches and feature updates
- Market analysis and growth metrics
- Enterprise software adoption

Create a structured news digest with:
1. One big story - the most impactful SaaS news
2. ${maxBullets} bullet points - diverse important stories
3. ${maxSpecialSection} funding/M&A items in special section

Return EXACTLY this JSON structure:

{
  "bigStory": {
    "title": "Compelling headline about major SaaS development",
    "summary": "2-3 sentences explaining why this matters to the SaaS community",
    "source": "TechCrunch/Forbes/Reuters/etc",
    "sourceUrl": "https://example.com/article"
  },
  "bullets": [
    {
      "text": "Important SaaS news with company name and context",
      "summary": "1-2 sentences of additional context",
      "source": "Source name",
      "sourceUrl": "https://example.com/article"
    }
  ],
  "specialSection": [
    {
      "text": "Company raises funding or acquisition news",
      "summary": "Brief additional context",
      "amount": "$X million/billion",
      "series": "Series A/B/C/D",
      "source": "Source name",
      "sourceUrl": "https://example.com/article"
    }
  ]
}

Guidelines:
- Each story must be UNIQUE - no duplicates across sections
- Use realistic publication sources (TechCrunch, Forbes, VentureBeat, etc.)
- Include specific metrics and dollar amounts
- Focus on enterprise/B2B SaaS, not consumer apps
- Generate realistic-looking article URLs using the actual source domains (e.g., https://techcrunch.com/2025/09/15/article-slug)
- Ensure geographic diversity (not just Silicon Valley)`;
  }

  public async generateNews(
    config: GPT5NewsConfig
  ): Promise<GenerateNewsResult> {
    try {
      const loungeType = config.loungeType.toLowerCase();
      const isSaaS = loungeType.includes('saas');

      console.log(
        `[GPT-5 News] Generating ${config.loungeType} news digest with web search...`
      );

      const maxBullets = config.maxBullets || 5;
      const maxSpecialSection = config.maxSpecialSection || 5;

      // Get today's date for context
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Build topic-specific prompt
      let instructions, searchQueries, fundingInstructions;

      if (isSaaS) {
        // Keep SaaS exactly as it was
        instructions = `You are a professional SaaS industry news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "SaaS industry" OR "software as a service" OR "B2B software" news from:24h
2. "SaaS funding" OR "Series A B C D" OR "venture capital SaaS" from:24h
3. "enterprise software" OR "cloud computing" OR "business software" announcements from:24h
4. "SaaS acquisition" OR "software company merger" OR "SaaS IPO" from:24h
5. site:techcrunch.com OR site:forbes.com OR site:thesaasnews.com SaaS OR "software as a service" from:24h`;
        fundingInstructions = `${maxSpecialSection} funding/M&A items - primarily from www.thesaasnews.com with verified funding rounds and real amounts`;
      } else if (loungeType.includes('ai')) {
        instructions = `You are a professional AI industry news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "AI funding" OR "artificial intelligence investment" site:techcrunch.com OR site:forbes.com from:24h
2. "OpenAI" OR "Anthropic" OR "Google AI" OR "Microsoft AI" OR "Meta AI" news from:24h
3. "machine learning" OR "deep learning" OR "LLM" announcements from:24h
4. "AI startup" OR "AI acquisition" OR "AI partnership" from:24h
5. For funding section: site:thesaasnews.com AI OR "artificial intelligence" funding`;
        fundingInstructions = `${maxSpecialSection} AI funding/M&A items - with verified funding rounds and real amounts`;
      } else if (loungeType.includes('crypto')) {
        instructions = `You are a professional cryptocurrency and blockchain news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "crypto funding" OR "blockchain investment" site:coindesk.com OR site:cointelegraph.com from:24h
2. "Bitcoin" OR "Ethereum" OR "Solana" OR "major cryptocurrency" news from:24h
3. "DeFi" OR "NFT" OR "Web3" announcements from:24h
4. "crypto acquisition" OR "blockchain merger" OR "token launch" from:24h
5. For funding section: "crypto startup funding" OR "blockchain investment" from:24h`;
        fundingInstructions = `${maxSpecialSection} crypto/blockchain funding items - with verified funding rounds and real amounts`;
      } else if (loungeType.includes('b2b')) {
        instructions = `You are a professional B2B business and growth news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "B2B funding" OR "enterprise software investment" site:techcrunch.com OR site:forbes.com from:24h
2. "sales strategy" OR "marketing automation" OR "customer success" news from:24h
3. "B2B marketplace" OR "enterprise solution" announcements from:24h
4. "B2B acquisition" OR "enterprise merger" from:24h
5. For funding section: site:thesaasnews.com B2B OR enterprise funding`;
        fundingInstructions = `${maxSpecialSection} B2B funding/M&A items - with verified funding rounds and real amounts`;
      } else if (loungeType.includes('venture')) {
        instructions = `You are a professional venture capital and startup news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "venture capital" OR "VC funding" OR "Series A B C" site:techcrunch.com OR site:pitchbook.com from:24h
2. "Sequoia" OR "Andreessen Horowitz" OR "Y Combinator" OR "major VC" news from:24h
3. "startup funding" OR "unicorn" OR "IPO" announcements from:24h
4. "VC fund raise" OR "venture capital merger" from:24h
5. For funding section: site:thesaasnews.com venture OR startup funding rounds`;
        fundingInstructions = `${maxSpecialSection} venture/startup funding items - with verified funding rounds and real amounts`;
      } else {
        // Generic fallback
        instructions = `You are a professional ${config.loungeType} news curator. Today is ${dateStr}. Focus on accuracy and real sources.`;
        searchQueries = `Priority search queries:
1. "${config.loungeType} news" OR "${config.loungeType} updates" from:24h
2. "${config.loungeType} funding" OR "${config.loungeType} investment" from:24h
3. "${config.loungeType} announcements" OR "${config.loungeType} launches" from:24h
4. "${config.loungeType} partnerships" OR "${config.loungeType} acquisitions" from:24h
5. For funding section: "${config.loungeType}" funding OR investment from:24h`;
        fundingInstructions = `${maxSpecialSection} ${config.loungeType} funding/investment items - with verified amounts`;
      }

      // Define allowed domains based on lounge type to avoid paywalls
      let allowedDomains: string[] = [];

      if (isSaaS || loungeType.includes('b2b')) {
        allowedDomains = [
          'techcrunch.com',
          'theverge.com',
          'venturebeat.com',
          'siliconangle.com',
          'thesaasnews.com',
          'saasworthy.com',
          'getlatka.com',
          'zdnet.com',
          'arstechnica.com',
          'reuters.com',
          'apnews.com',
          'prnewswire.com',
          'businesswire.com',
          'producthunt.com',
        ];
      } else if (loungeType.includes('ai')) {
        allowedDomains = [
          'techcrunch.com',
          'theverge.com',
          'venturebeat.com',
          'openai.com',
          'anthropic.com',
          'huggingface.co',
          'arxiv.org',
          'deepmind.com',
          'reuters.com',
          'arstechnica.com',
          'thenextweb.com',
          'engadget.com',
          'prnewswire.com',
          'businesswire.com',
        ];
      } else if (loungeType.includes('crypto')) {
        allowedDomains = [
          'coindesk.com',
          'cointelegraph.com',
          'decrypt.co',
          'theblock.co',
          'bitcoinmagazine.com',
          'cryptoslate.com',
          'u.today',
          'newsbtc.com',
          'cryptonews.com',
          'beincrypto.com',
        ];
      } else if (loungeType.includes('venture')) {
        allowedDomains = [
          'techcrunch.com',
          'venturebeat.com',
          'crunchbase.com',
          'sifted.eu',
          'eu-startups.com',
          'startupnation.com',
          'thesaasnews.com',
          'prnewswire.com',
          'businesswire.com',
          'reuters.com',
          'axios.com',
        ];
      } else {
        // Generic fallback - focus on free, accessible sources
        allowedDomains = [
          'techcrunch.com',
          'theverge.com',
          'venturebeat.com',
          'reuters.com',
          'apnews.com',
          'arstechnica.com',
          'zdnet.com',
          'engadget.com',
          'thenextweb.com',
          'prnewswire.com',
          'businesswire.com',
        ];
      }

      // Use the Responses API with web_search tool
      const response = await (this.client as any).responses.create({
        model: this.model,
        reasoning: {
          effort: 'medium', // Balanced effort for quality and cost
        },
        tools: [
          {
            type: 'web_search',
            search_context_size: 'medium', // Balanced context and latency (default)
            filters: {
              allowed_domains: allowedDomains,
            },
          },
        ],
        include: ['web_search_call.action.sources'],
        instructions: instructions,
        input: `Search for and find the most important ${config.loungeType} news from the LAST 24 HOURS (${dateStr}).

${searchQueries}

Requirements:
- ONLY include news from the last 24 hours
- ONLY use real, verifiable sources (no made-up URLs)
- Focus on major companies and significant funding rounds in the ${config.loungeType} space
- Include actual article URLs from the search results

Essential: Extract and use ACTUAL article URLs from your web search results - do not generate fake URLs.

Format the results as a JSON digest with:
1. One big story - the MOST impactful ${config.loungeType} news from today
2. ${maxBullets} news bullets - diverse important stories from reputable sources
3. ${fundingInstructions}

IMPORTANT: All sourceUrl fields MUST be actual URLs from your web search results, not generated URLs.

Return ONLY a valid JSON object with this exact structure:
{
  "bigStory": {
    "title": "headline from actual news article",
    "summary": "2-3 sentence summary explaining why this matters",
    "source": "publication name",
    "sourceUrl": "actual article URL"
  },
  "bullets": [
    {
      "text": "concise news headline",
      "summary": "1-2 sentence context",
      "source": "publication",
      "sourceUrl": "article URL"
    }
  ],
  "specialSection": [
    {
      "text": "funding/acquisition headline",
      "summary": "brief context about the deal",
      "amount": "$X million/billion",
      "series": "Series A/B/C/D or M&A",
      "source": "publication",
      "sourceUrl": "article URL"
    }
  ]
}`,
      });

      // Extract output_text from the response
      let content = '';

      // Handle different response structures based on GPT-5 Responses API
      if (response.output_text) {
        content = response.output_text;
      } else if (response.output && Array.isArray(response.output)) {
        // Find the output_text item in the output array
        const outputTextItem = response.output.find(
          (item: any) =>
            item.type === 'output_text' ||
            (item.type === 'message' &&
              item.content?.[0]?.type === 'output_text')
        );

        if (outputTextItem) {
          if (outputTextItem.type === 'output_text') {
            content = outputTextItem.text || '';
          } else if (outputTextItem.content?.[0]?.text) {
            content = outputTextItem.content[0].text;
          }
        }
      } else if (response.text) {
        // Some responses might have text directly
        content = response.text;
      }

      // Log web search sources if available for debugging
      if (response.web_search_sources) {
        console.log(
          '[GPT-5 News] Web search sources found:',
          response.web_search_sources.length
        );
      }

      if (!content) {
        console.error(
          '[GPT-5 News] Response structure:',
          JSON.stringify(response, null, 2).substring(0, 1000)
        );
        throw new Error('No output_text found in GPT-5 response');
      }

      console.log('[GPT-5 News] Raw response length:', content.length);

      // Parse the JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error(
          '[GPT-5 News] Response content:',
          content.substring(0, 500)
        );
        throw new Error('No JSON found in GPT-5 response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Transform to match existing format
      const result: GenerateNewsResult = {
        items: parsed.bullets || [],
        bigStory: parsed.bigStory,
        specialSection: parsed.specialSection,
        specialSectionTitle: 'SaaS Funding & M&A',
        topic: config.loungeType,
        generatedAt: new Date().toISOString(),
      };

      console.log(
        `[GPT-5 News] Generated from web search: ${result.items.length} bullets, ` +
          `${result.specialSection?.length || 0} funding items, ` +
          `${result.bigStory ? '1 big story' : 'no big story'}`
      );

      return result;
    } catch (error: any) {
      console.error('[GPT-5 News] Error generating news:', error);
      throw error;
    }
  }
}

// Export singleton instance
let gpt5NewsService: GPT5NewsService | null = null;

export function getGPT5NewsService(): GPT5NewsService {
  if (!gpt5NewsService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    gpt5NewsService = new GPT5NewsService(apiKey);
  }
  return gpt5NewsService;
}
