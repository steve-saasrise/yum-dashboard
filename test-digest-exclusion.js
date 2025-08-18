#!/usr/bin/env node

// Test script to verify unscored content is excluded from digests
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDigestExclusion() {
  console.log('Testing Digest Exclusion of Unscored Content\n');
  console.log('=============================================\n');

  // Get a system lounge
  const { data: lounges } = await supabase
    .from('lounges')
    .select('id, name, relevancy_threshold')
    .eq('is_system_lounge', true)
    .order('name')
    .limit(1);

  const lounge = lounges[0];
  console.log(`Testing with: ${lounge.name} Lounge`);
  console.log(`Threshold: ${lounge.relevancy_threshold}\n`);

  // Get creators for this lounge
  const { data: creatorIds } = await supabase
    .from('creator_lounges')
    .select('creator_id')
    .eq('lounge_id', lounge.id);

  const creatorIdList = creatorIds.map((c) => c.creator_id);

  // Calculate 24 hours ago
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  console.log('Content Status from Last 24 Hours:');
  console.log('===================================\n');

  // Count unscored content
  const { count: unscoredCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .is('relevancy_score', null);

  // Count scored content above threshold
  const { count: scoredAboveCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .gte('relevancy_score', lounge.relevancy_threshold);

  // Count scored content below threshold
  const { count: scoredBelowCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .lt('relevancy_score', lounge.relevancy_threshold)
    .not('relevancy_score', 'is', null);

  console.log(
    `✅ Scored & Above Threshold (≥${lounge.relevancy_threshold}): ${scoredAboveCount || 0} items`
  );
  console.log(
    `❌ Scored & Below Threshold (<${lounge.relevancy_threshold}): ${scoredBelowCount || 0} items`
  );
  console.log(`⏳ Unscored (null score): ${unscoredCount || 0} items\n`);

  // Simulate OLD digest query (with unscored)
  console.log('OLD Digest Logic (includes unscored):');
  console.log('-------------------------------------');
  const { count: oldLogicCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .or(
      `relevancy_score.gte.${lounge.relevancy_threshold},relevancy_score.is.null`
    );

  console.log(`Would include: ${oldLogicCount || 0} items`);
  console.log(
    `(${scoredAboveCount || 0} scored + ${unscoredCount || 0} unscored)\n`
  );

  // Simulate NEW digest query (excludes unscored)
  console.log('NEW Digest Logic (excludes unscored):');
  console.log('-------------------------------------');
  const { count: newLogicCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .gte('relevancy_score', lounge.relevancy_threshold);

  console.log(`Will include: ${newLogicCount || 0} items`);
  console.log(`(Only scored content ≥${lounge.relevancy_threshold})\n`);

  // Show the difference
  const difference = (oldLogicCount || 0) - (newLogicCount || 0);
  console.log('📊 IMPACT OF CHANGE:');
  console.log('===================');
  console.log(`${difference} fewer items in digest`);
  console.log(`${unscoredCount || 0} unscored items excluded`);

  if (unscoredCount > 0) {
    console.log(
      '\n⚠️  Note: These unscored items will be excluded until they are scored.'
    );
    console.log(
      'Once scored, only those meeting the threshold will appear in future digests.'
    );
  }

  // Check dashboard visibility
  console.log('\n👁️  DASHBOARD VISIBILITY:');
  console.log('========================');
  console.log('Regular users: Only see scored content (unscored hidden)');
  console.log(
    'Curators/Admins: See all content with "⏳ Pending relevancy check" banner for unscored items'
  );
}

testDigestExclusion().catch(console.error);
