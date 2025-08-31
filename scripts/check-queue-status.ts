import * as dotenv from 'dotenv';
import path from 'path';
import { Queue } from 'bullmq';
import { getRedisConnection, QUEUE_NAMES } from '../lib/queue/config';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function checkQueueStatus() {
  console.log('Checking Queue Status...\n');

  const queues = {
    'creator-processing': new Queue(QUEUE_NAMES.CREATOR_PROCESSING, {
      connection: getRedisConnection(),
    }),
    'brightdata-processing': new Queue(QUEUE_NAMES.BRIGHTDATA_PROCESSING, {
      connection: getRedisConnection(),
    }),
    'content-fetch': new Queue(QUEUE_NAMES.CONTENT_FETCH, {
      connection: getRedisConnection(),
    }),
    'ai-summary': new Queue(QUEUE_NAMES.AI_SUMMARY, {
      connection: getRedisConnection(),
    }),
  };

  for (const [name, queue] of Object.entries(queues)) {
    try {
      const counts = await queue.getJobCounts();
      const activeJobs = await queue.getActive();
      const waitingJobs = await queue.getWaiting(0, 5); // Get first 5 waiting

      console.log(`📊 ${name.toUpperCase()}`);
      console.log(`   Waiting: ${counts.waiting}`);
      console.log(`   Active: ${counts.active}`);
      console.log(`   Completed: ${counts.completed}`);
      console.log(`   Failed: ${counts.failed}`);
      console.log(`   Delayed: ${counts.delayed}`);

      if (name === 'creator-processing' && activeJobs.length > 0) {
        console.log(`   ⚠️  Active creators being processed:`);
        activeJobs.forEach((job) => {
          console.log(`      - ${job.data.creatorName || job.data.creatorId}`);
        });
      }

      if (
        name === 'brightdata-processing' &&
        (counts.waiting > 0 || counts.active > 0)
      ) {
        console.log(
          `   🚨 BRIGHTDATA JOBS IN QUEUE - These will trigger API calls!`
        );
        if (activeJobs.length > 0) {
          console.log(`   Active snapshots:`);
          activeJobs.forEach((job) => {
            console.log(`      - Snapshot: ${job.data.snapshotId}`);
          });
        }
        if (waitingJobs.length > 0) {
          console.log(`   Waiting snapshots (first 5):`);
          waitingJobs.forEach((job) => {
            console.log(`      - Snapshot: ${job.data.snapshotId}`);
          });
        }
      }

      console.log('');
    } catch (error) {
      console.error(`   Error checking ${name}:`, error);
    }
  }

  // Close connections
  for (const queue of Object.values(queues)) {
    await queue.close();
  }

  process.exit(0);
}

checkQueueStatus().catch(console.error);
