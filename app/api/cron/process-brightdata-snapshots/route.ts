import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '@/lib/queue/config';

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
    const supabase = createClient();

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

    // Queue snapshots for processing
    const queue = new Queue(QUEUE_NAMES.BRIGHTDATA_PROCESSING, {
      connection: getRedisConnection(),
    });

    const queuedCount = await Promise.all(
      snapshots.map(async (snapshot) => {
        try {
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
    });
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
