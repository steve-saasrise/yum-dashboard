import { ConnectionOptions } from 'bullmq';
import Redis from 'ioredis';

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

// Shared Redis connections
let sharedConnection: Redis | null = null;
let subscriberConnection: Redis | null = null;

// Redis connection configuration for BullMQ with professional optimizations
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

  const baseConfig = {
    host,
    port,
    username: 'default',
    password: token,
    tls: {
      rejectUnauthorized: false,
    },
    maxRetriesPerRequest: 3, // Standard retry count
    enableAutoPipelining: true, // Enable auto-pipelining for 35-50% performance boost
    enableOfflineQueue: false, // Fail fast if Redis is down
    connectTimeout: 10000, // 10 second connection timeout
    lazyConnect: true, // Don't connect until first command
  };

  // Return connection factory for BullMQ
  return {
    createClient: (type: 'client' | 'subscriber' | 'bclient') => {
      switch (type) {
        case 'client':
          if (!sharedConnection) {
            sharedConnection = new Redis(baseConfig);
          }
          return sharedConnection;
        case 'subscriber':
          if (!subscriberConnection) {
            subscriberConnection = new Redis(baseConfig);
          }
          return subscriberConnection;
        case 'bclient':
          // bclient must always be a new connection
          return new Redis(baseConfig);
        default:
          return new Redis(baseConfig);
      }
    },
  } as any;
}

// Job options - Balanced for performance and debugging
export const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: {
    count: 50, // Keep last 50 completed jobs for debugging
    age: 3600, // Remove completed jobs older than 1 hour
  },
  removeOnFail: {
    count: 100, // Keep last 100 failed jobs for debugging
    age: 86400, // Remove failed jobs older than 24 hours
  },
  attempts: 3, // Standard retry count
  backoff: {
    type: 'exponential' as const,
    delay: 2000, // Standard backoff delay
  },
};

// Worker concurrency settings
export const WORKER_CONCURRENCY = {
  CONTENT_FETCH: 5, // Process 5 creators concurrently
  AI_SUMMARY: 3, // Generate 3 summaries concurrently
  CREATOR_PROCESSING: 10, // Process 10 individual creators
};
