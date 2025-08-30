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
      console.log(
        `[Queue Cleanup] ${queueName} - Before: failed=${beforeCounts.failed}, completed=${beforeCounts.completed}`
      );

      // Use BullMQ's built-in clean method
      // Clean ALL failed jobs (grace period of 0 means immediate)
      const failedCleaned = await queue.clean(
        0, // grace period: 0 milliseconds (clean all failed jobs)
        5000, // limit: max 5000 jobs per clean
        'failed'
      );

      // Clean completed jobs older than 1 hour
      const completedCleaned = await queue.clean(
        60 * 60 * 1000, // grace period: 1 hour
        1000, // limit: max 1000 jobs per clean
        'completed'
      );

      // Clean ALL waiting jobs (these are stuck retries)
      const waitingCleaned = await queue.clean(
        0, // grace period: 0 milliseconds (clean all waiting jobs)
        5000,
        'wait'
      );

      // Clean ALL delayed jobs (these are scheduled retries)
      const delayedCleaned = await queue.clean(
        0, // grace period: 0 milliseconds (clean all delayed jobs)
        5000,
        'delayed'
      );

      // Get final counts
      const afterCounts = await queue.getJobCounts();
      console.log(
        `[Queue Cleanup] ${queueName} - After: failed=${afterCounts.failed}, completed=${afterCounts.completed}`
      );

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
      console.error(
        `[Queue Cleanup] Error cleaning queue ${queueName}:`,
        error
      );
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
