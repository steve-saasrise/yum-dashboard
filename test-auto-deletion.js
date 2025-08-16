require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAutoDeletion() {
  // Get content with low relevancy scores
  const { data: lowRelevancyContent } = await supabase
    .from('content')
    .select(
      `
      id,
      platform_content_id,
      platform,
      creator_id,
      title,
      url,
      relevancy_score
    `
    )
    .lt('relevancy_score', 75)
    .limit(10);

  console.log(
    `Found ${lowRelevancyContent?.length || 0} items with low relevancy scores`
  );

  if (!lowRelevancyContent || lowRelevancyContent.length === 0) {
    console.log('No low relevancy content found');
    return;
  }

  // Auto-delete each low relevancy item
  for (const content of lowRelevancyContent) {
    // Check if already deleted
    const { data: existing } = await supabase
      .from('deleted_content')
      .select('id')
      .eq('platform_content_id', content.platform_content_id)
      .eq('platform', content.platform)
      .eq('creator_id', content.creator_id)
      .single();

    if (!existing) {
      // Insert into deleted_content
      const { error } = await supabase.from('deleted_content').insert({
        platform_content_id: content.platform_content_id,
        platform: content.platform,
        creator_id: content.creator_id,
        deleted_by: null,
        deleted_at: new Date().toISOString(),
        deletion_reason: 'low_relevancy',
        title: content.title,
        url: content.url,
      });

      if (error) {
        console.error(`Error auto-deleting ${content.title}:`, error);
      } else {
        console.log(
          `✅ Auto-deleted: "${content.title}" (score: ${content.relevancy_score})`
        );
      }
    } else {
      console.log(`⏭️  Already deleted: "${content.title}"`);
    }
  }

  // Check the results
  const { data: deletedContent, count } = await supabase
    .from('deleted_content')
    .select('*', { count: 'exact' })
    .eq('deletion_reason', 'low_relevancy');

  console.log(`\nTotal auto-deleted content: ${count}`);
}

testAutoDeletion()
  .then(() => {
    console.log('\nAuto-deletion test complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
