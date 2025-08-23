import { Worker, Job } from 'bullmq';
import {
  getRedisConnection,
  QUEUE_NAMES,
  WORKER_CONCURRENCY,
} from '@/lib/queue/config';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { createClient } from '@supabase/supabase-js';

export interface BrightDataSnapshotJob {
  snapshotId: string;
  creatorUrls?: string[];
  maxResults?: number;
  metadata?: any;
}

/**
 * Process a BrightData snapshot
 * Phase 2 of the two-phase architecture
 */
async function processBrightDataSnapshot(job: Job<BrightDataSnapshotJob>) {
  const { snapshotId, maxResults, metadata } = job.data;
  console.log(`[BrightData Processor] Processing snapshot: ${snapshotId}`);

  // Use service role client for workers
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
  const contentService = new ContentService(supabase);

  // Initialize BrightData fetcher
  if (!process.env.BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY not configured');
  }

  const brightDataFetcher = new BrightDataFetcher({
    apiKey: process.env.BRIGHTDATA_API_KEY,
  });

  try {
    // Check snapshot status
    const snapshotStatus =
      await brightDataFetcher.getSnapshotMetadata(snapshotId);

    // Update database status
    await supabase
      .from('brightdata_snapshots')
      .update({
        status: snapshotStatus.status,
        last_checked_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          result_count: snapshotStatus.result_count,
          cost: snapshotStatus.cost,
          file_size: snapshotStatus.file_size,
        },
      })
      .eq('snapshot_id', snapshotId);

    if (snapshotStatus.status === 'ready') {
      console.log(
        `[BrightData Processor] Snapshot ${snapshotId} is ready, downloading data...`
      );

      // Mark as processing
      await supabase
        .from('brightdata_snapshots')
        .update({ status: 'processing' })
        .eq('snapshot_id', snapshotId);

      // Download and process the snapshot
      const contentItems = await brightDataFetcher.processReadySnapshot(
        snapshotId,
        maxResults || metadata?.max_results
      );

      console.log(
        `[BrightData Processor] Retrieved ${contentItems.length} items from snapshot`
      );

      // Add creator_id if available in metadata
      const creatorId = metadata?.creator_id;
      if (creatorId) {
        contentItems.forEach((item) => {
          item.creator_id = creatorId;
        });
      }

      // Store content in database
      if (contentItems.length > 0) {
        const results = await contentService.storeMultipleContent(contentItems);

        console.log(
          `[BrightData Processor] Storage results: ` +
            `${results.created} new, ${results.updated} updated, ${results.errors.length} errors`
        );

        // Update snapshot as processed
        await supabase
          .from('brightdata_snapshots')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            posts_retrieved: contentItems.length,
            creators_processed: 1,
            metadata: {
              ...metadata,
              storage_results: {
                created: results.created,
                updated: results.updated,
                errors: results.errors.length,
              },
            },
          })
          .eq('snapshot_id', snapshotId);

        // Queue new content for AI summaries if enabled
        if (results.created > 0 && process.env.OPENAI_API_KEY && creatorId) {
          const { data: newContent } = await supabase
            .from('content')
            .select('id')
            .eq('creator_id', creatorId)
            .eq('summary_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(results.created);

          if (newContent && newContent.length > 0) {
            // Import queue function
            const { queueContentForSummaries } = await import(
              '@/lib/queue/queue-helpers'
            );
            const contentIds = newContent.map(
              (item: { id: string }) => item.id
            );
            await queueContentForSummaries(contentIds, creatorId);
            console.log(
              `[BrightData Processor] Queued ${contentIds.length} items for AI summaries`
            );
          }
        }

        return {
          success: true,
          snapshotId,
          itemsProcessed: contentItems.length,
          created: results.created,
          updated: results.updated,
          errors: results.errors.length,
        };
      } else {
        // No content found but snapshot was ready
        await supabase
          .from('brightdata_snapshots')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            posts_retrieved: 0,
          })
          .eq('snapshot_id', snapshotId);

        return {
          success: true,
          snapshotId,
          itemsProcessed: 0,
          created: 0,
          updated: 0,
          errors: 0,
        };
      }
    } else if (snapshotStatus.status === 'failed') {
      // Mark as failed
      await supabase
        .from('brightdata_snapshots')
        .update({
          status: 'failed',
          error: snapshotStatus.error || 'Snapshot failed',
          error_code: snapshotStatus.error_code,
        })
        .eq('snapshot_id', snapshotId);

      throw new Error(`Snapshot ${snapshotId} failed: ${snapshotStatus.error}`);
    } else {
      // Still running - requeue for later
      console.log(
        `[BrightData Processor] Snapshot ${snapshotId} still running, will retry later`
      );

      // Throw error to trigger retry with backoff
      throw new Error(
        `Snapshot ${snapshotId} not ready yet (status: ${snapshotStatus.status})`
      );
    }
  } catch (error) {
    console.error(
      `[BrightData Processor] Error processing snapshot ${snapshotId}:`,
      error
    );

    // Update error in database
    await supabase
      .from('brightdata_snapshots')
      .update({
        error: error instanceof Error ? error.message : 'Unknown error',
        last_checked_at: new Date().toISOString(),
      })
      .eq('snapshot_id', snapshotId);

    throw error;
  }
}

// Create the worker
export function createBrightDataProcessorWorker() {
  const worker = new Worker(
    QUEUE_NAMES.BRIGHTDATA_PROCESSING,
    processBrightDataSnapshot,
    {
      connection: getRedisConnection(),
      concurrency: 2, // Process 2 snapshots at a time
      limiter: {
        max: 5,
        duration: 60000, // Max 5 snapshots per minute
      },
      // Retry settings for snapshots that aren't ready yet
      defaultJobOptions: {
        attempts: 10, // Retry up to 10 times
        backoff: {
          type: 'exponential',
          delay: 30000, // Start with 30 second delay
        },
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(
      `[BrightData Processor] Snapshot ${job.data.snapshotId} processed successfully`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[BrightData Processor] Snapshot ${job?.data.snapshotId} processing failed:`,
      err
    );
  });

  return worker;
}
