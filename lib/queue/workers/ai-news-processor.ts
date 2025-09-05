import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { AINewsService } from '@/lib/services/ai-news-service';
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

export function createAINewsProcessorWorker() {
  const worker = new Worker<AINewsJobData>(
    QUEUE_NAMES.AI_NEWS_GENERATION,
    async (job: Job<AINewsJobData>) => {
      const startTime = Date.now();
      const { loungeId, loungeName, loungeDescription, isGeneral } = job.data;

      console.log(
        `[AI News Worker] Processing news generation for: ${loungeName} (Job ID: ${job.id})`
      );

      try {
        // Initialize Supabase client with service key
        const supabase = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Initialize AI news service
        const aiNewsService = new AINewsService();

        // Generate AI news
        console.log(`[AI News Worker] Generating news for: ${loungeName}`);
        const newsResult = await aiNewsService.generateNews(
          loungeName,
          loungeDescription
        );

        // Save to database
        const { data: savedSummary, error: saveError } = await supabase
          .from('daily_news_summaries')
          .insert({
            lounge_id: isGeneral ? null : loungeId,
            topic: newsResult.topic,
            summary_bullets: newsResult.items as any,
            generated_at: new Date().toISOString(),
            model_used: 'gpt-4o-mini',
            token_count: 0, // Can be calculated if needed
            generation_time_ms: Date.now() - startTime,
            used_in_digest: false,
            metadata: {
              cron_generated: true,
              is_general: isGeneral || false,
              generated_at: new Date().toISOString(),
              job_id: job.id,
              queue_generated: true,
              bigStory: newsResult.bigStory || null,
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
          itemCount: newsResult.items.length,
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
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY.AI_NEWS_GENERATION,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
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
