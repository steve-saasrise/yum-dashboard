import OpenAI from 'openai';
import type { RSSArticle } from './rss-feed-service';
import type { NewsItem, BigStory, GenerateNewsResult } from './gpt5-news-service';

interface CurationConfig {
  loungeType: string;
  maxBullets: number;
  maxSpecialSection: number;
  includeOpinion?: boolean;
}

interface CurationPrompt {
  articles: Array<{
    title: string;
    snippet: string;
    source: string;
    url: string;
    category: string;
    pubDate: string;
  }>;
  config: CurationConfig;
}

export class GPT5CuratorService {
  private client: OpenAI;
  private model: string = 'gpt-5-mini';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async curateNewsFromRSS(
    articles: RSSArticle[],
    config: CurationConfig
  ): Promise<GenerateNewsResult> {
    try {
      const startTime = Date.now();

      console.log(
        `[GPT-5 Curator] Curating ${articles.length} articles for ${config.loungeType}`
      );

      // Prepare articles for GPT-5
      const preparedArticles = articles.map((article) => ({
        title: article.title,
        snippet: article.contentSnippet || article.title,
        source: article.source,
        url: article.link,
        category: article.sourceCategory,
        pubDate: article.pubDate,
      }));

      const prompt = this.buildCurationPrompt(preparedArticles, config);

      // Use the Responses API to curate
      const response = await (this.client as any).responses.create({
        model: this.model,
        reasoning: {
          effort: 'medium',
        },
        instructions: `You are a professional SaaS news curator. Today's date is ${new Date().toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}. Your task is to select and summarize the most important news from the provided RSS articles.`,
        input: prompt,
      });

      // Extract the curated content
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
          content = outputTextItem.type === 'output_text'
            ? outputTextItem.text
            : outputTextItem.content?.[0]?.text || '';
        }
      } else if (response.text) {
        content = response.text;
      }

      if (!content) {
        throw new Error('No output from GPT-5 curation');
      }

      // Parse the JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON in GPT-5 response');
      }

      const curated = JSON.parse(jsonMatch[0]);

      // Validate and format the result
      const result: GenerateNewsResult = {
        items: this.validateAndFormatItems(curated.bullets || []),
        bigStory: this.validateBigStory(curated.bigStory),
        specialSection: this.validateAndFormatItems(curated.specialSection || []),
        specialSectionTitle: 'SaaS Funding & M&A',
        topic: config.loungeType,
        generatedAt: new Date().toISOString(),
      };

      const duration = Date.now() - startTime;
      console.log(
        `[GPT-5 Curator] Curated in ${duration}ms: ` +
        `${result.items.length} bullets, ${result.specialSection?.length || 0} funding items`
      );

      return result;
    } catch (error) {
      console.error('[GPT-5 Curator] Error during curation:', error);
      throw error;
    }
  }

  private buildCurationPrompt(
    articles: Array<{
      title: string;
      snippet: string;
      source: string;
      url: string;
      category: string;
      pubDate: string;
    }>,
    config: CurationConfig
  ): string {
    const maxBullets = config.maxBullets || 5;
    const maxSpecialSection = config.maxSpecialSection || 5;

    return `You have access to ${articles.length} real news articles from the last 24 hours.
Your task is to curate the MOST IMPORTANT and IMPACTFUL SaaS industry news.

ARTICLES:
${JSON.stringify(articles, null, 2)}

REQUIREMENTS:
1. Select ONE big story - the most significant/impactful news
2. Select EXACTLY ${maxBullets} diverse news items for bullet points
3. Select up to ${maxSpecialSection} funding/M&A announcements for special section
4. DO NOT duplicate stories across sections
5. Prioritize breaking news and major announcements
6. Use the ACTUAL URLs provided - do not modify them
7. Write concise, informative summaries that explain WHY each story matters

CRITICAL:
- Every URL must be from the articles provided above
- Never invent or modify URLs
- If an article appears in multiple sources, use the highest priority source
- Ensure geographic and company diversity

Return ONLY valid JSON with this structure:
{
  "bigStory": {
    "title": "Exact headline from article",
    "summary": "2-3 sentences explaining significance and impact",
    "source": "Source name from article",
    "sourceUrl": "Exact URL from article"
  },
  "bullets": [
    {
      "text": "Concise news headline",
      "summary": "1-2 sentence context",
      "source": "Source name",
      "sourceUrl": "Exact URL"
    }
  ],
  "specialSection": [
    {
      "text": "Company funding/M&A headline",
      "summary": "Brief context",
      "amount": "$X million/billion",
      "series": "Series A/B/C/D or M&A",
      "source": "Source name",
      "sourceUrl": "Exact URL"
    }
  ]
}`;
  }

  private validateAndFormatItems(items: any[]): NewsItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item) => item && item.text && item.sourceUrl)
      .map((item) => ({
        text: item.text,
        summary: item.summary || '',
        source: item.source || 'Unknown',
        sourceUrl: item.sourceUrl,
        amount: item.amount,
        series: item.series,
      }));
  }

  private validateBigStory(story: any): BigStory | undefined {
    if (!story || !story.title || !story.sourceUrl) {
      return undefined;
    }

    return {
      title: story.title,
      summary: story.summary || '',
      source: story.source || 'Unknown',
      sourceUrl: story.sourceUrl,
    };
  }

  async fallbackToGeneration(config: CurationConfig): Promise<GenerateNewsResult> {
    console.log('[GPT-5 Curator] Falling back to pure generation mode');

    // This is a simplified fallback that generates news without RSS input
    // In production, you might want to use the existing GPT5NewsService
    const prompt = `Generate realistic SaaS industry news for today.
    Create ${config.maxBullets} news bullets and ${config.maxSpecialSection} funding items.
    Focus on major SaaS companies and real trends.
    Return JSON with bigStory, bullets, and specialSection arrays.`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'You are a SaaS industry news expert. Generate realistic, current news.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content from fallback generation');
    }

    const generated = JSON.parse(content);

    return {
      items: this.validateAndFormatItems(generated.bullets || []),
      bigStory: this.validateBigStory(generated.bigStory),
      specialSection: this.validateAndFormatItems(generated.specialSection || []),
      specialSectionTitle: 'SaaS Funding & M&A',
      topic: config.loungeType,
      generatedAt: new Date().toISOString(),
    };
  }
}

let gpt5CuratorService: GPT5CuratorService | null = null;

export function getGPT5CuratorService(): GPT5CuratorService {
  if (!gpt5CuratorService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    gpt5CuratorService = new GPT5CuratorService(apiKey);
  }
  return gpt5CuratorService;
}