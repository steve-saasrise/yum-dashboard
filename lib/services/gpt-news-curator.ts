import OpenAI from 'openai';
import {
  NewsItem,
  BigStory,
  GenerateNewsResult,
} from './perplexity-news-service';

export interface RawNewsArticle {
  title: string;
  description?: string;
  content?: string;
  link: string;
  source?: string;
  publishedAt?: string;
  imageUrl?: string;
  category?: string[];
  sentiment?: string;
}

export interface CurationConfig {
  loungeType: string;
  maxBullets?: number;
  maxSpecialSection?: number;
  includeImages?: boolean;
  model?: string;
}

export class GPTNewsCurator {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-5-mini') {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({ apiKey });
    this.model = model;
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
          'Focus on A/B test results with specific conversion improvements, growth experiments with measurable outcomes, and product-led growth metrics. Include exact percentages and numbers.',
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

  private buildSystemPrompt(config: CurationConfig): string {
    const { focus: specialSectionFocus, title: specialSectionTitle } =
      this.getSpecialSectionInfo(config.loungeType);

    const maxBullets = config.maxBullets || 5;
    const maxSpecialSection = config.maxSpecialSection || 3;

    return `You are a professional news curator for a ${config.loungeType} focused newsletter. Your task is to analyze the provided news articles and create a structured daily digest.

IMPORTANT RULES:
1. Select the MOST impactful and newsworthy stories from the provided articles
2. Ensure source diversity - try to include news from different publications when possible
3. Each story must be COMPLETELY UNIQUE - no duplicates across bigStory, bullets, and specialSection
4. NEVER include the same company/event in multiple sections
5. All URLs must be preserved exactly as provided - these are the actual article links
6. Focus on breaking news, major announcements, and significant developments

Return a valid JSON object with EXACTLY this structure:

{
  "bigStory": {
    "title": "One impactful headline - make it compelling and specific",
    "summary": "2-3 sentences explaining why this matters to the ${config.loungeType} community",
    "source": "Source name (extract from article or URL)",
    "sourceUrl": "Direct URL to the article",
    "imageUrl": "Image URL if available"
  },
  "bullets": [
    {
      "text": "Important news item with company names and brief context",
      "summary": "1-2 sentences of additional context if needed",
      "source": "Source name",
      "sourceUrl": "Direct URL to the specific article",
      "imageUrl": "Image URL if available"
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
- Include exactly ${maxBullets} items in "bullets"
- Include 1-${maxSpecialSection} items in "specialSection" (prioritize quality over quantity)
- ${specialSectionFocus}
- For the bigStory, select the most significant news that would be the lead story
- For bullets, select diverse, important stories that complement the big story
- For specialSection, focus on "${specialSectionTitle}" content
- Extract source names from URLs or article metadata when not explicitly provided
- Keep text concise but informative
- Include specific company names, dollar amounts, and key metrics where available`;
  }

  public async curateNews(
    articles: RawNewsArticle[],
    config: CurationConfig
  ): Promise<GenerateNewsResult> {
    try {
      if (!articles || articles.length === 0) {
        throw new Error('No articles provided for curation');
      }

      const systemPrompt = this.buildSystemPrompt(config);
      const { title: specialSectionTitle } = this.getSpecialSectionInfo(
        config.loungeType
      );

      // Prepare articles for GPT (limit content length to avoid token limits)
      const articlesForGPT = articles.map((article, index) => ({
        index: index + 1,
        title: article.title,
        description: article.description?.substring(0, 500),
        content: article.content?.substring(0, 1000),
        link: article.link,
        source: article.source || this.extractSourceFromUrl(article.link),
        publishedAt: article.publishedAt,
        imageUrl: article.imageUrl,
        category: article.category,
        sentiment: article.sentiment,
      }));

      console.log(
        `[GPT Curator] Curating ${articles.length} articles for ${config.loungeType} lounge`
      );

      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: `Please analyze and curate these ${
              articles.length
            } news articles into a structured digest:\n\n${JSON.stringify(
              articlesForGPT,
              null,
              2
            )}`,
          },
        ],
        // temperature not supported for gpt-5-mini (o1-mini reasoning models)
        max_completion_tokens: 4000,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content generated from GPT');
      }

      // Parse the JSON response
      interface ParsedResponse {
        bigStory?: {
          title: string;
          summary: string;
          source?: string;
          sourceUrl?: string;
          imageUrl?: string;
        };
        bullets?: Array<{
          text: string;
          summary?: string;
          sourceUrl?: string;
          source?: string;
          imageUrl?: string;
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
        parsed = JSON.parse(content);
      } catch (error) {
        console.error('[GPT Curator] Failed to parse GPT response:', content);
        throw new Error('Failed to parse GPT response as JSON');
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
        for (const bullet of parsed.bullets.slice(0, config.maxBullets || 5)) {
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
        for (const item of parsed.specialSection.slice(
          0,
          config.maxSpecialSection || 3
        )) {
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

      const result: GenerateNewsResult = {
        items,
        bigStory,
        specialSection: specialSection.length > 0 ? specialSection : undefined,
        specialSectionTitle:
          specialSection.length > 0 ? specialSectionTitle : undefined,
        topic: config.loungeType,
        generatedAt: new Date().toISOString(),
      };

      console.log(
        `[GPT Curator] Successfully curated news: ${items.length} bullets, ${
          specialSection.length
        } special items, ${bigStory ? '1 big story' : 'no big story'}`
      );

      return result;
    } catch (error) {
      console.error('[GPT Curator] Error curating news:', error);
      throw error;
    }
  }

  private extractSourceFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      // Remove www. and .com/.org etc to get clean source name
      const source = hostname
        .replace(/^www\./, '')
        .replace(/\.(com|org|net|io|co|uk|eu).*$/, '');
      // Capitalize first letter
      return source.charAt(0).toUpperCase() + source.slice(1);
    } catch {
      return 'Unknown Source';
    }
  }

  public async curateNewsFromNewsData(
    newsDataResponse: any,
    config: CurationConfig
  ): Promise<GenerateNewsResult> {
    // Convert NewsData format to our RawNewsArticle format
    const articles: RawNewsArticle[] = newsDataResponse.results.map(
      (article: any) => ({
        title: article.title,
        description: article.description,
        content: article.content,
        link: article.link,
        source: article.source_name || article.source_id,
        publishedAt: article.pubDate,
        imageUrl: article.image_url,
        category: article.category,
        sentiment: article.sentiment,
      })
    );

    return this.curateNews(articles, config);
  }
}

// Export singleton instance if API key is available
let gptNewsCurator: GPTNewsCurator | null = null;

export function getGPTNewsCurator(): GPTNewsCurator {
  if (!gptNewsCurator) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    // Use gpt-5-mini model for cost-effectiveness
    gptNewsCurator = new GPTNewsCurator(apiKey, 'gpt-5-mini');
  }
  return gptNewsCurator;
}
