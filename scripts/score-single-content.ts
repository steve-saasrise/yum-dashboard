import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '../lib/services/relevancy-service';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function scoreSingleContent() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const relevancyService = getRelevancyService(supabase);
  if (!relevancyService) {
    console.error('Relevancy service not configured');
    process.exit(1);
  }

  // Score Dharmesh's heebie-jeebies tweet
  const contentId = '65770708-234b-4e86-88d7-265c7d604207';

  // Get the content details
  const { data: contentData, error } = await supabase
    .from('content')
    .select(
      `
      *,
      creators!inner(id, display_name)
    `
    )
    .eq('id', contentId)
    .single();

  if (error) {
    console.error('Error fetching content:', error);
    process.exit(1);
  }

  if (!contentData) {
    console.error('Content not found');
    process.exit(1);
  }

  // Get the lounge info
  const { data: loungeData } = await supabase
    .from('creator_lounges')
    .select('lounges!inner(id, name, theme_description)')
    .eq('creator_id', contentData.creators.id)
    .single();

  if (!loungeData) {
    console.error('Lounge not found');
    process.exit(1);
  }

  const lounge = loungeData.lounges as any;

  const testItem = {
    content_id: contentId,
    lounge_id: lounge.id,
    lounge_name: lounge.name,
    theme_description: lounge.theme_description,
    content_title: contentData.title,
    content_description: contentData.description,
    content_url: contentData.url,
    creator_name: contentData.creators.display_name,
    reference_type: contentData.reference_type,
    referenced_content: contentData.referenced_content,
  };

  console.log('Scoring content:');
  console.log(`  Creator: ${testItem.creator_name}`);
  console.log(`  Content: "${testItem.content_description}"`);
  console.log(`  Lounge: ${testItem.lounge_name}\n`);

  // @ts-ignore - accessing private method
  const result = await relevancyService.checkSingleItem(testItem);

  console.log(`Score: ${result.score}/100`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Would be deleted: ${result.score < 60 ? 'YES ❌' : 'NO ✅'}\n`);

  // Update the score
  await relevancyService.updateRelevancyScores([result]);

  console.log('✅ Content scored and database updated');
  process.exit(0);
}

scoreSingleContent().catch(console.error);
