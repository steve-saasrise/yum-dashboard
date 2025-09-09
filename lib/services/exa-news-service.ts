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

  // Comprehensive list of trusted NEWS domains (sources that publish news articles with headlines)
  private readonly TRUSTED_NEWS_DOMAINS = {
    // Major global news outlets
    general: [
      'reuters.com',
      'bloomberg.com',
      'wsj.com',
      'ft.com',
      'forbes.com',
      'businessinsider.com',
      'cnbc.com',
      'economist.com',
      'bbc.com',
      'nytimes.com',
      'washingtonpost.com',
      'theguardian.com',
      'apnews.com',
      'axios.com',
      'politico.com',
      'thehill.com',
      'fortune.com',
      'fastcompany.com',
      'inc.com',
      'entrepreneur.com',
      'businessweek.com',
      'marketwatch.com',
      'seekingalpha.com',
      'benzinga.com',
      'barrons.com',
      'fool.com',
      'investopedia.com',
    ],
    
    // Technology and AI focused
    tech: [
      'techcrunch.com',
      'theverge.com',
      'arstechnica.com',
      'wired.com',
      'engadget.com',
      'gizmodo.com',
      'mashable.com',
      'thenextweb.com',
      'zdnet.com',
      'cnet.com',
      'anandtech.com',
      'tomshardware.com',
      'pcmag.com',
      'techradar.com',
      'digitaltrends.com',
      '9to5mac.com',
      '9to5google.com',
      'macrumors.com',
      'androidauthority.com',
      'androidcentral.com',
      'xda-developers.com',
      'howtogeek.com',
      'lifehacker.com',
      'makeuseof.com',
    ],
    
    // AI and ML specific news sources
    ai: [
      'venturebeat.com',
      'theinformation.com',
      'semafor.com',
      'artificialintelligence-news.com',
      'theregister.com',
      'hpcwire.com',
      'insidebigdata.com',
      'datanami.com',
      'infoworld.com',
      'technologyreview.com',
      'spectrum.ieee.org',
      'singularityhub.com',
      'thenewstack.io',
      'analyticsindiamag.com',
      'marktechpost.com',
      'syncedreview.com',
      'kdnuggets.com',
      'towardsdatascience.com',
      'arxiv.org', // For research papers
    ],
    
    // Cryptocurrency and blockchain news sources
    crypto: [
      'coindesk.com',
      'cointelegraph.com',
      'theblock.co',
      'decrypt.co',
      'bitcoinmagazine.com',
      'cryptonews.com',
      'cryptoslate.com',
      'ambcrypto.com',
      'cryptopotato.com',
      'dailyhodl.com',
      'cryptobriefing.com',
      'blockworks.co',
      'thedefiant.io',
      'bankless.com',
      'cryptopanic.com',
      'u.today',
      'newsbtc.com',
      'bitcoinist.com',
      'coingape.com',
      'beincrypto.com',
      'cryptonewsz.com',
      'coinjournal.net',
      'coinpedia.org',
      'protos.com',
    ],
    
    // SaaS and B2B news (focusing on news sites, not company blogs)
    saas: [
      'saastr.com',
      'saasboomi.com',
      'getlatka.com',
      'betakit.com',
      'eu-startups.com',
      'startupnation.com',
      'siliconangle.com',
      'sdtimes.com',
      'ciodive.com',
      'informationweek.com',
      'channele2e.com',
      'crn.com',
      'channelfutures.com',
      'mspmentor.net',
    ],
    
    // Venture capital and startup news
    venture: [
      'pitchbook.com',
      'crunchbase.com',
      'venturebeat.com',
      'strictlyvc.com',
      'term.sheet',
      'pehub.com',
      'finsmes.com',
      'techinasia.com',
      'tech.eu',
      'sifted.eu',
      'startupnews.com',
      'startupgrind.com',
      'betalist.com',
      'killerstartups.com',
      'startupbeat.com',
      'venturecapitaljournal.com',
      'privateequitywire.com',
      'altassets.net',
      'mergersandinquisitions.com',
    ],
    
    // Growth and marketing news
    growth: [
      'growthhackers.com',
      'marketingland.com',
      'searchengineland.com',
      'searchenginejournal.com',
      'martech.org',
      'martechtoday.com',
      'marketingdive.com',
      'adweek.com',
      'adage.com',
      'digiday.com',
      'emarketer.com',
      'marketingweek.com',
      'thedrum.com',
      'campaignlive.com',
      'mobilemarketer.com',
      'retaildive.com',
      'modernretail.co',
      'glossy.co',
      'marketingprofs.com',
      'chiefmartec.com',
    ],
  };

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
    const isCryptoTopic =
      topicLower.includes('crypto') || topicLower.includes('blockchain');

    // Special section should focus on money/deals/metrics
    const specialSectionType = isGrowthTopic
      ? 'growth metrics and experiments'
      : 'funding and acquisitions';

    // Generate topic-specific titles and focus
    let specialSectionTitle: string;
    let specialSectionFocus: string;

    if (isGrowthTopic) {
      specialSectionTitle = 'Growth Metrics & Experiments';
      specialSectionFocus =
        'ONLY include: A/B test results with specific conversion improvements (e.g., "increased signups by 47%"), growth experiments with measurable outcomes, product-led growth metrics, viral coefficient improvements. EXCLUDE: general growth advice, conferences, tools without specific results';
    } else if (isVentureTopic) {
      specialSectionTitle = 'Latest Funding Rounds';
      specialSectionFocus =
        'ONLY include: Series A/B/C/D/E/F rounds with exact amounts (e.g., "$50M Series B"), seed funding with amounts, acquisitions with valuations, IPO announcements. Must include dollar amounts. EXCLUDE: events, conferences, general VC news';
    } else if (topicLower.includes('ai')) {
      specialSectionTitle = 'AI Funding & Acquisitions';
      specialSectionFocus =
        'ONLY include: AI company funding rounds with specific amounts (e.g., "Anthropic raises $450M"), AI startup acquisitions with deal values, AI unicorn valuations. Must include dollar amounts. EXCLUDE: product launches, research papers, conferences';
    } else if (topicLower.includes('saas')) {
      specialSectionTitle = 'SaaS Funding & M&A';
      specialSectionFocus =
        'ONLY include: SaaS company funding rounds with amounts, SaaS acquisitions with valuations, SaaS IPOs or exit deals. Must include dollar amounts. EXCLUDE: product updates, integrations, partnerships without financial terms';
    } else if (isCryptoTopic) {
      specialSectionTitle = 'Crypto Funding & Token Launches';
      specialSectionFocus =
        'ONLY include: Crypto/blockchain company funding rounds with amounts (e.g., "Uniswap Labs raises $165M"), token launches with initial valuations, crypto acquisitions, DeFi protocol TVL milestones. Must include dollar amounts or percentages. EXCLUDE: price movements, conferences, regulatory news, general announcements';
    } else {
      specialSectionTitle = `${topic} Funding & Deals`;
      specialSectionFocus =
        'ONLY include: Company funding rounds with specific dollar amounts, acquisitions with deal values, IPOs, major commercial deals with financial terms. EXCLUDE: partnerships without financial details, product launches, events';
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
      let includeDomains: string[] = [];

      // Select appropriate domains and query based on topic
      if (
        topicLower.includes('ai') ||
        loungeDescription?.toLowerCase().includes('artificial intelligence')
      ) {
        // Focused query for AI news - let autoprompt enhance it
        searchQuery = `AI news today announcements funding breakthroughs`;
        // Combine tech, AI, and general news domains
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.ai,
          ...this.TRUSTED_NEWS_DOMAINS.tech,
          ...this.TRUSTED_NEWS_DOMAINS.general,
        ];
      } else if (
        topicLower.includes('saas') ||
        loungeDescription?.toLowerCase().includes('software as a service')
      ) {
        // Focused query for SaaS news
        searchQuery = `SaaS companies funding product launches acquisitions today`;
        // Combine SaaS, tech, and general business domains
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.saas,
          ...this.TRUSTED_NEWS_DOMAINS.tech,
          ...this.TRUSTED_NEWS_DOMAINS.general,
        ];
      } else if (
        topicLower.includes('venture') ||
        loungeDescription?.toLowerCase().includes('venture capital')
      ) {
        // Focused query for VC news
        searchQuery = `venture capital funding rounds Series A B C today`;
        category = 'company';
        // Combine venture, tech, and business domains
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.venture,
          ...this.TRUSTED_NEWS_DOMAINS.tech,
          ...this.TRUSTED_NEWS_DOMAINS.general,
        ];
      } else if (
        topicLower.includes('growth') ||
        loungeDescription?.toLowerCase().includes('growth strategies')
      ) {
        // Focused query for growth news
        searchQuery = `growth experiments A/B testing results case studies metrics`;
        // Combine growth, SaaS, and tech domains
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.growth,
          ...this.TRUSTED_NEWS_DOMAINS.saas,
          ...this.TRUSTED_NEWS_DOMAINS.tech,
          ...this.TRUSTED_NEWS_DOMAINS.general,
        ];
      } else if (
        topicLower.includes('crypto') ||
        loungeDescription?.toLowerCase().includes('blockchain')
      ) {
        // Broader crypto query - not just BTC/ETH
        searchQuery = `cryptocurrency blockchain news DeFi NFT Web3 altcoins today`;
        // Use crypto and financial domains
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.crypto,
          ...this.TRUSTED_NEWS_DOMAINS.general.filter(d => 
            ['bloomberg.com', 'reuters.com', 'wsj.com', 'ft.com', 'cnbc.com', 'forbes.com'].includes(d)
          ),
        ];
      } else {
        // Fallback: use general news and tech domains
        searchQuery = loungeDescription
          ? `${loungeDescription} news today`
          : `${topic} news announcements today`;
        includeDomains = [
          ...this.TRUSTED_NEWS_DOMAINS.general,
          ...this.TRUSTED_NEWS_DOMAINS.tech,
        ];
      }

      // Remove duplicates from includeDomains
      includeDomains = [...new Set(includeDomains)];

      // Log the search details
      console.log(`[Exa News Service] Starting search for ${topic}...`);
      console.log(
        `[Exa News Service] Using search query: "${searchQuery.substring(0, 200)}${searchQuery.length > 200 ? '...' : ''}"`
      );
      console.log(
        `[Exa News Service] Whitelisting ${includeDomains.length} trusted domains`
      );
      console.log(
        `[Exa News Service] Lounge description: "${loungeDescription || 'Not provided'}"`
      );

      // Perform Exa search with optimized parameters for relevancy
      const searchResults = await this.exa.searchAndContents(searchQuery, {
        numResults: 25, // Optimal number for quality selection
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
          'wikipedia.org', // Encyclopedic content, not news
          'github.com', // Code repos, not news
          'stackoverflow.com', // Q&A, not news
          'discord.com', // Chat platforms
          'slack.com', // Chat platforms
        ],
        // Use the comprehensive whitelist of trusted domains
        includeDomains,
      } as any);

      console.log(
        `[Exa News Service] Found ${searchResults.results.length} results for ${topic}`
      );

      // Filter and validate results
      const validResults = searchResults.results.filter((result, index) => {
        // Verify publication date is actually recent
        if (result.publishedDate) {
          const pubDate = new Date(result.publishedDate);
          const hoursSince =
            (Date.now() - pubDate.getTime()) / (1000 * 60 * 60);
          if (hoursSince > 48) {
            console.log(
              `[Exa News Service] Filtering old article (#${index + 1}): ${result.title} (${hoursSince.toFixed(0)}h old)`
            );
            return false;
          }
        }

        // Filter out non-news URL patterns
        const url = result.url.toLowerCase();
        const excludePatterns = [
          /\/about(-us)?\//,
          /\/careers?\//,
          /\/contact(-us)?\//,
          /\/events?\//,
          /\/products?\//,
          /\/services\//,
          /\/press-releases?\//,
          /\/investor-relations\//,
          /\/\d{4}\/\d{2}\//, // Archive URLs like /2020/05/
        ];

        if (excludePatterns.some((pattern) => pattern.test(url))) {
          console.log(
            `[Exa News Service] Filtering non-news URL (#${index + 1}): ${result.url}`
          );
          return false;
        }

        // Filter promotional content based on text
        if (result.text) {
          const textLower = result.text.toLowerCase();
          const promoIndicators = [
            'we are pleased to announce',
            'we are excited to',
            'join us for',
            'register now',
            'sign up today',
            'limited time offer',
            'sponsored content',
          ];

          if (promoIndicators.some((phrase) => textLower.includes(phrase))) {
            console.log(
              `[Exa News Service] Filtering promotional content (#${index + 1}): ${result.title}`
            );
            return false;
          }
        }

        return true;
      });

      // Deduplicate by title similarity
      const deduplicatedResults = [];
      const seenTitles = new Set();

      for (const result of validResults) {
        // Create normalized title for comparison
        const normalizedTitle = (result.title || '')
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(' ')
          .slice(0, 5)
          .join(' ');

        if (!seenTitles.has(normalizedTitle)) {
          seenTitles.add(normalizedTitle);
          deduplicatedResults.push(result);
        } else {
          console.log(
            `[Exa News Service] Filtering duplicate: ${result.title}`
          );
        }
      }

      console.log(
        `[Exa News Service] After filtering: ${deduplicatedResults.length} valid results (from ${searchResults.results.length} total)`
      );

      if (deduplicatedResults.length === 0) {
        console.log(
          `[Exa News Service] No valid results found for ${topic} after filtering, returning empty news`
        );
        return {
          items: [],
          topic,
          generatedAt: new Date().toISOString(),
        };
      }

      // Prepare content for GPT curation with filtered results
      const articlesForCuration = deduplicatedResults.map((result, index) => ({
        index: index + 1,
        title: result.title,
        url: result.url,
        publishedDate: result.publishedDate,
        excerpt: result.text || '', // Use full text now (1000 chars)
        source: new URL(result.url).hostname.replace('www.', ''),
        score: result.score, // Include relevancy score if available
      }));

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
              summary:
                '1-2 sentences including investors, valuation, or key metrics',
              amount: 'REQUIRED: Exact dollar amount (e.g., "$50M", "$1.2B")',
              series:
                'Funding round type if applicable (e.g., "Series C", "Seed")',
              sourceUrl: 'URL from article',
              source: 'Publication name',
            },
            validation:
              'If an item does NOT include specific financial amounts or metrics, DO NOT include it in specialSection',
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
