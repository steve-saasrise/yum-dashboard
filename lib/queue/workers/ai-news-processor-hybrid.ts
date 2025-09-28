import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { getHybridNewsService } from '@/lib/services/hybrid-news-service';
import { getGPT5NewsService } from '@/lib/services/gpt5-news-service';
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

// Feature flag to enable/disable hybrid mode
const USE_HYBRID_MODE = process.env.USE_HYBRID_NEWS === 'true';

export async function processAINewsGenerationHybrid(job: { data: AINewsJobData }) {
  const startTime = Date.now();
  const { loungeId, loungeName, loungeDescription, isGeneral } = job.data;
  const jobId = (job as any).id || 'test-job';

  console.log(
    `[AI News Worker] Processing news generation for: ${loungeName} (Job ID: ${jobId}) ` +
    `[Mode: ${USE_HYBRID_MODE ? 'HYBRID RSS+GPT5' : 'Pure GPT5'}]`
  );

  try {
    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let newsResult;

    if (USE_HYBRID_MODE) {
      // Use new hybrid service (RSS + GPT-5 curation)
      console.log(
        `[AI News Worker] Using HYBRID mode with RSS feeds for: ${loungeName}`
      );

      const hybridService = getHybridNewsService();

      newsResult = await hybridService.generateNews({
        loungeType: loungeName,
        maxBullets: 5,
        maxSpecialSection: 5,
        useRSSFeeds: true,
        fallbackToPureGeneration: true,
        minArticlesRequired: 10,
        useDedicatedFundingSearch: true, // Enable GPT-5-mini funding search
        fundingSearchTimeframe: '48h', // Search last 48 hours for funding news
      });
    } else {
      // Use existing pure GPT-5 generation
      console.log(
        `[AI News Worker] Using pure GPT-5 generation for: ${loungeName}`
      );

      const gpt5NewsService = getGPT5NewsService();

      newsResult = await gpt5NewsService.generateNews({
        loungeType: loungeName,
        maxBullets: 5,
        maxSpecialSection: 5,
      });
    }

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

    // Log if we have real URLs (from RSS) vs generated ones
    if (USE_HYBRID_MODE) {
      const realUrlCount = validItems.filter(
        (item) => item.sourceUrl && item.sourceUrl.startsWith('http')
      ).length;
      console.log(
        `[AI News Worker] ${realUrlCount}/${validItems.length} items have real article URLs`
      );
    }

    // Save to database with proper structure
    const { data: savedSummary, error: saveError } = await supabase
      .from('daily_news_summaries')
      .insert({
        lounge_id: isGeneral ? null : loungeId,
        topic: newsResult.topic,
        summary_bullets: newsResult.items as any,
        special_section: (newsResult.specialSection || []) as any,
        generated_at: newsResult.generatedAt,
        model_used: USE_HYBRID_MODE ? 'hybrid-gpt5-rss' : 'gpt-5',
        token_count: 0,
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
          articles_found: USE_HYBRID_MODE ? validItems.length : 0,
          articles_used: newsResult.items.length,
          generation_mode: USE_HYBRID_MODE ? 'hybrid' : 'pure',
        } as any,
      })
      .select('id')
      .single();

    if (saveError) {
      throw new Error(`Failed to save summary: ${saveError.message}`);
    }

    const processingTime = Date.now() - startTime;
    console.log(
      `[AI News Worker] Successfully generated news for ${loungeName} in ${processingTime}ms ` +
      `(Summary ID: ${savedSummary.id}) [Mode: ${USE_HYBRID_MODE ? 'HYBRID' : 'Pure'}]`
    );

    return {
      success: true,
      loungeId,
      loungeName,
      summaryId: savedSummary.id,
      itemCount: validItems.length,
      processingTime,
      mode: USE_HYBRID_MODE ? 'hybrid' : 'pure',
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

export function createAINewsProcessorWorkerHybrid() {
  const worker = new Worker<AINewsJobData>(
    QUEUE_NAMES.AI_NEWS_GENERATION,
    async (job: Job<AINewsJobData>) => {
      // Use the hybrid processing function
      return processAINewsGenerationHybrid(job);
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY.AI_NEWS_GENERATION,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
      // Rate limit for API calls (works for both RSS and GPT-5)
      limiter: {
        max: 40, // Maximum 40 jobs
        duration: 60000, // Per 60 seconds (1 minute)
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(
      `[AI News Worker] Job ${job.id} completed for ${job.data.loungeName} ` +
      `[Mode: ${USE_HYBRID_MODE ? 'HYBRID' : 'Pure'}]`
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
    `[AI News Worker] Started with concurrency: ${WORKER_CONCURRENCY.AI_NEWS_GENERATION} ` +
    `[Mode: ${USE_HYBRID_MODE ? 'HYBRID RSS+GPT5' : 'Pure GPT5'}]`
  );

  return worker;
}