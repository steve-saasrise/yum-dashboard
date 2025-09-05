import { OpenAI } from 'openai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  GenerateSummaryInput,
  GenerateSummaryResult,
  SummaryStatus,
} from '@/types/content';

// Rate limiting configuration
const RATE_LIMITS = {
  'gpt-5-mini': {
    requestsPerMinute: 1000,
    tokensPerMinute: 400000,
    requestsPerDay: 20000,
  },
  'gpt-4o-mini': {
    requestsPerMinute: 500,
    tokensPerMinute: 200000,
    requestsPerDay: 10000,
  },
  'gpt-4': {
    requestsPerMinute: 500,
    tokensPerMinute: 40000,
    requestsPerDay: 10000,
  },
  'gpt-3.5-turbo': {
    requestsPerMinute: 3500,
    tokensPerMinute: 90000,
    requestsPerDay: 10000,
  },
};

// Cost per 1M tokens (as of 2025)
const COST_PER_MILLION_TOKENS = {
  'gpt-5-mini': {
    input: 0.25, // $0.25 per 1M input tokens
    output: 2.0, // $2.00 per 1M output tokens
  },
  'gpt-4o-mini': {
    input: 0.15, // $0.15 per 1M input tokens
    output: 0.6, // $0.60 per 1M output tokens
  },
  'gpt-4': {
    input: 30.0, // $30 per 1M input tokens
    output: 60.0, // $60 per 1M output tokens
  },
  'gpt-3.5-turbo': {
    input: 0.5, // $0.50 per 1M input tokens
    output: 1.5, // $1.50 per 1M output tokens
  },
};

export class AISummaryService {
  private openai: OpenAI | null = null;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private totalTokensUsed = { input: 0, output: 0 };
  private sessionCost = 0;

  constructor() {
    this.initializeOpenAI();
  }

  private initializeOpenAI() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && !this.openai) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private calculateCost(
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const costs =
      COST_PER_MILLION_TOKENS[model as keyof typeof COST_PER_MILLION_TOKENS] ||
      COST_PER_MILLION_TOKENS['gpt-4o-mini'];
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    return inputCost + outputCost;
  }

  getCostReport(): {
    totalTokens: { input: number; output: number };
    estimatedCost: number;
  } {
    return {
      totalTokens: { ...this.totalTokensUsed },
      estimatedCost: this.sessionCost,
    };
  }

  private async checkRateLimit(model: string): Promise<void> {
    const now = Date.now();
    const timeSinceReset = now - this.lastResetTime;

    // Reset counter every minute
    if (timeSinceReset >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }

    const limits =
      RATE_LIMITS[model as keyof typeof RATE_LIMITS] ||
      RATE_LIMITS['gpt-4o-mini'];

    // Check if we're approaching rate limit
    if (this.requestCount >= limits.requestsPerMinute * 0.8) {
      // Wait until the next minute
      const waitTime = 60000 - timeSinceReset;
      if (waitTime > 0) {
        console.log(`Approaching rate limit, waiting ${waitTime}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.requestCount = 0;
        this.lastResetTime = Date.now();
      }
    }

    this.requestCount++;
  }

  async generateSummary(
    input: GenerateSummaryInput,
    supabaseClient?: ReturnType<typeof createServerClient>
  ): Promise<GenerateSummaryResult> {
    // Try to initialize OpenAI if not already done
    this.initializeOpenAI();

    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const {
      content_id,
      text,
      model = 'gpt-4o-mini',
      generateShort = true,
      generateLong = true,
    } = input;

    if (!text || text.trim().length === 0) {
      throw new Error('No text provided for summarization');
    }

    // Use provided client or create a new one
    let supabase = supabaseClient;
    if (!supabase) {
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      );
    }

    try {
      // Update status to processing
      await this.updateSummaryStatus(supabase, content_id, 'processing');

      const results: GenerateSummaryResult = {
        content_id,
        success: false,
      };

      // Calculate word count once
      const wordCount = this.countWords(text);

      // Only generate summaries if content has at least 30 words
      if (wordCount < 30) {
        // Content too short for summarization
        console.log(
          `[AI Summary] Content too short (${wordCount} words), skipping summary generation`
        );
      } else {
        // Generate short summary for content with 30+ words
        if (generateShort) {
          try {
            const shortSummary = await this.generateShortSummary(text, model);
            results.shortSummary = shortSummary;
          } catch (err) {
            // Error generating short summary
            results.error =
              err instanceof Error
                ? err.message
                : 'Failed to generate short summary';
          }
        }

        // Generate long summary if requested and text has at least 100 words
        if (generateLong && wordCount >= 100) {
          try {
            const longSummary = await this.generateLongSummary(text, model);
            results.longSummary = longSummary;
          } catch (err) {
            // Error generating long summary
            if (!results.error) {
              results.error =
                err instanceof Error
                  ? err.message
                  : 'Failed to generate long summary';
            }
          }
        }
      }

      // Update database with results
      const updateData: any = {
        summary_generated_at: new Date().toISOString(),
        summary_model: model,
        summary_error_message: results.error || null,
      };

      // Determine status based on word count and results
      if (wordCount < 30) {
        // Content too short - mark as completed without summaries
        updateData.summary_status = 'completed';
        updateData.ai_summary_short = null;
        updateData.ai_summary_long = null;
        updateData.summary_word_count_short = 0;
        updateData.summary_word_count_long = 0;
      } else {
        // Content long enough - update with generated summaries
        updateData.ai_summary_short = results.shortSummary || null;
        updateData.ai_summary_long = results.longSummary || null;
        updateData.summary_status =
          results.shortSummary || results.longSummary ? 'completed' : 'error';
        updateData.summary_word_count_short = results.shortSummary
          ? this.countWords(results.shortSummary)
          : 0;
        updateData.summary_word_count_long = results.longSummary
          ? this.countWords(results.longSummary)
          : 0;
      }

      const { error: updateError } = await supabase
        .from('content')
        .update(updateData)
        .eq('id', content_id);

      if (updateError) {
        throw updateError;
      }

      results.success = true;
      return results;
    } catch (error) {
      // Update status to error
      await this.updateSummaryStatus(
        supabase,
        content_id,
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  private async generateShortSummary(
    text: string,
    model: string
  ): Promise<string> {
    // Try to initialize OpenAI if not already done
    this.initializeOpenAI();

    if (!this.openai) throw new Error('OpenAI not initialized');

    // Check rate limits before making request
    await this.checkRateLimit(model);

    // Use structured JSON prompt for better AI understanding
    const completionParams: any = {
      model,
      messages: [
        {
          role: 'system',
          content: JSON.stringify({
            role: 'concise content summarizer',
            task: 'create brief summary',
            requirements: {
              wordCount: { max: 30, strict: true },
              focus: ['key point', 'main idea', 'core message'],
              style: ['direct', 'informative', 'clear', 'factual']
            },
            format: {
              type: 'plain text',
              structure: 'single paragraph',
              grammar: 'complete sentences'
            },
            constraints: [
              'NO introductory phrases like "This article discusses"',
              'NO unnecessary adjectives or filler words',
              'FOCUS on the most important information',
              'BE factual and accurate',
              'START directly with the subject matter'
            ]
          }, null, 2)
        },
        {
          role: 'user',
          content: JSON.stringify({
            instruction: 'Summarize this content in exactly 30 words or less',
            maxWords: 30,
            content: text.substring(0, 2000)
          }, null, 2)
        },
      ],
      temperature: 0.5,
    };

    // GPT-5 models use max_completion_tokens instead of max_tokens
    if (model.includes('gpt-5')) {
      completionParams.max_completion_tokens = 60;
    } else {
      completionParams.max_tokens = 60;
    }

    const response =
      await this.openai.chat.completions.create(completionParams);

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('No summary generated');
    }

    // Track token usage and cost
    if (response.usage) {
      this.totalTokensUsed.input += response.usage.prompt_tokens;
      this.totalTokensUsed.output += response.usage.completion_tokens;
      const cost = this.calculateCost(
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      );
      this.sessionCost += cost;
    }

    // Validate word count
    const wordCount = this.countWords(summary);
    if (wordCount > 30) {
      // Try to trim it down
      const words = summary.split(' ');
      return words.slice(0, 30).join(' ');
    }

    return summary;
  }

  private async generateLongSummary(
    text: string,
    model: string
  ): Promise<string> {
    // Try to initialize OpenAI if not already done
    this.initializeOpenAI();

    if (!this.openai) throw new Error('OpenAI not initialized');

    // Check rate limits before making request
    await this.checkRateLimit(model);

    // Use structured JSON prompt for comprehensive summary
    const completionParams: any = {
      model,
      messages: [
        {
          role: 'system',
          content: JSON.stringify({
            role: 'comprehensive content summarizer',
            task: 'create detailed summary',
            requirements: {
              wordCount: { max: 100, target: '80-100' },
              coverage: [
                'main points and arguments',
                'key details and data',
                'important context',
                'implications or conclusions'
              ],
              style: ['informative', 'clear', 'structured', 'professional']
            },
            format: {
              type: 'plain text',
              structure: 'coherent narrative with logical flow',
              grammar: 'complete sentences with proper transitions'
            },
            priorities: [
              'accuracy over brevity',
              'completeness of key information',
              'logical progression of ideas',
              'actionable insights when relevant',
              'preserve important numbers/statistics'
            ],
            constraints: [
              'NO conversational language or questions',
              'NO redundant information',
              'NO introductory phrases',
              'MAINTAIN factual accuracy',
              'PRESERVE important data points',
              'START with the main point'
            ]
          }, null, 2)
        },
        {
          role: 'user',
          content: JSON.stringify({
            instruction: 'Create comprehensive summary in 100 words or less',
            maxWords: 100,
            targetLength: '80-100 words for completeness',
            content: text.substring(0, 4000)
          }, null, 2)
        },
      ],
      temperature: 0.5,
    };

    // GPT-5 models use max_completion_tokens instead of max_tokens
    if (model.includes('gpt-5')) {
      completionParams.max_completion_tokens = 200;
    } else {
      completionParams.max_tokens = 200;
    }

    const response =
      await this.openai.chat.completions.create(completionParams);

    const summary = response.choices[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('No summary generated');
    }

    // Track token usage and cost
    if (response.usage) {
      this.totalTokensUsed.input += response.usage.prompt_tokens;
      this.totalTokensUsed.output += response.usage.completion_tokens;
      const cost = this.calculateCost(
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      );
      this.sessionCost += cost;
    }

    // Validate word count
    const wordCount = this.countWords(summary);
    if (wordCount > 100) {
      // Try to trim it down
      const words = summary.split(' ');
      return words.slice(0, 100).join(' ');
    }

    return summary;
  }

  async generateBatchSummaries(
    contentIds: string[],
    options: {
      model?: string;
      batchSize?: number;
      delayMs?: number;
      maxCost?: number;
      supabaseClient?: any; // Optional Supabase client for server contexts
    } = {}
  ): Promise<{ processed: number; errors: number; estimatedCost?: number }> {
    const {
      model = 'gpt-4o-mini',
      batchSize = 5,
      delayMs = 1000,
      maxCost = 10.0, // Default $10 limit per batch run
      supabaseClient,
    } = options;
    let processed = 0;
    let errors = 0;
    const startingCost = this.sessionCost;

    // Use provided client or create a new one
    let supabase = supabaseClient;
    if (!supabase) {
      const cookieStore = await cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // The `setAll` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      );
    }

    // Process in batches to avoid rate limits
    for (let i = 0; i < contentIds.length; i += batchSize) {
      // Check cost limit
      const currentBatchCost = this.sessionCost - startingCost;
      if (currentBatchCost >= maxCost) {
        console.warn(
          `Cost limit reached: $${currentBatchCost.toFixed(2)}. Stopping batch processing.`
        );
        break;
      }

      const batch = contentIds.slice(i, i + batchSize);

      // Fetch content for this batch
      const { data: contents, error: fetchError } = await supabase
        .from('content')
        .select('id, content_body')
        .in('id', batch);

      console.log('[AI Summary] Batch fetch:', {
        batchSize: batch.length,
        foundContent: contents?.length || 0,
        error: fetchError?.message,
      });

      if (fetchError || !contents) {
        console.error(
          '[AI Summary] Failed to fetch content batch:',
          fetchError
        );
        errors += batch.length;
        continue;
      }

      // Process each content item
      await Promise.all(
        contents.map(async (content: { id: string; content_body?: string }) => {
          try {
            const text = content.content_body?.trim() || '';
            if (text) {
              await this.generateSummary(
                {
                  content_id: content.id,
                  text,
                  model,
                },
                supabase
              );
              processed++;
            }
          } catch {
            // Error processing content
            errors++;
          }
        })
      );

      // Add delay between batches to respect rate limits
      if (i + batchSize < contentIds.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    const totalCost = this.sessionCost - startingCost;
    console.log(
      `Batch summary generation complete. Cost: $${totalCost.toFixed(4)}`
    );

    return {
      processed,
      errors,
      estimatedCost: totalCost,
    };
  }

  async getPendingSummaries(limit: number = 100): Promise<string[]> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('content')
      .select('id')
      .eq('summary_status', 'pending')
      .limit(limit);

    if (error) {
      throw error;
    }

    return data?.map((item: { id: string }) => item.id) || [];
  }

  private async updateSummaryStatus(
    supabase: ReturnType<typeof createServerClient>,
    contentId: string,
    status: SummaryStatus,
    errorMessage?: string
  ) {
    const updateData: {
      summary_status: SummaryStatus;
      summary_error_message?: string;
    } = {
      summary_status: status,
    };

    if (errorMessage) {
      updateData.summary_error_message = errorMessage;
    }

    await supabase.from('content').update(updateData).eq('id', contentId);
  }

  private countWords(text: string): number {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }
}

// Singleton instance
let summaryService: AISummaryService | null = null;

export function getAISummaryService(): AISummaryService {
  if (!summaryService) {
    summaryService = new AISummaryService();
  }
  return summaryService;
}
