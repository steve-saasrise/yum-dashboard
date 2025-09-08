#!/usr/bin/env npx tsx
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../lib/queue/config';

async function clearAINewsQueue() {
  console.log('Clearing AI News Generation queue...');

  const connection = getRedisConnection();
  const queue = new Queue(QUEUE_NAMES.AI_NEWS_GENERATION, { connection });

  try {
    // Get all job states
    const waiting = await queue.getWaitingCount();
    const active = await queue.getActiveCount();
    const delayed = await queue.getDelayedCount();
    const failed = await queue.getFailedCount();
    const completed = await queue.getCompletedCount();

    console.log('Current queue status:');
    console.log(`  Waiting: ${waiting}`);
    console.log(`  Active: ${active}`);
    console.log(`  Delayed: ${delayed}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Completed: ${completed}`);

    // Clean all jobs
    console.log('\nCleaning all jobs...');
    await queue.obliterate({ force: true });

    console.log('✓ Queue cleared successfully');

    // Verify queue is empty
    const newWaiting = await queue.getWaitingCount();
    const newDelayed = await queue.getDelayedCount();
    console.log(
      `\nVerification - Waiting: ${newWaiting}, Delayed: ${newDelayed}`
    );
  } catch (error) {
    console.error('Error clearing queue:', error);
  } finally {
    await queue.close();
  }
}

clearAINewsQueue().catch(console.error);
