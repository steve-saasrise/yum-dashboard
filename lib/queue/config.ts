import { ConnectionOptions } from 'bullmq';

// Queue names
export const QUEUE_NAMES = {
  CONTENT_FETCH: 'content-fetch',
  AI_SUMMARY: 'ai-summary',
  CREATOR_PROCESSING: 'creator-processing',
} as const;

// Job names
export const JOB_NAMES = {
  FETCH_CREATOR_CONTENT: 'fetch-creator-content',
  GENERATE_SUMMARIES: 'generate-summaries',
  PROCESS_SINGLE_CREATOR: 'process-single-creator',
} as const;

// Redis connection configuration for BullMQ
export function getRedisConnection(): ConnectionOptions {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Redis connection details not configured');
  }

  // Extract host and port from Upstash URL
  // Format: https://xxxxx.upstash.io:6379
  const urlParts = url.replace('https://', '').split(':');
  const host = urlParts[0];
  const port = parseInt(urlParts[1] || '6379');

  return {
    host,
    port,
    username: 'default',
    password: token,
    tls: {
      rejectUnauthorized: false,
    },
    maxRetriesPerRequest: 3,
  };
}

// Job options
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
    age: 24 * 3600, // Remove completed jobs older than 24 hours
  },
  removeOnFail: {
    count: 500, // Keep last 500 failed jobs for debugging
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 second delay
  },
};

// Worker concurrency settings
export const WORKER_CONCURRENCY = {
  CONTENT_FETCH: 5, // Process 5 creators concurrently
  AI_SUMMARY: 3, // Generate 3 summaries concurrently
  CREATOR_PROCESSING: 10, // Process 10 individual creators
};
