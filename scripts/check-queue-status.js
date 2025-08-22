const { Queue } = require('bullmq');
const IORedis = require('ioredis');

// Create Redis connection
const connection = new IORedis(process.env.UPSTASH_REDIS_REST_URL, {
  maxRetriesPerRequest: null,
  retryStrategy: () => 5000,
  enableOfflineQueue: false,
  connectionName: 'queue-status-check',
  tls: {},
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function checkQueueStatus() {
  try {
    const queueNames = [
      'creator-processing',
      'content-fetch',
      'ai-summary'
    ];

    for (const queueName of queueNames) {
      const queue = new Queue(queueName, { connection });
      
      const waiting = await queue.getWaitingCount();
      const active = await queue.getActiveCount();
      const completed = await queue.getCompletedCount();
      const failed = await queue.getFailedCount();
      const delayed = await queue.getDelayedCount();
      
      console.log(`\nQueue: ${queueName}`);
      console.log(`  Waiting: ${waiting}`);
      console.log(`  Active: ${active}`);
      console.log(`  Completed: ${completed}`);
      console.log(`  Failed: ${failed}`);
      console.log(`  Delayed: ${delayed}`);
      
      // Get some failed jobs if any
      if (failed > 0) {
        const failedJobs = await queue.getFailed(0, 5);
        console.log(`  Recent failed jobs:`);
        for (const job of failedJobs) {
          console.log(`    - Job ${job.id}: ${job.failedReason}`);
        }
      }
      
      // Get active jobs
      if (active > 0) {
        const activeJobs = await queue.getActive(0, 5);
        console.log(`  Active jobs:`);
        for (const job of activeJobs) {
          console.log(`    - Job ${job.id}: ${job.data.creatorName || 'Unknown'}`);
        }
      }
    }
    
    await connection.quit();
  } catch (error) {
    console.error('Error checking queue status:', error);
    process.exit(1);
  }
}

checkQueueStatus();