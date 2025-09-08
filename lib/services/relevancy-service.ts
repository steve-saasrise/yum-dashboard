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
  reference_type?: string | null;
  referenced_content?: any | null;
}

interface RelevancyResult {
  content_id: string;
  lounge_id: string;
  score: number;
  reason: string;
}

interface PromptAdjustment {
  adjustment_type: 'keep' | 'filter' | 'borderline';
  adjustment_text: string;
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
   * Get dynamic prompt adjustments from database
   */
  private async getPromptAdjustments(
    loungeId: string
  ): Promise<PromptAdjustment[]> {
    const { data, error } = await this.supabase
      .from('prompt_adjustments')
      .select('adjustment_type, adjustment_text')
      .eq('lounge_id', loungeId)
      .eq('approved', true)
      .eq('active', true);

    if (error) {
      console.error('Error fetching prompt adjustments:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Build lounge context with base rules and dynamic adjustments
   */
  private async buildLoungeContext(
    loungeName: string,
    loungeId: string
  ): Promise<string> {
    // Get dynamic adjustments from database
    const adjustments = await this.getPromptAdjustments(loungeId);

    // Group adjustments by type
    const keepAdjustments = adjustments
      .filter((a) => a.adjustment_type === 'keep')
      .map((a) => `- ${a.adjustment_text}`);
    const filterAdjustments = adjustments
      .filter((a) => a.adjustment_type === 'filter')
      .map((a) => `- ${a.adjustment_text}`);
    const borderlineAdjustments = adjustments
      .filter((a) => a.adjustment_type === 'borderline')
      .map((a) => `- ${a.adjustment_text}`);

    let baseContext = '';

    if (loungeName === 'SaaS') {
      // Base SaaS context
      const baseKeep = [
        '- ANY technology, software, AI, or programming content',
        '- AI tools, prompts, workflows, use cases (ChatGPT, Claude, Midjourney, etc.)',
        '- AI in business, AI automation, AI agents, AI APIs',
        '- Machine learning, LLMs, AI development, AI trends',
        '- Software as a Service businesses, SaaS metrics (MRR, ARR, churn, CAC, LTV)',
        '- B2B software sales, pricing, customer success',
        '- SaaS product development, features, integrations',
        '- Cloud software, subscription models, SaaS tools',
        '- Technical implementation (APIs, infrastructure, security, DevOps)',
        '- Software engineering, coding, architecture patterns',
        '- Tech industry news, product launches, acquisitions',
        '- Developer tools, productivity software, automation',
        '- Open source projects, tech tutorials, best practices',
        '- No-code/low-code tools and platforms',
        ...keepAdjustments, // Add dynamic adjustments
      ];

      const baseBorderline = [
        '- General B2B business strategies without tech/AI context',
        '- Marketing/growth tactics without specific software examples',
        '- Generic startup advice without tech/software focus',
        '- Brand building without product context',
        ...borderlineAdjustments,
      ];

      const baseFilter = [
        '- Pure celebrity/entertainment content',
        '- Consumer product reviews (non-tech)',
        '- Personal life updates unrelated to tech/work',
        '- Motivational quotes without business/tech context',
        '- Political content unrelated to tech industry',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 60+):
${baseKeep.join('\n')}

BORDERLINE (Score 40-59):
${baseBorderline.join('\n')}

FILTER OUT (Score <40):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'B2B Growth' || loungeName === 'Growth Coffee') {
      // B2B Growth specific context
      const baseKeep = [
        '- B2B sales techniques, strategies, and methodologies',
        '- Account-based marketing (ABM) and enterprise sales',
        '- Lead generation, nurturing, and conversion strategies',
        '- B2B content marketing and thought leadership',
        '- Sales enablement tools and processes',
        '- Customer acquisition strategies for B2B',
        '- Revenue operations and growth metrics',
        '- B2B pricing strategies and models',
        '- Partnership and channel strategies',
        '- B2B customer success and retention',
        '- Marketing automation for B2B',
        '- LinkedIn and B2B social selling strategies',
        '- Case studies of B2B growth',
        '- SaaS growth tactics and metrics',
        '- Professional insights about growing B2B companies',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Personal life events (engagements, birthdays, vacations)',
        '- Sports news or entertainment gossip',
        '- Celebrity news or pop culture references',
        '- Personal relationship updates',
        '- Food, fashion, or lifestyle content without B2B angle',
        '- Motivational quotes without specific B2B context',
        '- Political content unrelated to B2B business',
        '- Consumer product reviews (B2C focus)',
        '- Personal hobbies or interests unrelated to B2B',
        '- General news without B2B business impact',
        '- Jokes or memes without B2B relevance',
        '- Weather, travel, or local news',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 60+):
${baseKeep.join('\n')}

FILTER OUT (Score <60):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'AI' || loungeName === 'AI Coffee') {
      // AI-specific lounge
      const baseKeep = [
        '- AI technology, machine learning, LLMs, neural networks',
        '- AI tools, products, and applications',
        '- AI research, papers, breakthroughs',
        '- AI in business, automation, AI agents',
        '- AI development, prompting, workflows',
        '- AI industry news, funding, acquisitions',
        '- AI ethics, safety, governance',
        '- AI startups and venture investments in AI',
        '- Technical AI discussions and implementations',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Sports results, athlete achievements, game scores',
        '- Tennis, football, basketball, or any sports competition',
        '- Celebrity gossip, entertainment news',
        '- Personal life updates (birthdays, vacations, relationships)',
        '- Food, fashion, lifestyle without AI context',
        '- Generic motivational quotes',
        '- Political content unrelated to AI policy',
        '- Health/fitness unless AI-related',
        '- Travel, weather, local news',
        '- Pure venture/business without AI angle',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 60+):
${baseKeep.join('\n')}

FILTER OUT (Score <60):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'Venture' || loungeName === 'Venture Coffee') {
      // Venture-specific lounge
      const baseKeep = [
        '- Venture capital, startup funding, investment rounds',
        '- Startup news, exits, acquisitions, IPOs',
        '- Founder stories, entrepreneurship insights',
        '- Investment strategies, portfolio management',
        '- Startup metrics, growth, scaling',
        '- Accelerators, incubators, startup programs',
        '- Angel investing, seed funding',
        '- Market analysis, industry trends',
        '- VC firm news, partner moves',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Sports results, athlete achievements, game scores',
        '- Tennis, football, basketball, or any sports competition',
        '- Celebrity gossip, entertainment news',
        '- Personal life updates (birthdays, vacations, relationships)',
        '- Food, fashion, lifestyle without business context',
        '- Generic motivational quotes',
        '- Political content unrelated to business/tech policy',
        '- Health/fitness unless startup-related',
        '- Travel, weather, local news',
        '- Pure technical content without business angle',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 60+):
${baseKeep.join('\n')}

FILTER OUT (Score <60):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'Crypto') {
      // Crypto-specific lounge
      const baseKeep = [
        '- Cryptocurrency, blockchain, DeFi, Web3',
        '- Crypto trading, markets, analysis',
        '- NFTs, DAOs, smart contracts',
        '- Crypto regulations, policy, legal',
        '- Blockchain development, protocols',
        '- Crypto projects, launches, updates',
        '- Mining, staking, yield farming',
        '- Crypto venture investments',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Sports, entertainment (unless business angle)',
        '- Personal daily routines unrelated to work',
        '- Birthday wishes, personal celebrations',
        '- Generic life advice without professional context',
        '- Political rants unrelated to crypto/tech',
        '- Vague excitement without context ("So cool!", "Amazing!")',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 60+):
${baseKeep.join('\n')}

FILTER OUT (Score <60):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'Biohacking') {
      const baseKeep = [
        '- Health optimization, fitness, nutrition content',
        '- Sleep, recovery, performance tips',
        '- Supplements, nootropics, health tech',
        '- Personal health experiments and results',
        '- Wellness routines and protocols',
        '- Mental health and cognitive enhancement',
        '- Even personal stories IF they include health insights',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Pure motivational content without health context',
        '- Business content unrelated to health',
        '- Political or social commentary',
        '- Entertainment, sports (unless health-related)',
        '- Vague statements without health information',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 50+):
${baseKeep.join('\n')}

FILTER OUT (Score <50):
${baseFilter.join('\n')}`;
    } else if (loungeName === 'Personal Growth') {
      const baseKeep = [
        '- Productivity tips and systems',
        '- Goal setting and achievement',
        '- Learning strategies, skill development',
        '- Career growth and professional development',
        '- Mindset and psychology insights',
        '- Work-life balance strategies',
        '- Personal experiences with lessons learned',
        '- Even motivational content IF it has actionable advice',
        ...keepAdjustments,
      ];

      const baseFilter = [
        '- Empty motivational quotes with no substance',
        '- Pure business metrics without growth angle',
        '- Technical content without learning aspect',
        '- Political or controversial topics',
        '- Entertainment without educational value',
        ...filterAdjustments,
      ];

      baseContext = `
KEEP (Score 50+):
${baseKeep.join('\n')}

FILTER OUT (Score <50):
${baseFilter.join('\n')}`;
    }

    return baseContext;
  }

  /**
   * Check relevancy for a single content item
   */
  private async checkSingleItem(
    item: RelevancyCheckItem
  ): Promise<RelevancyResult> {
    try {
      // Build lounge context with base rules and dynamic adjustments
      const loungeContext = await this.buildLoungeContext(
        item.lounge_name,
        item.lounge_id
      );

      // loungeContext is now built dynamically above

      // Build content description including referenced content
      let fullContent = item.content_description || item.content_title;

      // If this is a quote tweet, retweet, or reply, include the referenced content
      if (item.reference_type && item.referenced_content) {
        const refContent = item.referenced_content;
        if (item.reference_type === 'quote') {
          fullContent += `\n\n[QUOTED TWEET: ${refContent.text || refContent.description || ''}]`;
          if (refContent.author?.username) {
            fullContent += ` by @${refContent.author.username}`;
          }
        } else if (item.reference_type === 'retweet') {
          // For retweets, the referenced content IS the main content
          fullContent = `[RETWEET: ${refContent.text || refContent.description || fullContent}]`;
          if (refContent.author?.username) {
            fullContent += ` by @${refContent.author.username}`;
          }
        } else if (item.reference_type === 'reply') {
          fullContent += `\n\n[REPLYING TO: @${refContent.author?.username || 'unknown'}]`;
        }
      }

      const prompt = `You are a strict content curator for a professional tech/business lounge. Be STRICT about filtering off-topic content.

LOUNGE: ${item.lounge_name}
${loungeContext}

CONTENT TO EVALUATE:
Author: ${item.creator_name}
Content: ${fullContent}

CRITICAL FILTERING RULES:
- Sports content (tennis, football, basketball, US Open, World Cup, etc.) scores BELOW 40 unless it has EXPLICIT business/tech angle
- Personal achievements in sports/entertainment score BELOW 40
- Be STRICT: Content must be DIRECTLY relevant to the lounge theme, not tangentially related
- For quote tweets/retweets: BOTH the commentary AND quoted content must be relevant. If either is off-topic, score low.

Score 0-100 based on relevance to the lounge. The threshold is ${item.lounge_name === 'Biohacking' || item.lounge_name === 'Personal Growth' ? '50' : '60'}.
For ${item.lounge_name.includes('AI') ? 'AI lounges: ONLY AI/ML content scores 60+' : item.lounge_name.includes('Venture') ? 'Venture lounges: ONLY startup/investment content scores 60+' : 'this lounge: stay strictly on theme'}.

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
    // Group results by content_id and track ALL lounges and their scores
    const contentScores = new Map<
      string,
      {
        highestScore: number;
        highestReason: string;
        loungeScores: Map<string, { score: number; threshold: number }>;
      }
    >();

    // First pass: collect all scores for each content across all lounges
    for (const result of results) {
      const existing = contentScores.get(result.content_id);
      if (!existing) {
        contentScores.set(result.content_id, {
          highestScore: result.score,
          highestReason: result.reason,
          loungeScores: new Map([
            [result.lounge_id, { score: result.score, threshold: 0 }],
          ]),
        });
      } else {
        // Update highest score if this one is higher
        if (result.score > existing.highestScore) {
          existing.highestScore = result.score;
          existing.highestReason = result.reason;
        }
        // Track this lounge's score
        existing.loungeScores.set(result.lounge_id, {
          score: result.score,
          threshold: 0,
        });
      }
    }

    // Get all lounge thresholds we need
    const allLoungeIds = new Set<string>();
    contentScores.forEach((data) => {
      data.loungeScores.forEach((_, loungeId) => {
        allLoungeIds.add(loungeId);
      });
    });

    // Fetch all lounge thresholds in one query
    const { data: lounges } = await this.supabase
      .from('lounges')
      .select('id, relevancy_threshold')
      .in('id', Array.from(allLoungeIds));

    const loungeThresholds = new Map<string, number>();
    if (lounges) {
      for (const lounge of lounges) {
        loungeThresholds.set(lounge.id, lounge.relevancy_threshold || 60);
      }
    }

    // Update each content item
    const entries = Array.from(contentScores.entries());
    for (const [
      contentId,
      { highestScore, highestReason, loungeScores },
    ] of entries) {
      // Update the relevancy score with the highest score
      const { error } = await this.supabase
        .from('content')
        .update({
          relevancy_score: highestScore,
          relevancy_reason: highestReason,
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

      // Check if content should be auto-deleted
      // Only delete if score is below threshold for ALL lounges it belongs to
      let shouldDelete = true;
      loungeScores.forEach((scoreData, loungeId) => {
        const threshold = loungeThresholds.get(loungeId) || 60;
        if (scoreData.score >= threshold) {
          shouldDelete = false;
        }
      });

      // If score is below threshold for ALL lounges, add to deleted_content
      if (shouldDelete) {
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
            // Note: platform in content table is enum, but text in deleted_content
            const { error: deleteError } = await this.supabase
              .from('deleted_content')
              .insert({
                platform_content_id: content.platform_content_id,
                platform: String(content.platform), // Convert enum to string
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
              // Build a summary of all lounge scores and thresholds
              const loungeDetails = Array.from(loungeScores.entries())
                .map(([lid, { score }]) => {
                  const threshold = loungeThresholds.get(lid) || 60;
                  return `${lid.substring(0, 8)}: ${score}/${threshold}`;
                })
                .join(', ');
              console.log(
                `Auto-deleted content ${contentId} - failed all thresholds: [${loungeDetails}]`
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
      console.log(
        `[RelevancyService] Starting processRelevancyChecks with limit: ${limit}`
      );

      const items = await this.getContentForRelevancyCheck(limit);
      console.log(
        `[RelevancyService] getContentForRelevancyCheck returned ${items.length} items`
      );

      if (items.length === 0) {
        console.log('[RelevancyService] No items to process, returning early');
        return { processed: 0, errors: 0 };
      }

      console.log(
        `[RelevancyService] Processing ${items.length} items for relevancy check`
      );

      const results = await this.checkRelevancy(items);
      console.log(
        `[RelevancyService] checkRelevancy returned ${results.length} results`
      );

      await this.updateRelevancyScores(results);
      console.log(`[RelevancyService] updateRelevancyScores completed`);

      console.log(
        `[RelevancyService] Completed relevancy check for ${results.length} items`
      );

      return {
        processed: results.length,
        errors: items.length - results.length,
      };
    } catch (error) {
      console.error(
        '[RelevancyService] Error in processRelevancyChecks:',
        error
      );
      console.error(
        '[RelevancyService] Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      );
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
