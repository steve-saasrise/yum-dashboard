#!/usr/bin/env node

/**
 * Start the Email Digest Worker
 * This worker processes queued email digest jobs from BullMQ
 * 
 * Usage:
 *   npm run worker:digest
 *   or
 *   npx tsx scripts/start-digest-worker.ts
 * 
 * Deploy on Railway:
 *   Create a new service with this as the start command
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createDigestWorker } from '../lib/queue/workers/digest-processor';

console.log('===========================================');
console.log('🚀 Starting Email Digest Worker');
console.log('===========================================');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Redis URL: ${process.env.UPSTASH_REDIS_REST_URL ? 'Configured ✓' : 'Missing ✗'}`);
console.log(`Supabase URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured ✓' : 'Missing ✗'}`);
console.log(`Resend API: ${process.env.RESEND_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
console.log(`OpenAI API: ${process.env.OPENAI_API_KEY ? 'Configured ✓' : 'Missing ✗'}`);
console.log('===========================================\n');

// Check required environment variables
const requiredEnvVars = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_KEY',
  'RESEND_API_KEY',
  'OPENAI_API_KEY', // For AI image generation
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease ensure all required environment variables are set.');
  process.exit(1);
}

// Start the worker
const worker = createDigestWorker();

// Log worker status
worker.on('ready', () => {
  console.log('✅ Digest Worker is ready and waiting for jobs...');
});

worker.on('error', (error) => {
  console.error('❌ Worker error:', error);
});

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('\n📋 SIGTERM received, gracefully shutting down...');
  await worker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n📋 SIGINT received, gracefully shutting down...');
  await worker.close();
  process.exit(0);
});

// Log periodic stats (workers don't have getJobCounts, need to use queue)
// Commenting out for now - would need to import queue to get stats
// setInterval(async () => {
//   console.log(`📊 Worker is running...`);
// }, 60000); // Every minute

console.log('👷 Email Digest Worker is running...');
console.log('Press Ctrl+C to stop\n');