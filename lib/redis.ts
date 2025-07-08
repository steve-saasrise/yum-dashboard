import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Only create client if environment variables are available
export const redis =
  redisUrl && redisToken
    ? new Redis({ url: redisUrl, token: redisToken })
    : null;

// Helper function to test Redis connection
export async function testRedisConnection() {
  if (!redis) {
    return {
      success: false,
      message: 'Redis client not configured - missing environment variables',
    };
  }

  try {
    await redis.ping();
    return { success: true, message: 'Redis connection successful' };
  } catch (error) {
    return {
      success: false,
      message: `Redis connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
