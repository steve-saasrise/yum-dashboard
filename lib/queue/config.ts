import { ConnectionOptions } from 'bullmq';

// Queue names
export const QUEUE_NAMES = {
  CONTENT_FETCH: 'content-fetch',
  AI_SUMMARY: 'ai-summary',
  CREATOR_PROCESSING: 'creator-processing',
  BRIGHTDATA_PROCESSING: 'brightdata-processing',
  AI_NEWS_GENERATION: 'ai-news-generation',
  EMAIL_DIGEST: 'email-digest',
} as const;

// Job names
export const JOB_NAMES = {
  FETCH_CREATOR_CONTENT: 'fetch-creator-content',
  GENERATE_SUMMARIES: 'generate-summaries',
  PROCESS_SINGLE_CREATOR: 'process-single-creator',
  GENERATE_AI_NEWS: 'generate-ai-news',
  SEND_USER_DIGEST: 'send-user-digest',
} as const;

// Redis connection configuration for BullMQ with optimizations
export function getRedisConnection(): ConnectionOptions {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error('Redis connection details not configured');
  }

  // Extract host from Upstash URL (remove https:// prefix)
  // REST URL format: https://xxxxx.upstash.io
  // Redis endpoint: xxxxx.upstash.io:6379
  const host = url.replace('https://', '').replace(/:\d+$/, ''); // Remove https:// and any port
  const port = 6379; // Upstash Redis always uses port 6379

  const baseConfig: ConnectionOptions = {
    host,
    port,
    username: 'default',
    password: token,
    tls: {
      rejectUnauthorized: false,
    },
    maxRetriesPerRequest: null as any, // BullMQ requires this to be null
  };

  console.log(`Connecting to Redis at ${host}:${port} with TLS`);

  // Return the connection options directly - BullMQ handles connection pooling internally
  return baseConfig;
}

// Job options - Extended timeouts for slow external APIs (BrightData)
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 50, // Keep last 50 completed jobs for debugging
    age: 3600, // Remove completed jobs older than 1 hour
  },
  removeOnFail: {
    count: 100, // Keep last 100 failed jobs for debugging
    age: 86400, // Remove failed jobs older than 24 hours
  },
  attempts: 1, // DISABLED RETRIES - fail immediately to prevent infinite loops
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // Increased backoff delay for API rate limits
  },
  // Extended lock duration to handle slow BrightData API (135+ seconds)
  lockDuration: 300000, // 5 minutes (was default 30 seconds)
  stalledInterval: 300000, // 5 minutes check interval
};

// Specific job options for AI news generation with rate limit handling
export const AI_NEWS_JOB_OPTIONS = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 5, // Allow up to 5 retries for rate limit errors
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Start with 2 second delay
  },
  // Add rate limiting to prevent overwhelming the API
  limiter: {
    max: 100, // Maximum 100 jobs
    duration: 60000, // per 60 seconds
  },
};

// Worker concurrency settings - Reduced to prevent lock contention
export const WORKER_CONCURRENCY = {
  CONTENT_FETCH: 2, // Process 2 creators concurrently (reduced from 5)
  AI_SUMMARY: 3, // Generate 3 summaries concurrently
  CREATOR_PROCESSING: 3, // Process 3 individual creators (reduced from 10 to prevent lock issues)
  BRIGHTDATA_PROCESSING: 2, // Process 2 BrightData snapshots concurrently
  AI_NEWS_GENERATION: 3, // Process 3 news generation jobs concurrently
  EMAIL_DIGEST: 10, // Process 10 user digests concurrently (emails are fast)
};
