#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { RelevancyService } from './lib/services/relevancy-service.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testAutoDeletion() {
  console.log('Testing auto-deletion logic...\n');

  // Get low-scoring content that should be deleted
  const { data: lowScoringContent } = await supabase
    .from('content')
    .select(
      `
      id,
      title,
      relevancy_score,
      platform_content_id,
      platform,
      creator_id,
      url
    `
    )
    .lt('relevancy_score', 60)
    .not('relevancy_score', 'is', null)
    .limit(5);

  console.log(`Found ${lowScoringContent?.length || 0} low-scoring items\n`);

  if (!lowScoringContent || lowScoringContent.length === 0) {
    console.log('No low-scoring content found');
    return;
  }

  // Check which ones should be deleted (fail ALL lounge thresholds)
  for (const content of lowScoringContent) {
    // Get all lounges this content belongs to
    const { data: lounges } = await supabase
      .from('creators')
      .select(
        `
        creator_lounges!inner(
          lounges!inner(
            id,
            name,
            relevancy_threshold
          )
        )
      `
      )
      .eq('id', content.creator_id)
      .single();

    const allLounges = lounges?.creator_lounges?.map((cl) => cl.lounges) || [];
    const failsAll = allLounges.every(
      (lounge) => content.relevancy_score < (lounge.relevancy_threshold || 60)
    );

    console.log(`${content.title} (score: ${content.relevancy_score})`);
    console.log(
      `  Lounges: ${allLounges.map((l) => `${l.name}(${l.relevancy_threshold || 60})`).join(', ')}`
    );
    console.log(`  Should delete: ${failsAll ? 'YES' : 'NO'}`);

    if (failsAll) {
      // Check if already in deleted_content
      const { data: existing } = await supabase
        .from('deleted_content')
        .select('id')
        .eq('platform_content_id', content.platform_content_id)
        .eq('platform', String(content.platform))
        .eq('creator_id', content.creator_id)
        .single();

      if (existing) {
        console.log('  Status: Already deleted\n');
      } else {
        // Try to insert
        const { error } = await supabase.from('deleted_content').insert({
          platform_content_id: content.platform_content_id,
          platform: String(content.platform),
          creator_id: content.creator_id,
          deleted_by: null,
          deleted_at: new Date().toISOString(),
          deletion_reason: 'low_relevancy',
          title: content.title,
          url: content.url,
        });

        if (error) {
          console.log(`  Status: ERROR - ${error.message}\n`);
        } else {
          console.log('  Status: Successfully deleted\n');
        }
      }
    } else {
      console.log('  Status: Keeping (passes at least one lounge)\n');
    }
  }
}

testAutoDeletion().catch(console.error);
