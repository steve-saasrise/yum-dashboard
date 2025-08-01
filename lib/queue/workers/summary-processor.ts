import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  WORKER_CONCURRENCY,
} from '../config';
import { getAISummaryService } from '@/lib/services/ai-summary-service';

// Initialize service client lazily
let supabase: any;

function initializeServices() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
}

// Process AI summaries
async function processSummaries(job: Job) {
  // Initialize services on first use
  initializeServices();

  const { contentIds, creatorId } = job.data;

  console.log(
    `[Summary Job] Processing ${contentIds.length} items for creator ${creatorId}`
  );

  if (!process.env.OPENAI_API_KEY) {
    console.log('OpenAI API key not configured, skipping summary generation');
    return {
      success: true,
      skipped: true,
      reason: 'No OpenAI API key',
    };
  }

  try {
    await job.updateProgress(10);

    const summaryService = getAISummaryService();

    // Process summaries in smaller batches
    const BATCH_SIZE = 5;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < contentIds.length; i += BATCH_SIZE) {
      const batch = contentIds.slice(i, i + BATCH_SIZE);

      try {
        const results = await summaryService.generateBatchSummaries(batch, {
          batchSize: 3,
          supabaseClient: supabase,
        });

        processed += results.processed;
        errors += results.errors;
      } catch (error) {
        console.error('Batch summary generation failed:', error);
        errors += batch.length;
      }

      // Update progress
      const progress = 10 + (80 * (i + BATCH_SIZE)) / contentIds.length;
      await job.updateProgress(Math.min(progress, 90));
    }

    await job.updateProgress(100);

    return {
      success: true,
      total: contentIds.length,
      processed,
      errors,
      creatorId,
    };
  } catch (error) {
    console.error('Summary processing error:', error);
    throw error;
  }
}

// Create the worker
export function createSummaryProcessorWorker() {
  const worker = new Worker(QUEUE_NAMES.AI_SUMMARY, processSummaries, {
    connection: getRedisConnection(),
    concurrency: WORKER_CONCURRENCY.AI_SUMMARY,
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute (OpenAI rate limits)
    },
  });

  worker.on('completed', (job) => {
    console.log(
      `Summaries generated: ${job.returnvalue.processed}/${job.returnvalue.total}`
    );
  });

  worker.on('failed', (job, err) => {
    console.error('Summary generation failed:', err);
  });

  return worker;
}
