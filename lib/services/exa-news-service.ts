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

    const specialSectionType = isGrowthTopic
      ? 'growth experiments'
      : 'fundraising';

    // Generate topic-specific titles
    let specialSectionTitle: string;
    if (isGrowthTopic) {
      specialSectionTitle = 'Growth Experiments & Results';
    } else if (isVentureTopic) {
      specialSectionTitle = 'Venture Capital Deals';
    } else if (topicLower.includes('ai')) {
      specialSectionTitle = 'AI Fundraising Announcements';
    } else if (topicLower.includes('saas')) {
      specialSectionTitle = 'SaaS Fundraising Announcements';
    } else if (topicLower.includes('crypto')) {
      specialSectionTitle = 'Crypto Fundraising Announcements';
    } else {
      // Fallback for other topics
      specialSectionTitle = `${topic} Fundraising Announcements`;
    }

    const specialSectionFocus = isGrowthTopic
      ? 'A/B tests, conversion rates, growth metrics, campaign results'
      : 'funding rounds, Series A/B/C/D/E/F, seed rounds, acquisitions, valuations, investor names, funding amounts';

    try {
      console.log(`[Exa News Service] Starting search for ${topic}...`);
      
      // Calculate date for last 24 hours
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
      
      // Format dates as YYYY-MM-DD
      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };

      // Build search query based on topic
      let searchQuery = `${topic} news`;
      
      // Add specific keywords for better results
      if (topicLower.includes('ai')) {
        searchQuery = `AI artificial intelligence news releases updates`;
      } else if (topicLower.includes('saas')) {
        searchQuery = `SaaS software B2B enterprise news updates`;
      } else if (topicLower.includes('venture')) {
        searchQuery = `venture capital funding rounds investments startups`;
      } else if (topicLower.includes('growth')) {
        searchQuery = `growth marketing experiments A/B testing metrics`;
      } else if (topicLower.includes('crypto')) {
        searchQuery = `cryptocurrency blockchain DeFi news updates`;
      }

      // Perform Exa search with date filtering
      const searchResults = await this.exa.searchAndContents(searchQuery, {
        numResults: 12,
        startPublishedDate: formatDate(startDate),
        endPublishedDate: formatDate(endDate),
        text: {
          maxCharacters: 500, // Get highlights for each result
          includeHtmlTags: false
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
          'youtube.com'
        ]
      });

      console.log(`[Exa News Service] Found ${searchResults.results.length} results for ${topic}`);

      if (searchResults.results.length === 0) {
        console.log(`[Exa News Service] No results found for ${topic}, returning empty news`);
        return {
          items: [],
          topic,
          generatedAt: new Date().toISOString(),
        };
      }

      // Prepare content for GPT curation
      const articlesForCuration = searchResults.results.map((result, index) => ({
        index: index + 1,
        title: result.title,
        url: result.url,
        publishedDate: result.publishedDate,
        excerpt: result.text?.substring(0, 500) || '',
        source: new URL(result.url).hostname.replace('www.', '')
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
              summary: '2-3 sentences explaining what happened and why it matters',
              source: 'Publication name',
              sourceUrl: 'URL from the article'
            }
          },
          bullets: {
            description: `Select 5 other important stories (excluding ${specialSectionType})`,
            count: 5,
            format: {
              text: 'Short punchy headline (5-10 words)',
              summary: '1-2 sentence explanation (20-30 words)',
              sourceUrl: 'URL from article',
              source: 'Publication name'
            }
          },
          specialSection: {
            description: `Select 3-5 stories about ${specialSectionType}`,
            focus: specialSectionFocus,
            format: {
              text: 'Company name and action (5-8 words)',
              summary: '1-2 sentences with key details',
              amount: 'Funding amount if applicable',
              series: 'Funding round if applicable',
              sourceUrl: 'URL from article',
              source: 'Publication name'
            }
          }
        },
        outputFormat: 'JSON only, no additional text'
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

      // Use GPT-5-mini with the responses API (GPT-5 uses different API than GPT-4)
      const completion = await (this.openai as any).responses.create({
        model: 'gpt-5-mini',
        input: `You are a news curator. Format the provided articles into a structured news digest. Return only valid JSON.

${curationPrompt}`,
        reasoning: {
          effort: 'minimal' // Fast response for simple curation task
        },
        text: {
          verbosity: 'low' // Concise output for structured JSON
        },
        max_output_tokens: 4000
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

      // Extract special section
      if (parsed.specialSection && Array.isArray(parsed.specialSection)) {
        for (const item of parsed.specialSection.slice(0, 5)) {
          if (item.text) {
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
      const gptCost = (inputTokens / 1000000 * 0.25) + (outputTokens / 1000000 * 2); // $0.25/1M input, $2/1M output
      
      console.log(`[Exa News Service] Successfully generated news for ${topic}:`, {
        items: items.length,
        bigStory: !!bigStory,
        specialSection: specialItems.length,
        inputTokens,
        outputTokens,
        totalTokens,
        gptCost: `$${gptCost.toFixed(4)}`,
        exaSearchResults: searchResults.results.length
      });

      return {
        items: this.validateAndTrimItems(items),
        bigStory,
        specialSection: specialItems.length > 0 ? specialItems : undefined,
        specialSectionTitle: specialItems.length > 0 ? specialSectionTitle : undefined,
        topic,
        generatedAt: new Date().toISOString(),
      };

    } catch (error) {
      console.error(`[Exa News Service] Error generating news for ${topic}:`, error);
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