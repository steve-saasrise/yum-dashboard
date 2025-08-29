import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';

interface BulletPoint {
  text: string;
  sourceUrl?: string;
}

interface NewsContent {
  id: string;
  title: string;
  url: string;
  published_at: string;
  creator_name: string;
  engagement_metrics?: any;
  content_body?: string;
}

interface GenerateSummaryResult {
  bullets: BulletPoint[];
  topic: string;
  loungeId?: string;
  modelUsed: string;
  tokenCount: number;
  generationTimeMs: number;
  sourceContentIds: string[];
}

export class NewsSummaryService {
  private openai: OpenAI | null = null;
  private supabase: ReturnType<typeof createClient<Database>> | null = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && !this.openai) {
      this.openai = new OpenAI({ apiKey });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey && !this.supabase) {
      this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    }
  }

  /**
   * Generate a daily news summary for a specific topic/lounge
   */
  async generateDailySummary(
    topic: string,
    newsContent: NewsContent[],
    loungeId?: string
  ): Promise<GenerateSummaryResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    // Prepare content for summarization - prioritize by engagement and recency
    const sortedContent = newsContent
      .sort((a, b) => {
        // Sort by published date (most recent first)
        const dateA = new Date(a.published_at).getTime();
        const dateB = new Date(b.published_at).getTime();
        return dateB - dateA;
      })
      .slice(0, 20); // Limit to top 20 most recent items

    // Create context from news content
    const newsContext = sortedContent
      .map((item, index) => {
        const engagement = item.engagement_metrics || {};
        const engagementScore =
          (engagement.views || 0) +
          (engagement.likes || 0) * 10 +
          (engagement.comments || 0) * 5;

        return `${index + 1}. ${item.title} (by ${item.creator_name}, engagement: ${engagementScore}, URL: ${item.url})`;
      })
      .join('\n');

    // Build the prompt
    const prompt = `Please create a short bulleted summary of the top news and takeaways from the last 24 hours in the field of ${topic}. Limit to six bullet points and a total of 70 words max. This is meant to introduce a daily digest newsletter covering the top news from the last 24 hours in this sector. You are creating a quickly scannable morning must-know summary for professionals who work in the field. If there was a large round of funding or an exit/sale/IPO of a well known firm within the SaaS sector, be sure to mention that.

Context - Recent news items from the last 24 hours:
${newsContext}

Format your response as a JSON array of bullet points, where each bullet has "text" and optionally "sourceUrl" if you reference a specific news item from the context. Example:
[
  {"text": "Major funding round announced...", "sourceUrl": "https://..."},
  {"text": "Industry trend emerging...", "sourceUrl": "https://..."}
]

Remember: Maximum 6 bullets, 70 words total across all bullets. Focus on the most important and impactful news.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional news curator creating concise daily summaries for industry professionals. Always respond with valid JSON array format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const generationTimeMs = Date.now() - startTime;
      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      let bullets: BulletPoint[] = [];
      try {
        const parsed = JSON.parse(response);
        // Handle both array and object with array property
        bullets = Array.isArray(parsed)
          ? parsed
          : parsed.bullets || parsed.summary || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // Fallback: try to extract bullet points from text
        bullets = this.extractBulletsFromText(response);
      }

      // Validate bullet points
      bullets = this.validateAndTrimBullets(bullets);

      // Get token usage
      const tokenCount = completion.usage?.total_tokens || 0;

      return {
        bullets,
        topic,
        loungeId,
        modelUsed: 'gpt-5-mini',
        tokenCount,
        generationTimeMs,
        sourceContentIds: sortedContent.map((c) => c.id),
      };
    } catch (error) {
      console.error('Error generating summary:', error);
      throw error;
    }
  }

  /**
   * Extract bullet points from plain text response (fallback)
   */
  private extractBulletsFromText(text: string): BulletPoint[] {
    const lines = text.split('\n').filter((line) => line.trim());
    const bullets: BulletPoint[] = [];

    for (const line of lines) {
      // Remove bullet markers like •, -, *, numbers
      const cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();
      if (cleanText) {
        bullets.push({ text: cleanText });
      }
    }

    return bullets;
  }

  /**
   * Validate and ensure bullets meet requirements
   */
  private validateAndTrimBullets(bullets: BulletPoint[]): BulletPoint[] {
    // Limit to 6 bullets
    const trimmedBullets = bullets.slice(0, 6);

    // Count total words
    let totalWords = 0;
    const validBullets: BulletPoint[] = [];

    for (const bullet of trimmedBullets) {
      const words = bullet.text.split(/\s+/).filter((w) => w.length > 0);
      if (totalWords + words.length <= 70) {
        validBullets.push(bullet);
        totalWords += words.length;
      } else {
        // Trim the last bullet to fit within limit
        const remainingWords = 70 - totalWords;
        if (remainingWords > 3) {
          const trimmedText = words.slice(0, remainingWords).join(' ') + '...';
          validBullets.push({ ...bullet, text: trimmedText });
        }
        break;
      }
    }

    return validBullets;
  }

  /**
   * Save generated summary to database
   */
  async saveSummary(summary: GenerateSummaryResult): Promise<string> {
    if (!this.supabase) {
      throw new Error('Supabase client not initialized');
    }

    const { data, error } = await this.supabase
      .from('daily_news_summaries')
      .insert({
        lounge_id: summary.loungeId || null,
        topic: summary.topic,
        summary_bullets: summary.bullets as unknown as Json,
        model_used: summary.modelUsed,
        token_count: summary.tokenCount,
        generation_time_ms: summary.generationTimeMs,
        source_content_ids: summary.sourceContentIds,
        metadata: {
          generatedAt: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving summary to database:', error);
      throw error;
    }

    console.log('Summary saved to database:', {
      id: data.id,
      topic: summary.topic,
      loungeId: summary.loungeId,
      bulletCount: summary.bullets.length,
      tokenCount: summary.tokenCount,
    });

    return data.id;
  }

  /**
   * Get the most recent summary for a lounge
   */
  async getLatestSummary(loungeId: string): Promise<{
    bullets: BulletPoint[];
    generatedAt: string;
  } | null> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    const { data, error } = await this.supabase
      .from('daily_news_summaries')
      .select('summary_bullets, generated_at')
      .eq('lounge_id', loungeId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No summary found for lounge:', loungeId);
      return null;
    }

    return {
      bullets: data.summary_bullets as unknown as BulletPoint[],
      generatedAt: data.generated_at || new Date().toISOString(),
    };
  }

  /**
   * Get summary by topic
   */
  async getLatestSummaryByTopic(topic: string): Promise<{
    bullets: BulletPoint[];
    generatedAt: string;
  } | null> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    const { data, error } = await this.supabase
      .from('daily_news_summaries')
      .select('summary_bullets, generated_at')
      .eq('topic', topic)
      .is('lounge_id', null) // Get general summaries (not lounge-specific)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No summary found for topic:', topic);
      return null;
    }

    return {
      bullets: data.summary_bullets as unknown as BulletPoint[],
      generatedAt: data.generated_at || new Date().toISOString(),
    };
  }
}
