import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '../lib/services/relevancy-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function processRelevancy24Hours() {
  console.log('🚀 Starting relevancy processing for past 24 hours...\n');

  // Create Supabase service client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get relevancy service
  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('❌ Relevancy service not configured (OpenAI API key missing)');
    process.exit(1);
  }

  // First, get count of unchecked content from past 24 hours
  const { data: stats } = await supabase.rpc('get_relevancy_stats_24h');
  
  if (stats && stats[0]) {
    console.log(`📊 Found ${stats[0].total_unchecked} unchecked items from past 24 hours`);
    console.log(`   - ${stats[0].unique_content} unique content pieces`);
    console.log(`   - Across ${stats[0].lounges_involved} lounges\n`);
  }

  // Process in batches of 20 to avoid timeouts
  const batchSize = 20;
  let totalProcessed = 0;
  let totalErrors = 0;
  let batchNumber = 1;

  // Keep processing until no more items
  while (true) {
    console.log(`\n📦 Processing batch ${batchNumber} (up to ${batchSize} items)...`);
    
    try {
      const results = await relevancyService.processRelevancyChecks(batchSize);
      
      if (results.processed === 0) {
        console.log('✅ No more items to process!');
        break;
      }

      totalProcessed += results.processed;
      totalErrors += results.errors;

      console.log(`   ✓ Processed: ${results.processed} items`);
      if (results.errors > 0) {
        console.log(`   ⚠️  Errors: ${results.errors} items`);
      }

      // Wait 2 seconds between batches to avoid rate limits
      console.log('   ⏳ Waiting 2 seconds before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      batchNumber++;
    } catch (error) {
      console.error(`❌ Error processing batch ${batchNumber}:`, error);
      totalErrors++;
      
      // Wait longer on error
      console.log('   ⏳ Waiting 5 seconds before retrying...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Safety limit to prevent infinite loops
    if (batchNumber > 20) {
      console.log('⚠️  Reached maximum batch limit (20 batches)');
      break;
    }
  }

  // Final summary
  console.log('\n' + '='.repeat(50));
  console.log('📈 PROCESSING COMPLETE');
  console.log('='.repeat(50));
  console.log(`✅ Total items processed: ${totalProcessed}`);
  if (totalErrors > 0) {
    console.log(`⚠️  Total errors: ${totalErrors}`);
  }

  // Check auto-deletion results
  const { data: deletedContent } = await supabase
    .from('deleted_content')
    .select('platform_content_id, title, url')
    .eq('deletion_reason', 'low_relevancy')
    .gte('deleted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('deleted_at', { ascending: false });

  if (deletedContent && deletedContent.length > 0) {
    console.log(`\n🗑️  Auto-deleted ${deletedContent.length} low-relevancy items:`);
    deletedContent.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title?.substring(0, 60)}...`);
    });
    if (deletedContent.length > 5) {
      console.log(`   ... and ${deletedContent.length - 5} more`);
    }
  } else {
    console.log('\n✨ No content was auto-deleted (all content passed relevancy thresholds)');
  }

  process.exit(0);
}

// Create the RPC function if it doesn't exist
async function createStatsFunction() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const functionSql = `
    CREATE OR REPLACE FUNCTION get_relevancy_stats_24h()
    RETURNS TABLE(
      total_unchecked bigint,
      unique_content bigint,
      lounges_involved bigint
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        COUNT(*) as total_unchecked,
        COUNT(DISTINCT c.id) as unique_content,
        COUNT(DISTINCT cl.lounge_id) as lounges_involved
      FROM content c
      INNER JOIN creators cr ON c.creator_id = cr.id
      INNER JOIN creator_lounges cl ON cr.id = cl.creator_id
      INNER JOIN lounges l ON cl.lounge_id = l.id
      WHERE c.relevancy_checked_at IS NULL
        AND c.created_at >= NOW() - INTERVAL '24 hours'
        AND l.theme_description IS NOT NULL;
    END;
    $$;
  `;

  try {
    const { error } = await supabase.rpc('exec_sql', { sql: functionSql });
    if (error && !error.message.includes('already exists')) {
      console.error('Error creating stats function:', error);
    }
  } catch (error) {
    // Function might already exist, continue
  }
}

// Run the process
createStatsFunction().then(() => {
  processRelevancy24Hours().catch(console.error);
});