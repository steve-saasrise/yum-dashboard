#!/usr/bin/env node

// Test script to understand how relevancy filtering affects email digest content
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testRelevancyInDigest() {
  console.log('Testing Relevancy Filtering in Email Digest\n');
  console.log('============================================\n');

  // Get a system lounge to test with
  const { data: lounges, error: loungeError } = await supabase
    .from('lounges')
    .select('id, name, relevancy_threshold')
    .eq('is_system_lounge', true)
    .order('name')
    .limit(1);

  if (loungeError || !lounges?.length) {
    console.error('Error fetching lounge:', loungeError);
    return;
  }

  const lounge = lounges[0];
  console.log(`Testing with: ${lounge.name} Lounge`);
  console.log(`Relevancy Threshold: ${lounge.relevancy_threshold}\n`);

  // Get creators for this lounge
  const { data: creatorIds, error: creatorError } = await supabase
    .from('creator_lounges')
    .select('creator_id')
    .eq('lounge_id', lounge.id);

  if (creatorError || !creatorIds?.length) {
    console.log('No creators found for this lounge');
    return;
  }

  const creatorIdList = creatorIds.map((c) => c.creator_id);
  console.log(`Found ${creatorIdList.length} creators in this lounge\n`);

  // Calculate 24 hours ago
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Get content with relevancy scores
  console.log('Content from last 24 hours by relevancy status:');
  console.log('================================================\n');

  // 1. Content that WOULD be included (above threshold OR not scored)
  const { data: includedContent, count: includedCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: false })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .or(
      `relevancy_score.gte.${lounge.relevancy_threshold},relevancy_score.is.null`
    )
    .limit(10);

  // 2. Content that WOULD be excluded (below threshold)
  const { data: excludedContent, count: excludedCount } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: false })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .lt('relevancy_score', lounge.relevancy_threshold)
    .limit(10);

  console.log(`✅ Would be INCLUDED in digest: ${includedCount || 0} items`);
  if (includedContent?.length) {
    console.log(
      '   Sample scores:',
      includedContent
        .slice(0, 5)
        .map((c) => c.relevancy_score || 'Not scored')
        .join(', ')
    );
  }

  console.log(
    `\n❌ Would be EXCLUDED from digest: ${excludedCount || 0} items`
  );
  if (excludedContent?.length) {
    console.log(
      '   Sample scores:',
      excludedContent
        .slice(0, 5)
        .map((c) => c.relevancy_score)
        .join(', ')
    );
    console.log('\n   Example excluded content:');
    excludedContent.slice(0, 3).forEach((item) => {
      console.log(
        `   - "${item.title.substring(0, 50)}..." (score: ${item.relevancy_score})`
      );
    });
  }

  // 3. Check unchecked content
  const { count: unscored } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .in('creator_id', creatorIdList)
    .eq('processing_status', 'processed')
    .gte('published_at', twentyFourHoursAgo.toISOString())
    .is('relevancy_score', null);

  console.log(`\n⏳ Not yet scored: ${unscored || 0} items`);
  console.log('   (These would be INCLUDED until scored)\n');

  // Simulate the actual digest query
  console.log('Simulating actual digest query logic:');
  console.log('=====================================\n');

  const platforms = [
    'youtube',
    'twitter',
    'linkedin',
    'threads',
    'rss',
    'website',
  ];
  let totalSelected = 0;
  let scoredContent = 0;
  let unscoredContent = 0;

  for (const platform of platforms) {
    const { data: platformContent } = await supabase
      .from('content')
      .select('id, title, relevancy_score, platform')
      .in('creator_id', creatorIdList)
      .eq('platform', platform)
      .eq('processing_status', 'processed')
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .or(
        `relevancy_score.gte.${lounge.relevancy_threshold},relevancy_score.is.null`
      )
      .order('relevancy_score', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
      .limit(2);

    if (platformContent?.length) {
      totalSelected += platformContent.length;
      platformContent.forEach((item) => {
        if (item.relevancy_score !== null) {
          scoredContent++;
        } else {
          unscoredContent++;
        }
      });
      console.log(
        `${platform.padEnd(10)}: ${platformContent.length} items (scores: ${platformContent
          .map((c) => c.relevancy_score || 'unscored')
          .join(', ')})`
      );
    }
  }

  console.log(`\nTotal in digest: ${totalSelected} items`);
  console.log(`  - With scores: ${scoredContent}`);
  console.log(`  - Unscored: ${unscoredContent}`);

  // Check for auto-deleted content
  console.log('\nAuto-deleted content check:');
  console.log('===========================\n');

  const { data: deletedContent, count: deletedCount } = await supabase
    .from('deleted_content')
    .select('*', { count: 'exact', head: false })
    .eq('deletion_reason', 'low_relevancy')
    .gte('created_at', twentyFourHoursAgo.toISOString())
    .limit(5);

  console.log(`🗑️  Auto-deleted for low relevancy: ${deletedCount || 0} items`);
  if (deletedContent?.length) {
    console.log('   Recent examples:');
    deletedContent.forEach((item) => {
      console.log(
        `   - Platform: ${item.platform}, Creator: ${item.creator_id?.substring(0, 8)}...`
      );
    });
  }

  // Summary
  console.log('\n📊 SUMMARY');
  console.log('==========\n');
  console.log(`The email digest for ${lounge.name} lounge:`);
  console.log(`- Uses relevancy threshold: ${lounge.relevancy_threshold}`);
  console.log(
    `- Includes content with score ≥ ${lounge.relevancy_threshold} OR unscored content`
  );
  console.log(`- Excludes content with score < ${lounge.relevancy_threshold}`);
  console.log(
    `- Currently ${unscored || 0} items awaiting scoring (will be included)`
  );
  console.log(
    `- ${deletedCount || 0} items auto-deleted in last 24h (won't appear at all)`
  );
}

testRelevancyInDigest().catch(console.error);
