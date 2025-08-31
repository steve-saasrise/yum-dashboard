/**
 * Emergency script to stop all BrightData job retries
 * This will:
 * 1. Remove ALL jobs from the BrightData queue
 * 2. Mark all pending/processing snapshots as failed in the database
 */

const { Queue } = require('bullmq');
const { createClient } = require('@supabase/supabase-js');
const { getRedisConnection, QUEUE_NAMES } = require('../lib/queue/config');
require('dotenv').config({ path: '.env.local' });

async function stopAllBrightDataRetries() {
  console.log('🛑 Stopping all BrightData retries...\n');

  // Initialize queue
  const queue = new Queue(QUEUE_NAMES.BRIGHTDATA_PROCESSING, {
    connection: getRedisConnection(),
  });

  // Initialize Supabase
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Step 1: Get all job counts
    console.log('📊 Current queue status:');
    const counts = await queue.getJobCounts();
    console.log(counts);
    console.log('');

    // Step 2: Remove ALL jobs from the queue
    console.log('🗑️  Removing all jobs from queue...');

    // Remove all job types
    const jobTypes = [
      'completed',
      'failed',
      'delayed',
      'active',
      'wait',
      'paused',
    ];
    let totalRemoved = 0;

    for (const type of jobTypes) {
      const removed = await queue.clean(0, 10000, type as any);
      if (removed.length > 0) {
        console.log(`  - Removed ${removed.length} ${type} jobs`);
        totalRemoved += removed.length;
      }
    }

    // Also obliterate the queue (removes ALL jobs including active ones)
    await queue.obliterate({ force: true });
    console.log(`✅ Removed ${totalRemoved} jobs and obliterated queue\n`);

    // Step 3: Update database - mark all non-processed snapshots as failed
    console.log('📝 Updating database snapshots...');

    // Get count of affected snapshots
    const { count: pendingCount } = await supabase
      .from('brightdata_snapshots')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'processing', 'ready']);

    console.log(`  - Found ${pendingCount} snapshots to update`);

    // Mark all pending/processing snapshots as failed
    const { error: updateError } = await supabase
      .from('brightdata_snapshots')
      .update({
        status: 'failed',
        error: 'Stopped due to BrightData account suspension',
        processed_at: new Date().toISOString(),
      })
      .in('status', ['pending', 'processing', 'ready']);

    if (updateError) {
      console.error('❌ Error updating snapshots:', updateError);
    } else {
      console.log('✅ All pending snapshots marked as failed\n');
    }

    // Step 4: Verify queue is empty
    const finalCounts = await queue.getJobCounts();
    console.log('📊 Final queue status:');
    console.log(finalCounts);

    if (Object.values(finalCounts).every((v) => v === 0)) {
      console.log('\n✅ SUCCESS: All BrightData retries have been stopped!');
      console.log('📌 Next steps:');
      console.log('  1. Fix your BrightData account issue');
      console.log('  2. Run recovery script when account is active');
    } else {
      console.log('\n⚠️  WARNING: Some jobs may still be in the queue');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await queue.close();
    process.exit(0);
  }
}

// Run the script
stopAllBrightDataRetries();
