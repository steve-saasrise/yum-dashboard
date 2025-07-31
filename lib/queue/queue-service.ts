import { Queue, Worker, Job } from 'bullmq';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  DEFAULT_JOB_OPTIONS,
  WORKER_CONCURRENCY,
} from './config';

// Singleton queue instances
let queues: Record<string, Queue> | null = null;

// Initialize queues
export function getQueues() {
  if (!queues) {
    const connection = getRedisConnection();

    queues = {
      [QUEUE_NAMES.CREATOR_PROCESSING]: new Queue(
        QUEUE_NAMES.CREATOR_PROCESSING,
        {
          connection,
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        }
      ),
      [QUEUE_NAMES.CONTENT_FETCH]: new Queue(QUEUE_NAMES.CONTENT_FETCH, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
      [QUEUE_NAMES.AI_SUMMARY]: new Queue(QUEUE_NAMES.AI_SUMMARY, {
        connection,
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    };
  }

  return queues;
}

// Add creators to processing queue
export async function queueCreatorsForProcessing(
  creators: Array<{ id: string; display_name: string }>
) {
  const queues = getQueues();
  const creatorQueue = queues[QUEUE_NAMES.CREATOR_PROCESSING];

  // Add each creator as a separate job
  const jobs = creators.map((creator) => ({
    name: JOB_NAMES.PROCESS_SINGLE_CREATOR,
    data: {
      creatorId: creator.id,
      creatorName: creator.display_name,
      timestamp: new Date().toISOString(),
    },
    opts: {
      priority: 1, // Default priority
      delay: 0, // Process immediately
    },
  }));

  // Add all jobs in bulk
  const results = await creatorQueue.addBulk(jobs);

  return {
    queued: results.length,
    jobs: results.map((job) => ({ id: job.id, name: job.name })),
  };
}

// Add content for AI summary generation
export async function queueContentForSummaries(
  contentIds: string[],
  creatorId?: string
) {
  const queues = getQueues();
  const summaryQueue = queues[QUEUE_NAMES.AI_SUMMARY];

  const job = await summaryQueue.add(
    JOB_NAMES.GENERATE_SUMMARIES,
    {
      contentIds,
      creatorId,
      timestamp: new Date().toISOString(),
    },
    {
      priority: creatorId ? 2 : 1, // Higher priority if for specific creator
    }
  );

  return {
    jobId: job.id,
    queued: contentIds.length,
  };
}

// Get queue statistics
export async function getQueueStats() {
  const queues = getQueues();
  const stats: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    stats[name] = {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active,
    };
  }

  return stats;
}

// Clean up old jobs
export async function cleanQueues(olderThan: number = 24 * 60 * 60 * 1000) {
  const queues = getQueues();

  for (const queue of Object.values(queues)) {
    await queue.clean(olderThan, 100, 'completed');
    await queue.clean(olderThan * 7, 100, 'failed'); // Keep failed jobs longer
  }
}
