import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}
import { createCreatorProcessorWorker } from '@/lib/queue/workers/creator-processor';
import { createSummaryProcessorWorker } from '@/lib/queue/workers/summary-processor';

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

console.log('Workers started successfully!');
console.log(
  '- Creator processor worker: Processing up to 10 creators concurrently'
);
console.log('- Summary processor worker: Generating summaries for new content');

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing workers...');
  await creatorWorker.close();
  await summaryWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing workers...');
  await creatorWorker.close();
  await summaryWorker.close();
  process.exit(0);
});
