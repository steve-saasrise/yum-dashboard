import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '@/lib/queue/config';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';

export const maxDuration = 30; // seconds

export async function GET(request: NextRequest) {
  console.log('[Cron] Process BrightData snapshots endpoint called');

  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Cron] Invalid authorization');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Use service role client for cron jobs
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      console.error('[Cron] Supabase configuration missing');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
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

    // Get unprocessed snapshots
    const { data: snapshots, error } = await supabase
      .from('brightdata_snapshots')
      .select('*')
      .in('status', ['pending', 'ready'])
      .order('created_at', { ascending: true })
      .limit(20); // Process up to 20 snapshots per cron run

    if (error) {
      console.error('[Cron] Error fetching snapshots:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!snapshots || snapshots.length === 0) {
      console.log('[Cron] No pending snapshots to process');
      return NextResponse.json({
        message: 'No pending snapshots',
        processed: 0,
      });
    }

    console.log(`[Cron] Found ${snapshots.length} pending snapshots`);

    // Initialize BrightData fetcher to check snapshot metadata
    let brightDataFetcher: BrightDataFetcher | null = null;
    if (process.env.BRIGHTDATA_API_KEY) {
      brightDataFetcher = new BrightDataFetcher({
        apiKey: process.env.BRIGHTDATA_API_KEY,
      });
    } else {
      console.error('[Cron] BRIGHTDATA_API_KEY not configured');
      return NextResponse.json(
        { error: 'BrightData configuration missing' },
        { status: 500 }
      );
    }

    // Queue snapshots for processing
    const queue = new Queue(QUEUE_NAMES.BRIGHTDATA_PROCESSING, {
      connection: getRedisConnection(),
    });

    let emptySnapshots = 0;
    const queuedCount = await Promise.all(
      snapshots.map(async (snapshot) => {
        try {
          // Check if snapshot has content before queueing
          try {
            const metadata = await brightDataFetcher!.getSnapshotStatus(
              snapshot.snapshot_id
            );

            // Check if snapshot has no content (dataset_size of 0)
            if (metadata.result_count === 0) {
              console.log(
                `[Cron] Snapshot ${snapshot.snapshot_id} has no content (0 records), marking as processed`
              );

              // Mark as processed with 0 posts
              await supabase
                .from('brightdata_snapshots')
                .update({
                  status: 'processed',
                  posts_retrieved: 0,
                  processed_at: new Date().toISOString(),
                  metadata: {
                    ...snapshot.metadata,
                    result_count: 0,
                    skipped_reason: 'No content in snapshot',
                  },
                })
                .eq('snapshot_id', snapshot.snapshot_id);

              emptySnapshots++;
              return false; // Don't queue this snapshot
            }

            // Update metadata with result count if we have content
            if (metadata.result_count && metadata.result_count > 0) {
              await supabase
                .from('brightdata_snapshots')
                .update({
                  metadata: {
                    ...snapshot.metadata,
                    result_count: metadata.result_count,
                    cost: metadata.cost,
                    file_size: metadata.file_size,
                  },
                })
                .eq('snapshot_id', snapshot.snapshot_id);
            }
          } catch (metadataError) {
            console.error(
              `[Cron] Error checking metadata for snapshot ${snapshot.snapshot_id}:`,
              metadataError
            );
            // Continue to queue even if metadata check fails
            // The worker will handle it
          }

          // Check if already in queue
          const existingJobs = await queue.getJobs([
            'waiting',
            'active',
            'delayed',
          ]);
          const alreadyQueued = existingJobs.some(
            (job) => job.data.snapshotId === snapshot.snapshot_id
          );

          if (alreadyQueued) {
            console.log(
              `[Cron] Snapshot ${snapshot.snapshot_id} already in queue, skipping`
            );
            return false;
          }

          // Add to queue
          await queue.add(
            `process-snapshot-${snapshot.snapshot_id}`,
            {
              snapshotId: snapshot.snapshot_id,
              creatorUrls: snapshot.creator_urls,
              maxResults: snapshot.metadata?.max_results,
              metadata: snapshot.metadata,
            },
            {
              delay: 0, // Process immediately
              attempts: 10, // Retry up to 10 times for snapshots that aren't ready
              backoff: {
                type: 'exponential',
                delay: 30000, // Start with 30 second delay between retries
              },
            }
          );

          console.log(
            `[Cron] Queued snapshot ${snapshot.snapshot_id} for processing`
          );
          return true;
        } catch (error) {
          console.error(
            `[Cron] Error queueing snapshot ${snapshot.snapshot_id}:`,
            error
          );
          return false;
        }
      })
    );

    const successCount = queuedCount.filter(Boolean).length;

    await queue.close();

    return NextResponse.json({
      message: 'Snapshots queued for processing',
      found: snapshots.length,
      queued: successCount,
      skipped: snapshots.length - successCount,
      empty_snapshots: emptySnapshots,
    });
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    console.error(
      '[Cron] Error stack:',
      error instanceof Error ? error.stack : 'No stack trace'
    );

    // Return more detailed error in development
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorDetails =
      process.env.NODE_ENV === 'development'
        ? {
            error: errorMessage,
            stack: error instanceof Error ? error.stack : undefined,
          }
        : { error: 'Internal server error' };

    return NextResponse.json(errorDetails, { status: 500 });
  }
}
