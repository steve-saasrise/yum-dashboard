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
    input: GenerateSummaryInput
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

    try {
      // Update status to processing
      await this.updateSummaryStatus(supabase, content_id, 'processing');

      const results: GenerateSummaryResult = {
        content_id,
        success: false,
      };

      // Generate short summary if requested
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
      const wordCount = this.countWords(text);
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

      // Update database with results
      const { error: updateError } = await supabase
        .from('content')
        .update({
          ai_summary_short: results.shortSummary || null,
          ai_summary_long: results.longSummary || null,
          summary_generated_at: new Date().toISOString(),
          summary_model: model,
          summary_status:
            results.shortSummary || results.longSummary ? 'completed' : 'error',
          summary_error_message: results.error || null,
          summary_word_count_short: results.shortSummary
            ? this.countWords(results.shortSummary)
            : 0,
          summary_word_count_long: results.longSummary
            ? this.countWords(results.longSummary)
            : 0,
        })
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

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a concise summarizer. Create a brief summary in 30 words or less. Focus on the key point or main idea. Be direct and informative.',
        },
        {
          role: 'user',
          content: `Summarize this content in 30 words or less:\n\n${text.substring(0, 2000)}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 60,
    });

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

    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a comprehensive summarizer. Create a detailed summary in 100 words or less. Cover the main points, key details, and important context. Be informative and clear.',
        },
        {
          role: 'user',
          content: `Summarize this content in 100 words or less:\n\n${text.substring(0, 4000)}`,
        },
      ],
      temperature: 0.5,
      max_tokens: 200,
    });

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
        .select('id, title, description')
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
        contents.map(
          async (content: {
            id: string;
            title?: string;
            description?: string;
          }) => {
            try {
              const text =
                `${content.title || ''}\n\n${content.description || ''}`.trim();
              if (text) {
                await this.generateSummary({
                  content_id: content.id,
                  text,
                  model,
                });
                processed++;
              }
            } catch {
              // Error processing content
              errors++;
            }
          }
        )
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
