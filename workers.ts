import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}
import { createCreatorProcessorWorker } from '@/lib/queue/workers/creator-processor';
import { createSummaryProcessorWorker } from '@/lib/queue/workers/summary-processor';
import { createBrightDataProcessorWorker } from '@/lib/queue/workers/brightdata-processor';

console.log('Starting queue workers...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Redis URL available:', !!process.env.UPSTASH_REDIS_REST_URL);
console.log('Redis token available:', !!process.env.UPSTASH_REDIS_REST_TOKEN);
console.log('Supabase key available:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('OpenAI key available:', !!process.env.OPENAI_API_KEY);

// Check Redis configuration
if (
  !process.env.UPSTASH_REDIS_REST_URL ||
  !process.env.UPSTASH_REDIS_REST_TOKEN
) {
  console.error('ERROR: Redis not configured!');
  console.error(
    'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'
  );
  process.exit(1);
}

// Check required API keys
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not configured!');
  process.exit(1);
}

// Start workers
const creatorWorker = createCreatorProcessorWorker();
const summaryWorker = createSummaryProcessorWorker();
const brightdataWorker = createBrightDataProcessorWorker();

console.log('Workers started successfully!');
console.log(
  '- Creator processor worker: Processing up to 3 creators concurrently (reduced for stability)'
);
console.log('- Summary processor worker: Generating summaries for new content');
console.log('- BrightData processor worker: Processing LinkedIn snapshots asynchronously');

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  // Exit with failure code to trigger Railway restart
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Exit with failure code to trigger Railway restart
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await creatorWorker.close();
  await summaryWorker.close();
  await brightdataWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await creatorWorker.close();
  await summaryWorker.close();
  await brightdataWorker.close();
  process.exit(0);
});
