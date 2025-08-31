/**
 * Mark all pending BrightData snapshots as failed
 * This prevents them from being queued for processing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function markAllPendingAsFailed() {
  console.log('🛑 Marking all pending snapshots as failed...\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get count of pending snapshots
    const { count: pendingCount } = await supabase
      .from('brightdata_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    console.log(`Found ${pendingCount} pending snapshots`);

    if (pendingCount === 0) {
      console.log('No pending snapshots to update');
      return;
    }

    // Mark ALL pending snapshots as failed
    const { error: updateError, count: updatedCount } = await supabase
      .from('brightdata_snapshots')
      .update({
        status: 'failed',
        error:
          'BrightData account suspended - marked as failed to prevent processing',
        error_code: '105',
        processed_at: new Date().toISOString(),
      })
      .eq('status', 'pending')
      .select();

    if (updateError) {
      console.error('❌ Error updating snapshots:', updateError);
    } else {
      console.log(
        `✅ Successfully marked ${updatedCount || pendingCount} snapshots as failed`
      );
    }

    // Verify the update
    const { count: stillPending } = await supabase
      .from('brightdata_snapshots')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    console.log(`\nRemaining pending snapshots: ${stillPending}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

markAllPendingAsFailed();
