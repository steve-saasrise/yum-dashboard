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
      [QUEUE_NAMES.AI_NEWS_GENERATION]: new Queue(
        QUEUE_NAMES.AI_NEWS_GENERATION,
        {
          connection,
          defaultJobOptions: DEFAULT_JOB_OPTIONS,
        }
      ),
    };
  }

  return queues;
}

// Add creators to processing queue with deduplication
export async function queueCreatorsForProcessing(
  creators: Array<{ id: string; display_name: string }>,
  options?: { skipLinkedIn?: boolean }
) {
  const queues = getQueues();
  const creatorQueue = queues[QUEUE_NAMES.CREATOR_PROCESSING];

  // Check for existing jobs and only add new ones
  const jobsToAdd = [];
  let skipped = 0;

  for (const creator of creators) {
    // Use creator ID as job ID for deduplication
    const jobId = `creator-${creator.id}`;
    const existingJob = await creatorQueue.getJob(jobId);

    // Only add if no existing job or previous job is completed/failed
    if (!existingJob) {
      jobsToAdd.push({
        name: JOB_NAMES.PROCESS_SINGLE_CREATOR,
        data: {
          creatorId: creator.id,
          creatorName: creator.display_name,
          timestamp: new Date().toISOString(),
          skipLinkedIn: options?.skipLinkedIn || false,
        },
        opts: {
          jobId, // Set job ID for deduplication
          priority: 1, // Default priority
          delay: 0, // Process immediately
        },
      });
    } else {
      const state = await existingJob.getState();
      if (state === 'completed' || state === 'failed') {
        // Remove old job and add new one
        await existingJob.remove();
        jobsToAdd.push({
          name: JOB_NAMES.PROCESS_SINGLE_CREATOR,
          data: {
            creatorId: creator.id,
            creatorName: creator.display_name,
            timestamp: new Date().toISOString(),
            skipLinkedIn: options?.skipLinkedIn || false,
          },
          opts: {
            jobId, // Set job ID for deduplication
            priority: 1, // Default priority
            delay: 0, // Process immediately
          },
        });
      } else {
        skipped++;
      }
    }
  }

  // Add all jobs in bulk
  const results =
    jobsToAdd.length > 0 ? await creatorQueue.addBulk(jobsToAdd) : [];

  return {
    queued: results.length,
    skipped,
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

// Add AI news generation jobs for lounges
export async function queueAINewsGeneration(
  lounges: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>,
  includeGeneral: boolean = true
) {
  const queues = getQueues();
  const newsQueue = queues[QUEUE_NAMES.AI_NEWS_GENERATION];

  const jobsToAdd = [];
  let skipped = 0;

  // Queue jobs for each lounge
  for (const lounge of lounges) {
    const jobId = `news-lounge-${lounge.id}-${new Date().toISOString().split('T')[0]}`;
    const existingJob = await newsQueue.getJob(jobId);

    // Only add if no existing job or previous job is completed/failed
    if (!existingJob) {
      jobsToAdd.push({
        name: JOB_NAMES.GENERATE_AI_NEWS,
        data: {
          loungeId: lounge.id,
          loungeName: lounge.name,
          loungeDescription: lounge.description || undefined,
          isGeneral: false,
          timestamp: new Date().toISOString(),
        },
        opts: {
          jobId,
          priority: 1,
          delay: 0,
        },
      });
    } else {
      const state = await existingJob.getState();
      if (state === 'completed' || state === 'failed') {
        await existingJob.remove();
        jobsToAdd.push({
          name: JOB_NAMES.GENERATE_AI_NEWS,
          data: {
            loungeId: lounge.id,
            loungeName: lounge.name,
            loungeDescription: lounge.description || undefined,
            isGeneral: false,
            timestamp: new Date().toISOString(),
          },
          opts: {
            jobId,
            priority: 1,
            delay: 0,
          },
        });
      } else {
        skipped++;
      }
    }
  }

  // Add general news job if requested
  if (includeGeneral) {
    const generalJobId = `news-general-${new Date().toISOString().split('T')[0]}`;
    const existingGeneralJob = await newsQueue.getJob(generalJobId);

    if (!existingGeneralJob) {
      jobsToAdd.push({
        name: JOB_NAMES.GENERATE_AI_NEWS,
        data: {
          loungeId: 'general',
          loungeName: 'Technology and Business',
          isGeneral: true,
          timestamp: new Date().toISOString(),
        },
        opts: {
          jobId: generalJobId,
          priority: 1,
          delay: 0,
        },
      });
    } else {
      const state = await existingGeneralJob.getState();
      if (state === 'completed' || state === 'failed') {
        await existingGeneralJob.remove();
        jobsToAdd.push({
          name: JOB_NAMES.GENERATE_AI_NEWS,
          data: {
            loungeId: 'general',
            loungeName: 'Technology and Business',
            isGeneral: true,
            timestamp: new Date().toISOString(),
          },
          opts: {
            jobId: generalJobId,
            priority: 1,
            delay: 0,
          },
        });
      } else {
        skipped++;
      }
    }
  }

  // Add all jobs in bulk
  const results =
    jobsToAdd.length > 0 ? await newsQueue.addBulk(jobsToAdd) : [];

  return {
    queued: results.length,
    skipped,
    jobs: results.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
    })),
  };
}

// Cached queue stats to reduce Redis operations
let statsCache: { data: any; timestamp: number } | null = null;
const STATS_CACHE_TTL = 60000; // Cache for 1 minute

// Get queue statistics with caching
export async function getQueueStats(useCache = true) {
  // Return cached stats if fresh
  if (
    useCache &&
    statsCache &&
    Date.now() - statsCache.timestamp < STATS_CACHE_TTL
  ) {
    return statsCache.data;
  }

  const queues = getQueues();
  const stats: Record<string, any> = {};

  for (const [name, queue] of Object.entries(queues)) {
    try {
      // Use getJobCounts which is more efficient (single Redis call)
      const counts = await queue.getJobCounts();

      stats[name] = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        delayed: counts.delayed || 0,
        total: (counts.waiting || 0) + (counts.active || 0),
      };
    } catch (error) {
      console.error(`Failed to get stats for queue ${name}:`, error);
      stats[name] = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        total: 0,
        error: true,
      };
    }
  }

  // Cache the stats
  statsCache = { data: stats, timestamp: Date.now() };

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

// Professional cleanup - balanced for performance and debugging
export async function professionalCleanup() {
  const queues = getQueues();

  console.log('[Queue Cleanup] Starting cleanup...');

  for (const [name, queue] of Object.entries(queues)) {
    try {
      // Clean in batches to avoid memory issues
      // Remove completed jobs older than 1 hour
      await queue.clean(3600000, 100, 'completed');

      // Remove failed jobs older than 24 hours
      await queue.clean(86400000, 100, 'failed');

      console.log(`[Queue Cleanup] ${name}: Cleaned old jobs`);
    } catch (error) {
      console.error(`[Queue Cleanup] Error cleaning queue ${name}:`, error);
    }
  }

  console.log('[Queue Cleanup] Cleanup completed');
}

// Keep aggressive cleanup as an option for emergencies
export const aggressiveCleanup = professionalCleanup;
