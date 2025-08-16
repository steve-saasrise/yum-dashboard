require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { RelevancyService } = require('./lib/services/relevancy-service.ts');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runTodaysRelevancy() {
  console.log(
    "Running relevancy checks on today's content across all lounges...\n"
  );
  console.log('='.repeat(80));

  // Get today's content that needs checking
  const { data: todaysContent, error } = await supabase.rpc(
    'get_content_for_relevancy_check',
    {
      p_limit: 500,
    }
  );

  if (error) {
    console.error('Error fetching content:', error);
    return;
  }

  console.log(
    `Found ${todaysContent?.length || 0} items from today needing relevancy checks\n`
  );

  if (!todaysContent || todaysContent.length === 0) {
    console.log('No content needs checking');
    return;
  }

  // Group by lounge
  const loungeGroups = {};
  todaysContent.forEach((item) => {
    if (!loungeGroups[item.lounge_name]) {
      loungeGroups[item.lounge_name] = [];
    }
    loungeGroups[item.lounge_name].push(item);
  });

  console.log('Content by lounge:');
  Object.entries(loungeGroups).forEach(([lounge, items]) => {
    console.log(`  ${lounge}: ${items.length} items`);
  });

  // Create relevancy service
  const relevancyService = new RelevancyService(supabase);

  console.log('\nProcessing relevancy checks...');
  const results = await relevancyService.checkRelevancy(todaysContent);

  console.log(`\nEvaluated ${results.length} items`);

  // Update scores and auto-delete
  await relevancyService.updateRelevancyScores(results);

  // Summary of results
  const scoreRanges = {
    high: results.filter((r) => r.score >= 70).length,
    medium: results.filter((r) => r.score >= 50 && r.score < 70).length,
    low: results.filter((r) => r.score < 50).length,
  };

  console.log('\nResults summary:');
  console.log(`  ✅ High relevancy (70+): ${scoreRanges.high} items`);
  console.log(`  ⚠️  Medium relevancy (50-69): ${scoreRanges.medium} items`);
  console.log(`  ❌ Low relevancy (<50): ${scoreRanges.low} items`);

  // Show examples of low scoring content
  const lowScoring = results.filter((r) => r.score < 50).slice(0, 5);
  if (lowScoring.length > 0) {
    console.log('\nLow relevancy content (will be auto-hidden):');
    const contentMap = new Map(todaysContent.map((c) => [c.content_id, c]));
    lowScoring.forEach((item) => {
      const content = contentMap.get(item.content_id);
      if (content) {
        console.log(
          `  - [${item.score}] ${content.content_title} (${content.lounge_name})`
        );
        console.log(`    ${item.reason.substring(0, 100)}...`);
      }
    });
  }

  // Check auto-deletions
  const { count: deletedCount } = await supabase
    .from('deleted_content')
    .select('*', { count: 'exact', head: true })
    .eq('deletion_reason', 'low_relevancy')
    .gte('deleted_at', new Date().toISOString().split('T')[0]);

  console.log(`\n🗑️  Auto-deleted ${deletedCount || 0} items today`);
}

runTodaysRelevancy()
  .then(() => {
    console.log('\n✅ Relevancy check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
