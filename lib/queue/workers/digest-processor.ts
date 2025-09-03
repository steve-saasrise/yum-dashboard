import { Worker, Job } from 'bullmq';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  WORKER_CONCURRENCY,
} from '../config';
import { DigestService } from '@/lib/services/digest-service';

// Ensure environment variables are loaded
import { config } from 'dotenv';
config({ path: '.env.local' });

// Process a single user's digest email
async function processUserDigest(job: Job) {
  const { userEmail, userId, timestamp, dateStr } = job.data;
  
  console.log(`Processing digest for user: ${userEmail} (${userId})`);
  
  try {
    // Send digests for all subscribed lounges for this user
    await DigestService.sendDailyDigests(userEmail);
    
    console.log(`Successfully sent digest to ${userEmail}`);
    
    // Return success info
    return {
      success: true,
      userEmail,
      userId,
      sentAt: new Date().toISOString(),
      dateStr,
    };
  } catch (error) {
    console.error(`Failed to send digest to ${userEmail}:`, error);
    
    // Throw error to mark job as failed (can be retried if configured)
    throw new Error(`Digest failed for ${userEmail}: ${error}`);
  }
}

// Create the worker
export function createDigestWorker() {
  const worker = new Worker(
    QUEUE_NAMES.EMAIL_DIGEST,
    async (job: Job) => {
      // Route to appropriate processor based on job name
      switch (job.name) {
        case JOB_NAMES.SEND_USER_DIGEST:
          return await processUserDigest(job);
        default:
          throw new Error(`Unknown job type: ${job.name}`);
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY.EMAIL_DIGEST,
      // Override lock duration for email jobs (they should be fast)
      lockDuration: 60000, // 1 minute should be enough for email sending
      stalledInterval: 60000,
    }
  );

  // Event listeners for monitoring
  worker.on('completed', (job) => {
    console.log(
      `Digest job ${job.id} completed for ${job.data.userEmail}`
    );
  });

  worker.on('failed', (job, error) => {
    console.error(
      `Digest job ${job?.id} failed for ${job?.data.userEmail}:`,
      error
    );
  });

  worker.on('stalled', (jobId) => {
    console.warn(`Digest job ${jobId} stalled`);
  });

  return worker;
}

// Start the worker if this file is run directly
if (require.main === module) {
  console.log('Starting Email Digest Worker...');
  const worker = createDigestWorker();
  
  // Handle shutdown gracefully
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing worker...');
    await worker.close();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('SIGINT received, closing worker...');
    await worker.close();
    process.exit(0);
  });
  
  console.log(`Email Digest Worker started with concurrency: ${WORKER_CONCURRENCY.EMAIL_DIGEST}`);
}