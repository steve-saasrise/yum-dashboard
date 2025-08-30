import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '@/lib/queue/config';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  console.log('[Queue Cleanup] Starting cleanup process');
  
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('[Queue Cleanup] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const queues = [
    QUEUE_NAMES.BRIGHTDATA_PROCESSING,
    QUEUE_NAMES.CONTENT_FETCH,
    QUEUE_NAMES.AI_SUMMARY,
    QUEUE_NAMES.CREATOR_PROCESSING,
    QUEUE_NAMES.AI_NEWS_GENERATION,
  ];

  for (const queueName of queues) {
    console.log(`[Queue Cleanup] Processing queue: ${queueName}`);
    try {
      const queue = new Queue(queueName, {
        connection: getRedisConnection(),
      });

      // Get initial counts
      const beforeCounts = await queue.getJobCounts();
      console.log(`[Queue Cleanup] ${queueName} - Before: failed=${beforeCounts.failed}, completed=${beforeCounts.completed}`);

      // Use BullMQ's built-in clean method
      // Clean failed jobs older than 24 hours (in milliseconds)
      const failedCleaned = await queue.clean(
        24 * 60 * 60 * 1000, // grace period: 24 hours
        500, // limit: max 500 jobs per clean
        'failed'
      );

      // Clean completed jobs older than 1 hour
      const completedCleaned = await queue.clean(
        60 * 60 * 1000, // grace period: 1 hour
        1000, // limit: max 1000 jobs per clean
        'completed'
      );

      // Also clean waiting jobs that are stuck (older than 24 hours)
      const waitingCleaned = await queue.clean(
        24 * 60 * 60 * 1000,
        100,
        'wait'
      );

      // Clean delayed jobs that are stuck (older than 24 hours)
      const delayedCleaned = await queue.clean(
        24 * 60 * 60 * 1000,
        100,
        'delayed'
      );

      // Get final counts
      const afterCounts = await queue.getJobCounts();
      console.log(`[Queue Cleanup] ${queueName} - After: failed=${afterCounts.failed}, completed=${afterCounts.completed}`);

      results[queueName] = {
        cleaned: {
          failed: failedCleaned.length,
          completed: completedCleaned.length,
          waiting: waitingCleaned.length,
          delayed: delayedCleaned.length,
        },
        beforeCounts,
        afterCounts,
      };

      await queue.close();
    } catch (error) {
      console.error(`[Queue Cleanup] Error cleaning queue ${queueName}:`, error);
      results[queueName] = { error: String(error) };
    }
  }

  console.log('[Queue Cleanup] Cleanup completed', results);
  
  return NextResponse.json({
    message: 'Queue cleanup completed',
    results,
    timestamp: new Date().toISOString(),
  });
}