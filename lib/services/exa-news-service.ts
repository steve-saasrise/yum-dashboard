import Exa from 'exa-js';
import OpenAI from 'openai';

interface NewsItem {
  text: string;
  summary?: string;
  sourceUrl?: string;
  source?: string;
  amount?: string; // For fundraising items (e.g., "$500M")
  series?: string; // For fundraising items (e.g., "Series H")
}

interface BigStory {
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
}

interface GenerateNewsResult {
  items: NewsItem[];
  bigStory?: BigStory;
  specialSection?: NewsItem[];
  specialSectionTitle?: string;
  topic: string;
  generatedAt: string;
}

export class ExaNewsService {
  private exa: Exa | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    const exaApiKey = process.env.EXA_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (exaApiKey) {
      this.exa = new Exa(exaApiKey);
    }

    if (openaiApiKey) {
      this.openai = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  /**
   * Clean topic name by removing "Coffee" and similar suffixes
   */
  private getCleanTopic(
    loungeName: string,
    loungeDescription?: string
  ): string {
    // Use description if available
    if (loungeDescription) {
      return loungeDescription;
    }

    // Otherwise clean the name (remove "Coffee" and similar suffixes)
    return loungeName.replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '').trim();
  }

  /**
   * Generate news summary for a specific topic using Exa for search and GPT for curation
   */
  async generateNews(
    loungeName: string,
    loungeDescription?: string
  ): Promise<GenerateNewsResult> {
    if (!this.exa || !this.openai) {
      throw new Error('Exa or OpenAI API key not configured');
    }

    const topic = this.getCleanTopic(loungeName, loungeDescription);

    // Determine special section type and title based on topic
    const topicLower = topic.toLowerCase();
    const isGrowthTopic = topicLower.includes('growth');
    const isVentureTopic = topicLower.includes('venture');
    const isCryptoTopic = topicLower.includes('crypto') || topicLower.includes('blockchain');

    // Special section should focus on money/deals/metrics
    const specialSectionType = isGrowthTopic
      ? 'growth metrics and experiments'
      : 'funding and acquisitions';

    // Generate topic-specific titles and focus
    let specialSectionTitle: string;
    let specialSectionFocus: string;
    
    if (isGrowthTopic) {
      specialSectionTitle = 'Growth Metrics & Experiments';
      specialSectionFocus = 'ONLY include: A/B test results with specific conversion improvements (e.g., "increased signups by 47%"), growth experiments with measurable outcomes, product-led growth metrics, viral coefficient improvements. EXCLUDE: general growth advice, conferences, tools without specific results';
    } else if (isVentureTopic) {
      specialSectionTitle = 'Latest Funding Rounds';
      specialSectionFocus = 'ONLY include: Series A/B/C/D/E/F rounds with exact amounts (e.g., "$50M Series B"), seed funding with amounts, acquisitions with valuations, IPO announcements. Must include dollar amounts. EXCLUDE: events, conferences, general VC news';
    } else if (topicLower.includes('ai')) {
      specialSectionTitle = 'AI Funding & Acquisitions';
      specialSectionFocus = 'ONLY include: AI company funding rounds with specific amounts (e.g., "Anthropic raises $450M"), AI startup acquisitions with deal values, AI unicorn valuations. Must include dollar amounts. EXCLUDE: product launches, research papers, conferences';
    } else if (topicLower.includes('saas')) {
      specialSectionTitle = 'SaaS Funding & M&A';
      specialSectionFocus = 'ONLY include: SaaS company funding rounds with amounts, SaaS acquisitions with valuations, SaaS IPOs or exit deals. Must include dollar amounts. EXCLUDE: product updates, integrations, partnerships without financial terms';
    } else if (isCryptoTopic) {
      specialSectionTitle = 'Crypto Funding & Token Launches';
      specialSectionFocus = 'ONLY include: Crypto/blockchain company funding rounds with amounts (e.g., "Uniswap Labs raises $165M"), token launches with initial valuations, crypto acquisitions, DeFi protocol TVL milestones. Must include dollar amounts or percentages. EXCLUDE: price movements, conferences, regulatory news, general announcements';
    } else {
      specialSectionTitle = `${topic} Funding & Deals`;
      specialSectionFocus = 'ONLY include: Company funding rounds with specific dollar amounts, acquisitions with deal values, IPOs, major commercial deals with financial terms. EXCLUDE: partnerships without financial details, product launches, events';
    }

    try {
      // Calculate date for last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

      // Format dates as YYYY-MM-DD
      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };

      // Build natural language query for neural search (not keyword lists)
      let searchQuery = '';
      let category: 'news' | 'company' | 'research paper' | undefined = 'news';

      // Use natural language queries that describe what we want
      if (
        topicLower.includes('ai') ||
        loungeDescription?.toLowerCase().includes('artificial intelligence')
      ) {
        // Natural language query for AI news
        searchQuery = `Latest groundbreaking AI developments: new model releases from OpenAI Anthropic Google DeepMind, major AI funding rounds, breakthrough research papers, AI regulation updates`;
      } else if (
        topicLower.includes('saas') ||
        loungeDescription?.toLowerCase().includes('software as a service')
      ) {
        // Natural language query for SaaS news
        searchQuery = `Major SaaS company announcements: enterprise software funding rounds, B2B product launches, SaaS acquisitions and IPOs, product-led growth success stories`;
      } else if (
        topicLower.includes('venture') ||
        loungeDescription?.toLowerCase().includes('venture capital')
      ) {
        // Natural language query for VC news
        searchQuery = `Significant venture capital deals: Series A B C funding announcements, unicorn valuations, major VC firm investments, startup acquisitions and IPOs`;
        category = 'company';
      } else if (
        topicLower.includes('growth') ||
        loungeDescription?.toLowerCase().includes('growth strategies')
      ) {
        // Natural language query for growth news
        searchQuery = `Growth hacking case studies and results: successful A/B testing experiments, conversion optimization wins, viral marketing campaigns, product-led growth strategies`;
      } else if (
        topicLower.includes('crypto') ||
        loungeDescription?.toLowerCase().includes('blockchain')
      ) {
        // Natural language query for crypto - more focused on news
        searchQuery = `Major cryptocurrency and blockchain news: Bitcoin Ethereum price movements, DeFi protocol launches, crypto regulation updates, institutional adoption, major hacks or security incidents`;
      } else {
        // Fallback: use natural description
        searchQuery = loungeDescription 
          ? `Latest important news and developments in ${loungeDescription}`
          : `Breaking news and major announcements in ${topic} industry`;
      }

      // Log the search details
      console.log(`[Exa News Service] Starting search for ${topic}...`);
      console.log(
        `[Exa News Service] Using search query: "${searchQuery.substring(0, 200)}${searchQuery.length > 200 ? '...' : ''}"`
      );
      console.log(
        `[Exa News Service] Lounge description: "${loungeDescription || 'Not provided'}"`
      );

      // Perform Exa search with optimized parameters for relevancy
      const searchResults = await this.exa.searchAndContents(searchQuery, {
        numResults: 25, // Increased for better selection
        useAutoprompt: true, // Enable Exa's query enhancement
        type: 'neural', // Force neural search for better relevancy
        category, // Focus on news/company results
        startPublishedDate: formatDate(startDate),
        endPublishedDate: formatDate(endDate),
        text: {
          maxCharacters: 1000, // More context for better curation
          includeHtmlTags: false,
        },
        excludeDomains: [
          'reddit.com',
          'facebook.com',
          'instagram.com',
          'pinterest.com',
          'tiktok.com',
          'twitter.com',
          'x.com',
          'linkedin.com',
          'youtube.com',
          'medium.com', // Often has low-quality content
          'substack.com', // Personal blogs, not major news
          'dev.to', // Developer blogs, not news
        ],
        // Add quality-focused domains
        includeDomains: topicLower.includes('crypto') ? [
          'coindesk.com',
          'cointelegraph.com',
          'decrypt.co',
          'theblock.co',
          'blockworks.co'
        ] : topicLower.includes('ai') ? [
          'techcrunch.com',
          'theverge.com',
          'wired.com',
          'venturebeat.com',
          'arstechnica.com',
          'reuters.com',
          'bloomberg.com',
          'theinformation.com'
        ] : undefined,
      } as any);

      console.log(
        `[Exa News Service] Found ${searchResults.results.length} results for ${topic}`
      );

      if (searchResults.results.length === 0) {
        console.log(
          `[Exa News Service] No results found for ${topic}, returning empty news`
        );
        return {
          items: [],
          topic,
          generatedAt: new Date().toISOString(),
        };
      }

      // Prepare content for GPT curation with more context
      const articlesForCuration = searchResults.results.map(
        (result, index) => ({
          index: index + 1,
          title: result.title,
          url: result.url,
          publishedDate: result.publishedDate,
          excerpt: result.text || '', // Use full text now (1000 chars)
          source: new URL(result.url).hostname.replace('www.', ''),
          score: result.score, // Include relevancy score if available
        })
      );

      // Build structured prompt for GPT curation
      const curatedPrompt = {
        task: 'Curate and format news digest from provided articles',
        topic: topic,
        articles: articlesForCuration,
        requirements: {
          bigStory: {
            description: 'Select the most impactful story from the articles',
            format: {
              title: 'The headline (keep original or write better)',
              summary:
                '2-3 sentences explaining what happened and why it matters',
              source: 'Publication name',
              sourceUrl: 'URL from the article',
            },
          },
          bullets: {
            description: `Select 5 other important stories (excluding ${specialSectionType})`,
            count: 5,
            format: {
              text: 'Short punchy headline (5-10 words)',
              summary: '1-2 sentence explanation (20-30 words)',
              sourceUrl: 'URL from article',
              source: 'Publication name',
            },
          },
          specialSection: {
            description: `Select 3-5 stories STRICTLY about ${specialSectionType}`,
            criticalRequirements: specialSectionFocus,
            format: {
              text: 'Company name and specific action with amount (e.g., "Stripe raises $600M")',
              summary: '1-2 sentences including investors, valuation, or key metrics',
              amount: 'REQUIRED: Exact dollar amount (e.g., "$50M", "$1.2B")',
              series: 'Funding round type if applicable (e.g., "Series C", "Seed")',
              sourceUrl: 'URL from article',
              source: 'Publication name',
            },
            validation: 'If an item does NOT include specific financial amounts or metrics, DO NOT include it in specialSection',
          },
        },
        outputFormat: 'JSON only, no additional text',
      };

      const curationPrompt = `Based on these ${articlesForCuration.length} recent articles about ${topic}, create a news digest.

Articles:
${JSON.stringify(articlesForCuration, null, 2)}

Requirements:
${JSON.stringify(curatedPrompt.requirements, null, 2)}

Return ONLY valid JSON with this structure:
{
  "bigStory": { "title": "...", "summary": "...", "source": "...", "sourceUrl": "..." },
  "bullets": [{ "text": "...", "summary": "...", "sourceUrl": "...", "source": "..." }],
  "specialSection": [{ "text": "...", "summary": "...", "amount": "...", "series": "...", "sourceUrl": "...", "source": "..." }]
}`;

      console.log(`[Exa News Service] Sending to GPT-5-mini for curation...`);

      // Enhanced curation prompt for better relevancy
      const completion = await (this.openai as any).responses.create({
        model: 'gpt-5-mini',
        input: `You are an expert news curator for ${topic}. Select the most GROUNDBREAKING and IMPACTFUL news.

SELECTION CRITERIA (in priority order):
1. **Impact**: Prefer news with industry-changing implications
2. **Recency**: Prioritize breaking news and first-time announcements
3. **Scale**: Focus on major deals, significant funding rounds ($10M+), notable acquisitions
4. **Innovation**: Highlight technical breakthroughs, first-of-its-kind developments
5. **Credibility**: Prefer recognized sources and companies

EXCLUSION RULES:
- NO routine updates or minor feature releases
- NO opinion pieces or speculation
- NO duplicate stories (same event from different sources)
- NO tangentially related content
- NO stories older than 24 hours unless truly exceptional

CURATION GUIDELINES:
- For bigStory: Choose the SINGLE most impactful/breaking news
- For bullets: Select diverse stories covering different aspects of ${topic}
- For specialSection: ${specialSectionFocus}
  * MUST include specific dollar amounts or percentages
  * If no articles meet these strict criteria, return empty specialSection rather than include irrelevant items
  * Conference announcements, events, and general news DO NOT belong in specialSection
- Headlines should be punchy and convey the significance
- Summaries should explain WHY this matters to the industry

Articles are sorted by relevance score. Prefer higher-scored articles unless a lower-scored one is clearly more impactful.

${curationPrompt}`,
        reasoning: {
          effort: 'medium', // Better reasoning for curation
        },
        text: {
          verbosity: 'low', // Still concise for JSON
        },
        max_output_tokens: 4000,
      });

      // GPT-5 responses API returns output_text directly
      console.log('[Exa News Service] GPT-5 usage:', completion.usage);
      const responseContent = completion.output_text;
      if (!responseContent) {
        throw new Error('No response from GPT-5-mini');
      }

      const parsed = JSON.parse(responseContent);

      // Extract the curated content
      const items: NewsItem[] = [];
      let bigStory: BigStory | undefined;
      const specialItems: NewsItem[] = [];

      // Extract bigStory
      if (parsed.bigStory) {
        bigStory = parsed.bigStory;
      }

      // Extract bullets and filter out "No applicable story" entries
      if (parsed.bullets && Array.isArray(parsed.bullets)) {
        for (const bullet of parsed.bullets.slice(0, 5)) {
          if (
            bullet.text &&
            !bullet.text.toLowerCase().includes('no applicable story')
          ) {
            items.push({
              text: bullet.text,
              summary: bullet.summary,
              sourceUrl: bullet.sourceUrl,
              source: bullet.source,
            });
          }
        }
      }

      // Fallback: If we have less than 3 items, use article titles directly
      if (items.length < 3 && articlesForCuration.length > 0) {
        console.log(
          `[Exa News Service] Warning: Only ${items.length} items for ${topic}, using article titles as fallback`
        );

        // Add remaining articles directly
        const needed = 5 - items.length;
        for (let i = 0; i < Math.min(needed, articlesForCuration.length); i++) {
          const article = articlesForCuration[i];
          if (!items.some((item) => item.sourceUrl === article.url)) {
            items.push({
              text: (article.title || 'Latest crypto news').substring(0, 80),
              summary:
                article.excerpt.substring(0, 150) || 'Read more at the source',
              sourceUrl: article.url,
              source: article.source,
            });
          }
        }
      }

      // Extract special section and filter out "No applicable story" entries
      if (parsed.specialSection && Array.isArray(parsed.specialSection)) {
        for (const item of parsed.specialSection.slice(0, 5)) {
          if (
            item.text &&
            !item.text.toLowerCase().includes('no applicable story')
          ) {
            specialItems.push({
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

      // Calculate approximate GPT-5-mini cost from usage field
      const inputTokens = completion.usage?.input_tokens || 0;
      const outputTokens = completion.usage?.output_tokens || 0;
      const totalTokens = completion.usage?.total_tokens || 0;
      const gptCost =
        (inputTokens / 1000000) * 0.25 + (outputTokens / 1000000) * 2; // $0.25/1M input, $2/1M output

      console.log(
        `[Exa News Service] Successfully generated news for ${topic}:`,
        {
          items: items.length,
          bigStory: !!bigStory,
          specialSection: specialItems.length,
          inputTokens,
          outputTokens,
          totalTokens,
          gptCost: `$${gptCost.toFixed(4)}`,
          exaSearchResults: searchResults.results.length,
        }
      );

      return {
        items: this.validateAndTrimItems(items),
        bigStory,
        specialSection: specialItems.length > 0 ? specialItems : undefined,
        specialSectionTitle:
          specialItems.length > 0 ? specialSectionTitle : undefined,
        topic,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(
        `[Exa News Service] Error generating news for ${topic}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Validate and ensure items meet requirements
   */
  private validateAndTrimItems(items: NewsItem[]): NewsItem[] {
    // Limit to 5 items (since we now have bigStory separately)
    const trimmedItems = items.slice(0, 5);

    // Count total words
    let totalWords = 0;
    const validItems: NewsItem[] = [];

    for (const item of trimmedItems) {
      const words = item.text.split(/\s+/).filter((w) => w.length > 0);
      if (totalWords + words.length <= 70) {
        validItems.push(item);
        totalWords += words.length;
      } else {
        // Trim the last item to fit within limit
        const remainingWords = 70 - totalWords;
        if (remainingWords > 3) {
          const trimmedText = words.slice(0, remainingWords).join(' ') + '...';
          validItems.push({ ...item, text: trimmedText });
        }
        break;
      }
    }

    return validItems;
  }
}
