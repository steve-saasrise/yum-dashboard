require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

async function runRelevancyNow() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  console.log('Running relevancy checks and auto-deletion...\n');

  // Get unchecked content
  const { data: uncheckedContent } = await supabase.rpc(
    'get_content_for_relevancy_check',
    {
      p_limit: 100,
    }
  );

  console.log(`Found ${uncheckedContent?.length || 0} items to check\n`);

  if (!uncheckedContent || uncheckedContent.length === 0) {
    console.log('No content to check');
    return;
  }

  // Import and use the relevancy service
  const { RelevancyService } = eval(
    require('fs')
      .readFileSync('./lib/services/relevancy-service.ts', 'utf8')
      .replace(/^import .* from .*;$/gm, '')
      .replace(/^export /gm, '')
  );

  const relevancyService = new RelevancyService(supabase);

  // Process in small batches
  const batchSize = 10;
  let totalProcessed = 0;
  let totalDeleted = 0;

  for (
    let i = 0;
    i < Math.min(5, Math.ceil(uncheckedContent.length / batchSize));
    i++
  ) {
    const batch = uncheckedContent.slice(i * batchSize, (i + 1) * batchSize);
    console.log(`Processing batch ${i + 1}...`);

    const results = await relevancyService.checkRelevancy(batch);
    await relevancyService.updateRelevancyScores(results);

    const lowScores = results.filter((r) => r.score < 60).length;
    totalProcessed += batch.length;
    totalDeleted += lowScores;

    console.log(
      `  ✓ Processed ${batch.length} items, auto-deleted ${lowScores} low-relevancy items`
    );

    // Show some examples
    const examples = results.slice(0, 3);
    examples.forEach((r) => {
      const content = batch.find((b) => b.content_id === r.content_id);
      if (content) {
        const emoji = r.score >= 60 ? '✅' : '❌';
        console.log(
          `    ${emoji} [${r.score}] ${content.content_title?.substring(0, 50)}`
        );
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Total processed: ${totalProcessed}`);
  console.log(`🗑️  Total auto-deleted: ${totalDeleted}`);
}

runRelevancyNow().catch(console.error);
