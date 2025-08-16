import OpenAI from 'openai';
import { SupabaseClient } from '@supabase/supabase-js';

interface RelevancyCheckItem {
  content_id: string;
  lounge_id: string;
  lounge_name: string;
  theme_description: string;
  content_title: string;
  content_description: string | null;
  content_url: string;
  creator_name: string;
}

interface RelevancyResult {
  content_id: string;
  lounge_id: string;
  score: number;
  reason: string;
}

export class RelevancyService {
  private openai: OpenAI;
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is not configured');
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    this.supabase = supabase;
  }

  /**
   * Check relevancy for a batch of content items
   */
  async checkRelevancy(
    items: RelevancyCheckItem[]
  ): Promise<RelevancyResult[]> {
    const results: RelevancyResult[] = [];

    // Process items in parallel batches of 5 to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item) => this.checkSingleItem(item))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Check relevancy for a single content item
   */
  private async checkSingleItem(
    item: RelevancyCheckItem
  ): Promise<RelevancyResult> {
    try {
      // Lounge-specific but broader, more inclusive prompts
      let loungeContext = '';

      if (
        item.lounge_name === 'SaaS' ||
        item.lounge_name === 'AI' ||
        item.lounge_name === 'Venture' ||
        item.lounge_name === 'B2B Growth' ||
        item.lounge_name === 'Crypto'
      ) {
        // Business/Tech lounges - filter out personal content
        loungeContext = `
KEEP (Score 60+):
- ANY business, technology, or professional content
- Cross-domain content (AI in SaaS, crypto ventures, etc.) is WELCOME
- Product launches, company news, industry analysis
- Technical content, engineering, development
- Marketing, sales, growth strategies
- Pricing, metrics, case studies
- Professional insights and experiences
- Even brief business observations or questions

FILTER OUT (Score <60):
- Pure motivational quotes with no business context
- Personal daily routines unrelated to work
- Birthday wishes, personal celebrations
- Generic life advice without professional context
- Political rants unrelated to tech/business
- Sports, entertainment (unless business angle)
- Vague excitement without context ("So cool!", "Amazing!")`;
      } else if (item.lounge_name === 'Biohacking') {
        loungeContext = `
KEEP (Score 50+):
- Health optimization, fitness, nutrition content
- Sleep, recovery, performance tips
- Supplements, nootropics, health tech
- Personal health experiments and results
- Wellness routines and protocols
- Mental health and cognitive enhancement
- Even personal stories IF they include health insights

FILTER OUT (Score <50):
- Pure motivational content without health context
- Business content unrelated to health
- Political or social commentary
- Entertainment, sports (unless health-related)
- Vague statements without health information`;
      } else if (item.lounge_name === 'Personal Growth') {
        loungeContext = `
KEEP (Score 50+):
- Productivity tips and systems
- Goal setting and achievement
- Learning strategies, skill development
- Career growth and professional development
- Mindset and psychology insights
- Work-life balance strategies
- Personal experiences with lessons learned
- Even motivational content IF it has actionable advice

FILTER OUT (Score <50):
- Empty motivational quotes with no substance
- Pure business metrics without growth angle
- Technical content without learning aspect
- Political or controversial topics
- Entertainment without educational value`;
      }

      const prompt = `You are a content curator. Be INCLUSIVE - when in doubt, keep the content.

LOUNGE: ${item.lounge_name}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${item.creator_name}
Content: ${item.content_description || item.content_title}

Score 0-100 based on relevance to the lounge. Be lenient - only filter obvious off-topic content.
The threshold is ${item.lounge_name === 'Biohacking' || item.lounge_name === 'Personal Growth' ? '50' : '60'}, so aim higher unless clearly off-topic.

Respond in JSON:
{
  "score": <0-100>,
  "reason": "<briefly explain relevance>"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a content relevancy evaluator. Always respond in valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      return {
        content_id: item.content_id,
        lounge_id: item.lounge_id,
        score: Math.min(100, Math.max(0, result.score || 0)),
        reason: result.reason || 'No reason provided',
      };
    } catch (error) {
      console.error(
        `Error checking relevancy for content ${item.content_id}:`,
        error
      );
      // Return a neutral score on error to avoid blocking content
      return {
        content_id: item.content_id,
        lounge_id: item.lounge_id,
        score: 50,
        reason: 'Error during relevancy check',
      };
    }
  }

  /**
   * Get content items that need relevancy checking
   */
  async getContentForRelevancyCheck(
    limit: number = 100
  ): Promise<RelevancyCheckItem[]> {
    const { data, error } = await this.supabase.rpc(
      'get_content_for_relevancy_check',
      {
        p_limit: limit,
      }
    );

    if (error) {
      console.error('Error fetching content for relevancy check:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Update relevancy scores in the database and auto-delete low scoring content
   */
  async updateRelevancyScores(results: RelevancyResult[]): Promise<void> {
    // Group results by content_id and take the highest score for each piece of content
    const contentScores = new Map<
      string,
      { score: number; reason: string; loungeId: string }
    >();

    for (const result of results) {
      const existing = contentScores.get(result.content_id);
      if (!existing || existing.score < result.score) {
        contentScores.set(result.content_id, {
          score: result.score,
          reason: result.reason,
          loungeId: result.lounge_id,
        });
      }
    }

    // Update each content item
    for (const [contentId, { score, reason, loungeId }] of contentScores) {
      // Update the relevancy score
      const { error } = await this.supabase
        .from('content')
        .update({
          relevancy_score: score,
          relevancy_reason: reason,
          relevancy_checked_at: new Date().toISOString(),
        })
        .eq('id', contentId);

      if (error) {
        console.error(
          `Error updating relevancy for content ${contentId}:`,
          error
        );
        continue;
      }

      // Get the lounge's threshold
      const { data: lounge } = await this.supabase
        .from('lounges')
        .select('relevancy_threshold')
        .eq('id', loungeId)
        .single();

      const threshold = lounge?.relevancy_threshold || 70;

      // If score is below threshold, add to deleted_content
      if (score < threshold) {
        // Get content details for deletion
        const { data: content } = await this.supabase
          .from('content')
          .select('platform_content_id, platform, creator_id, title, url')
          .eq('id', contentId)
          .single();

        if (content) {
          // Check if already deleted
          const { data: existing } = await this.supabase
            .from('deleted_content')
            .select('id')
            .eq('platform_content_id', content.platform_content_id)
            .eq('platform', content.platform)
            .eq('creator_id', content.creator_id)
            .single();

          if (!existing) {
            // Insert into deleted_content with relevancy reason
            const { error: deleteError } = await this.supabase
              .from('deleted_content')
              .insert({
                platform_content_id: content.platform_content_id,
                platform: content.platform,
                creator_id: content.creator_id,
                deleted_by: null, // System deletion
                deleted_at: new Date().toISOString(),
                deletion_reason: 'low_relevancy',
                title: content.title,
                url: content.url,
              });

            if (deleteError) {
              console.error(
                `Error auto-deleting content ${contentId}:`,
                deleteError
              );
            } else {
              console.log(
                `Auto-deleted content ${contentId} with score ${score} (threshold: ${threshold})`
              );
            }
          }
        }
      }
    }
  }

  /**
   * Process relevancy checks for all pending content
   */
  async processRelevancyChecks(limit: number = 100): Promise<{
    processed: number;
    errors: number;
  }> {
    try {
      const items = await this.getContentForRelevancyCheck(limit);

      if (items.length === 0) {
        return { processed: 0, errors: 0 };
      }

      console.log(
        `[RelevancyService] Processing ${items.length} items for relevancy check`
      );

      const results = await this.checkRelevancy(items);
      await this.updateRelevancyScores(results);

      console.log(
        `[RelevancyService] Completed relevancy check for ${results.length} items`
      );

      return {
        processed: results.length,
        errors: items.length - results.length,
      };
    } catch (error) {
      console.error('Error processing relevancy checks:', error);
      return { processed: 0, errors: 1 };
    }
  }
}

// Factory function to get relevancy service instance
export function getRelevancyService(
  supabase: SupabaseClient
): RelevancyService | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured - relevancy checking disabled');
    return null;
  }

  return new RelevancyService(supabase);
}
