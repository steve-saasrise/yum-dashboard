/**
 * Emergency script to stop all BrightData job retries
 */

const { Queue } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const Redis = require('ioredis');
require('dotenv').config({ path: '.env.local' });

const QUEUE_NAME = 'brightdata-processing';

async function stopAllBrightDataRetries() {
  console.log('🛑 Stopping all BrightData retries...\n');

  // Initialize Redis connection
  const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
  });

  // Initialize queue
  const queue = new Queue(QUEUE_NAME, { connection });

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Step 1: Get all job counts
    console.log('📊 Current queue status:');
    const counts = await queue.getJobCounts();
    console.log(counts);
    console.log('');

    // Step 2: Obliterate the queue (removes ALL jobs)
    console.log('🗑️  Obliterating all jobs from queue...');
    await queue.obliterate({ force: true });
    console.log('✅ Queue obliterated\n');

    // Step 3: Update database - mark all non-processed snapshots as failed
    console.log('📝 Updating database snapshots...');
    
    // Get count of affected snapshots from Aug 28
    const { count: pendingCount } = await supabase
      .from('brightdata_snapshots')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'ready', 'failed'])
      .lte('created_at', '2025-08-29 00:00:00');

    console.log(`  - Found ${pendingCount} old snapshots to update`);

    // Mark all old snapshots as permanently failed
    const { error: updateError } = await supabase
      .from('brightdata_snapshots')
      .update({
        status: 'failed',
        error: 'Stopped due to BrightData account suspension - will not retry',
        processed_at: new Date().toISOString(),
      })
      .lte('created_at', '2025-08-29 00:00:00')
      .in('status', ['pending', 'processing', 'ready', 'failed']);

    if (updateError) {
      console.error('❌ Error updating snapshots:', updateError);
    } else {
      console.log('✅ All old snapshots marked as permanently failed\n');
    }

    // Step 4: Verify queue is empty
    const finalCounts = await queue.getJobCounts();
    console.log('📊 Final queue status:');
    console.log(finalCounts);

    if (Object.values(finalCounts).every(v => v === 0)) {
      console.log('\n✅ SUCCESS: All BrightData retries have been stopped!');
      console.log('📌 Next steps:');
      console.log('  1. Fix your BrightData account issue');
      console.log('  2. New snapshots from Aug 30 will be processed when cron runs');
    } else {
      console.log('\n⚠️  WARNING: Some jobs may still be in the queue');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await queue.close();
    await connection.quit();
    process.exit(0);
  }
}

// Run the script
stopAllBrightDataRetries();