import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { OpenGraphService } from './opengraph-service';

interface BulletPoint {
  text: string;
  summary?: string;
  sourceUrl?: string;
  imageUrl?: string;
  source?: string;
  amount?: string; // For fundraising items
  series?: string; // For fundraising items
}

interface BigStory {
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
  imageUrl?: string;
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
  bigStory?: BigStory;
  bullets: BulletPoint[];
  specialSection?: BulletPoint[];
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

    // Build the prompt
    const prompt = `Please create a news digest summary for ${topic} with three sections:

1. BIG STORY OF THE DAY: Select the single most important/impactful news item and provide:
   - title: The headline (keep original if good, or write a better one)
   - summary: 2-3 sentence summary explaining what happened and why it matters
   - source: The source publication name
   - sourceUrl: The URL of the article

2. TODAY'S HEADLINES: Create 5 bullet points of other important news (EXCLUDING ${specialSectionType} news). For each:
   - text: Short, punchy headline (5-10 words max)
   - summary: 1-2 sentence explanation of what happened (20-30 words)
   - sourceUrl: The URL of the article
   - source: The publication name

3. ${specialSectionTitle.toUpperCase()}: Create 3-5 bullet points specifically about ${specialSectionType}. For each:
   - text: Company name and short action (5-8 words max, e.g., "DataBricks raises funding")
   - summary: 1-2 sentence explanation including key details (20-30 words)
   ${!isGrowthTopic ? '- amount: Funding amount (e.g., "$500M", "$1.2B")' : ''}
   ${!isGrowthTopic ? '- series: Funding round (e.g., "Series H", "Seed", "Series A")' : ''}
   - sourceUrl: The URL of the article
   - source: The publication name
   ${
     isGrowthTopic
       ? '- Focus on: A/B tests, conversion rates, growth metrics, campaign results, experiment outcomes'
       : '- Focus on: funding rounds, Series A/B/C/D/E/F, seed rounds, acquisitions, valuations, investor names, ALWAYS include exact funding amounts'
   }

Context - Recent news items from the last 24 hours:
${newsContext}

Format your response as a JSON object:
{
  "bigStory": {
    "title": "...",
    "summary": "...",
    "source": "...",
    "sourceUrl": "..."
  },
  "bullets": [
    {"text": "...", "summary": "...", "sourceUrl": "...", "source": "..."},
    ...
  ],
  "specialSection": [
    {"text": "...", "summary": "...", "amount": "...", "series": "...", "sourceUrl": "...", "source": "..."},
    ...
  ]
}

IMPORTANT: 
- Headlines should NOT include ${specialSectionType} news
- Special section should ONLY include ${specialSectionType} news
- Focus on the most important and impactful news for ${topic} professionals.`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
        max_tokens: 300, // Increased to accommodate special section
        response_format: { type: 'json_object' },
      });

      const generationTimeMs = Date.now() - startTime;
      const response = completion.choices[0].message.content;

      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      let bigStory: BigStory | undefined;
      let bullets: BulletPoint[] = [];
      let specialSection: BulletPoint[] = [];

      try {
        const parsed = JSON.parse(response);
        bigStory = parsed.bigStory;
        bullets = parsed.bullets || [];
        specialSection = parsed.specialSection || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // Fallback: try to extract bullet points from text
        bullets = this.extractBulletsFromText(response);
      }

      // Limit bullets to 5 for the email format
      bullets = bullets.slice(0, 5);
      // Limit special section to 5 items
      specialSection = specialSection.slice(0, 5);

      // Get token usage
      const tokenCount = completion.usage?.total_tokens || 0;

      return {
        bigStory,
        bullets,
        specialSection,
        topic,
        loungeId,
        modelUsed: 'gpt-4o-mini',
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

    // Determine special section title based on topic
    const topicLower = summary.topic.toLowerCase();
    const isGrowthTopic = topicLower.includes('growth');
    const isVentureTopic = topicLower.includes('venture');

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
      specialSectionTitle = `${summary.topic} Fundraising Announcements`;
    }

    const { data, error } = await this.supabase
      .from('daily_news_summaries')
      .insert({
        lounge_id: summary.loungeId || null,
        topic: summary.topic,
        summary_bullets: summary.bullets as unknown as Json,
        special_section: summary.specialSection as unknown as Json,
        model_used: summary.modelUsed,
        token_count: summary.tokenCount,
        generation_time_ms: summary.generationTimeMs,
        source_content_ids: summary.sourceContentIds,
        metadata: {
          generatedAt: new Date().toISOString(),
          bigStory: summary.bigStory || null,
          special_section_type: isGrowthTopic
            ? 'growth_experiments'
            : 'fundraising',
          special_section_title: specialSectionTitle,
        } as unknown as Json,
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
   * Enhance a summary with OpenGraph images (now includes AI fallback)
   */
  async enhanceSummaryWithImages(
    summary: {
      bigStory?: BigStory;
      bullets: BulletPoint[];
      specialSection?: BulletPoint[];
    },
    category?: string
  ): Promise<{
    bigStory?: BigStory;
    bullets: BulletPoint[];
    specialSection?: BulletPoint[];
  }> {
    try {
      const itemsToFetch: Array<{
        url: string;
        title?: string;
        source?: string;
        isBigStory?: boolean;
      }> = [];

      // Collect URLs with metadata for AI generation if needed
      if (summary.bigStory?.sourceUrl) {
        console.log(
          'BigStory URL to fetch image for:',
          summary.bigStory.sourceUrl
        );
        itemsToFetch.push({
          url: summary.bigStory.sourceUrl,
          title: summary.bigStory.title,
          source: summary.bigStory.source,
          isBigStory: true, // Mark this as the big story for 16:9 aspect ratio
        });
      }

      summary.bullets.forEach((bullet) => {
        if (bullet.sourceUrl) {
          itemsToFetch.push({
            url: bullet.sourceUrl,
            title: bullet.text,
            source: bullet.source,
            isBigStory: false, // Regular bullets get square images
          });
        }
      });

      // Add special section items
      summary.specialSection?.forEach((item) => {
        if (item.sourceUrl) {
          itemsToFetch.push({
            url: item.sourceUrl,
            title: item.text,
            source: item.source,
            isBigStory: false, // Special section items get square images
          });
        }
      });

      // Fetch OpenGraph images in parallel (now with AI fallback built-in)
      const imageMap = await OpenGraphService.fetchBulkImages(
        itemsToFetch,
        category
      );

      // Add images to big story
      let enhancedBigStory = summary.bigStory;
      if (enhancedBigStory?.sourceUrl) {
        const fetchedImage = imageMap.get(enhancedBigStory.sourceUrl);

        // No need for domain fallback anymore - AI handles it
        console.log('BigStory image results:', {
          sourceUrl: enhancedBigStory.sourceUrl,
          imageUrl: fetchedImage || 'AI generation pending',
        });

        enhancedBigStory = {
          ...enhancedBigStory,
          imageUrl: fetchedImage || undefined,
        };
      }

      // Add images to bullets
      const enhancedBullets = summary.bullets.map((bullet) => {
        if (bullet.sourceUrl) {
          const imageUrl = imageMap.get(bullet.sourceUrl);
          return { ...bullet, imageUrl: imageUrl || undefined };
        }
        return bullet;
      });

      // Add images to special section
      const enhancedSpecialSection = summary.specialSection?.map((item) => {
        if (item.sourceUrl) {
          const imageUrl = imageMap.get(item.sourceUrl);
          return { ...item, imageUrl: imageUrl || undefined };
        }
        return item;
      });

      return {
        bigStory: enhancedBigStory,
        bullets: enhancedBullets,
        specialSection: enhancedSpecialSection,
      };
    } catch (error) {
      console.error('Error enhancing summary with images:', error);
      // Return original summary if enhancement fails
      return summary;
    }
  }

  /**
   * Get the most recent summary for a lounge
   */
  async getLatestSummary(loungeId: string): Promise<{
    bigStory?: BigStory;
    bullets: BulletPoint[];
    specialSection?: BulletPoint[];
    specialSectionTitle?: string;
    generatedAt: string;
  } | null> {
    if (!this.supabase) {
      console.error('Supabase client not initialized');
      return null;
    }

    const { data, error } = await this.supabase
      .from('daily_news_summaries')
      .select('summary_bullets, special_section, generated_at, metadata')
      .eq('lounge_id', loungeId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      console.log('No summary found for lounge:', loungeId);
      return null;
    }

    // Check if we have the new format with bigStory in metadata
    const metadata = data.metadata as any;
    const bigStory = metadata?.bigStory as BigStory | undefined;
    const specialSectionTitle = metadata?.special_section_title as
      | string
      | undefined;

    console.log('Retrieved summary from DB:', {
      loungeId,
      hasBigStory: !!bigStory,
      bigStoryTitle: bigStory?.title,
      bigStoryUrl: bigStory?.sourceUrl,
      bulletCount: (data.summary_bullets as any[])?.length || 0,
      specialSectionCount: (data.special_section as any[])?.length || 0,
      specialSectionTitle,
    });

    return {
      bigStory,
      bullets: data.summary_bullets as unknown as BulletPoint[],
      specialSection: data.special_section as unknown as
        | BulletPoint[]
        | undefined,
      specialSectionTitle,
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
