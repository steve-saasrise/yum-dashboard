require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runBatchRelevancy() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Import the relevancy service
  const { getRelevancyService } = require('./lib/services/relevancy-service');

  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('Relevancy service not available (OpenAI key missing)');
    return;
  }

  console.log('Starting batch relevancy check with improved prompts...\n');
  console.log('='.repeat(80));

  // Process in batches
  const batchSize = 25;
  let totalProcessed = 0;
  let totalAutoDeleted = 0;

  for (let i = 0; i < 4; i++) {
    // Process 4 batches = 100 items total
    console.log(`\nProcessing batch ${i + 1}/4...`);

    const results = await relevancyService.processRelevancyChecks(batchSize);
    totalProcessed += results.processed;

    console.log(`✓ Processed ${results.processed} items`);

    // Check how many were auto-deleted
    const { count } = await supabase
      .from('deleted_content')
      .select('*', { count: 'exact', head: true })
      .eq('deletion_reason', 'low_relevancy');

    const newAutoDeleted = count - totalAutoDeleted;
    totalAutoDeleted = count;

    if (newAutoDeleted > 0) {
      console.log(`  ↳ Auto-deleted ${newAutoDeleted} low-relevancy items`);
    }

    // Small delay between batches
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('BATCH PROCESSING COMPLETE:');
  console.log(`✅ Total items processed: ${totalProcessed}`);
  console.log(`🗑️  Total auto-deleted: ${totalAutoDeleted}`);

  // Show some examples of what was deleted
  const { data: deletedExamples } = await supabase
    .from('deleted_content')
    .select('title, url')
    .eq('deletion_reason', 'low_relevancy')
    .order('deleted_at', { ascending: false })
    .limit(5);

  if (deletedExamples && deletedExamples.length > 0) {
    console.log('\nRecent auto-deletions:');
    deletedExamples.forEach((item) => {
      console.log(`  - ${item.title}`);
    });
  }

  // Show distribution of scores
  const { data: scoreDistribution } = await supabase
    .from('content')
    .select('relevancy_score')
    .not('relevancy_score', 'is', null)
    .order('relevancy_score', { ascending: false });

  if (scoreDistribution) {
    const buckets = {
      '90-100': 0,
      '70-89': 0,
      '50-69': 0,
      '30-49': 0,
      '0-29': 0,
    };

    scoreDistribution.forEach((item) => {
      const score = parseFloat(item.relevancy_score);
      if (score >= 90) buckets['90-100']++;
      else if (score >= 70) buckets['70-89']++;
      else if (score >= 50) buckets['50-69']++;
      else if (score >= 30) buckets['30-49']++;
      else buckets['0-29']++;
    });

    console.log('\nScore distribution:');
    Object.entries(buckets).forEach(([range, count]) => {
      const percentage = ((count / scoreDistribution.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(percentage / 2));
      console.log(`  ${range}: ${bar} ${count} items (${percentage}%)`);
    });
  }
}

runBatchRelevancy()
  .then(() => {
    console.log('\n✅ Batch processing complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
