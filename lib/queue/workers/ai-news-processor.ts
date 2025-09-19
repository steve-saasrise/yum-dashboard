import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import {
  getGPT5NewsService,
  GenerateNewsResult,
} from '@/lib/services/gpt5-news-service';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  WORKER_CONCURRENCY,
} from '../config';
import type { Database } from '@/types/database.types';

interface AINewsJobData {
  loungeId: string;
  loungeName: string;
  loungeDescription?: string;
  isGeneral?: boolean;
  timestamp: string;
}

// Export the processing logic so it can be used directly for testing
export async function processAINewsGeneration(job: { data: AINewsJobData }) {
  const startTime = Date.now();
  const { loungeId, loungeName, loungeDescription, isGeneral } = job.data;
  const jobId = (job as any).id || 'test-job';

  console.log(
    `[AI News Worker] Processing news generation for: ${loungeName} (Job ID: ${jobId})`
  );

  try {
    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize GPT-5 news service
    const gpt5NewsService = getGPT5NewsService();

    // Generate AI news using GPT-5
    console.log(
      `[AI News Worker] Generating news using GPT-5 for: ${loungeName}`
    );
    const newsResult = await gpt5NewsService.generateNews({
      loungeType: loungeName,
      maxBullets: 5,
      maxSpecialSection: 5,
    });

    // Validate the news result before saving
    if (!newsResult || !newsResult.items || newsResult.items.length === 0) {
      throw new Error(
        `Invalid news result for ${loungeName}: No items generated`
      );
    }

    // Additional validation: Check that items have actual content
    const validItems = newsResult.items.filter(
      (item) => item.text && item.text.trim().length > 10
    );

    if (validItems.length === 0) {
      throw new Error(
        `Invalid news result for ${loungeName}: All items are empty or too short`
      );
    }

    console.log(
      `[AI News Worker] Generated ${validItems.length} valid news items for ${loungeName}`
    );

    // Save to database with proper structure
    const { data: savedSummary, error: saveError } = await supabase
      .from('daily_news_summaries')
      .insert({
        lounge_id: isGeneral ? null : loungeId,
        topic: newsResult.topic,
        summary_bullets: newsResult.items as any, // Items now have all fields
        special_section: (newsResult.specialSection || []) as any,
        generated_at: newsResult.generatedAt,
        model_used: 'gpt-5',
        token_count: 0, // Can be calculated if needed
        generation_time_ms: Date.now() - startTime,
        used_in_digest: false,
        metadata: {
          cron_generated: true,
          is_general: isGeneral || false,
          generated_at: newsResult.generatedAt,
          job_id: jobId,
          queue_generated: true,
          bigStory: newsResult.bigStory || null,
          special_section_title: newsResult.specialSectionTitle || null,
          special_section_type: newsResult.topic
            .toLowerCase()
            .includes('growth')
            ? 'growth_experiments'
            : 'fundraising',
          articles_found: 0,
          articles_used: newsResult.items.length,
        } as any,
      })
      .select('id')
      .single();

    if (saveError) {
      throw new Error(`Failed to save summary: ${saveError.message}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[AI News Worker] Successfully generated news for ${loungeName} in ${processingTime}ms (Summary ID: ${savedSummary.id})`
    );

    return {
      success: true,
      loungeId,
      loungeName,
      summaryId: savedSummary.id,
      itemCount: validItems.length,
      processingTime,
    };
  } catch (error: any) {
    const errorMessage = error.message || error.toString();

    // Check if it's a rate limit error that should trigger retry
    const isRateLimitError =
      errorMessage.includes('429') ||
      errorMessage.includes('Rate limit') ||
      errorMessage.includes('rate limit');

    console.error(
      `[AI News Worker] Error generating news for ${loungeName}:`,
      errorMessage
    );

    // Log additional details for rate limit errors
    if (isRateLimitError) {
      console.log(
        `[AI News Worker] Rate limit detected. Job will be retried with backoff.`
      );
    }

    // Re-throw to trigger BullMQ retry mechanism
    throw error;
  }
}

export function createAINewsProcessorWorker() {
  const worker = new Worker<AINewsJobData>(
    QUEUE_NAMES.AI_NEWS_GENERATION,
    async (job: Job<AINewsJobData>) => {
      // Use the shared processing function
      return processAINewsGeneration(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY.AI_NEWS_GENERATION,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
      // Rate limit to respect Perplexity's 50 requests per minute limit
      // With safety margin: 40 requests per minute
      limiter: {
        max: 40, // Maximum 40 jobs
        duration: 60000, // Per 60 seconds (1 minute)
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(
      `[AI News Worker] Job ${job.id} completed for ${job.data.loungeName}`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[AI News Worker] Job ${job?.id} failed for ${job?.data.loungeName}:`,
      err.message
    );
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[AI News Worker] Job ${jobId} stalled`);
  });

  console.log(
    `[AI News Worker] Started with concurrency: ${WORKER_CONCURRENCY.AI_NEWS_GENERATION}`
  );

  return worker;
}
