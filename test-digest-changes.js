#!/usr/bin/env node

// Test script to verify digest content selection changes
require('dotenv').config({ path: '.env.local' });

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testDigestContent() {
  console.log('Testing digest content selection...\n');

  // Get a system lounge to test with
  const { data: lounges, error: loungeError } = await supabase
    .from('lounges')
    .select('id, name')
    .eq('is_system_lounge', true)
    .limit(1);

  if (loungeError || !lounges?.length) {
    console.error('Error fetching lounge:', loungeError);
    return;
  }

  const lounge = lounges[0];
  console.log(`Testing with lounge: ${lounge.name}\n`);

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
  console.log(`Found ${creatorIdList.length} creators\n`);

  // Calculate 24 hours ago
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Get content counts by platform from last 24 hours
  const platforms = [
    'youtube',
    'twitter',
    'linkedin',
    'threads',
    'rss',
    'website',
  ];
  const platformCounts = {};

  for (const platform of platforms) {
    const { count } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .in('creator_id', creatorIdList)
      .eq('platform', platform)
      .eq('processing_status', 'processed')
      .gte('published_at', twentyFourHoursAgo.toISOString());

    platformCounts[platform] = count || 0;
  }

  console.log('Content available from last 24 hours:');
  console.log('=====================================');
  for (const [platform, count] of Object.entries(platformCounts)) {
    console.log(`${platform.padEnd(10)}: ${count} items`);
  }
  console.log(
    `\nTotal: ${Object.values(platformCounts).reduce((a, b) => a + b, 0)} items\n`
  );

  // Now simulate the digest selection logic
  console.log('Simulating digest selection (Phase 1 - up to 2 per platform):');
  console.log('=============================================================');

  const selectedContent = [];
  const usedIds = new Set();

  // Phase 1: Try to get up to 2 from each platform
  for (const platform of platforms) {
    const { data: platformContent } = await supabase
      .from('content')
      .select('id, title, platform, published_at')
      .in('creator_id', creatorIdList)
      .eq('platform', platform)
      .eq('processing_status', 'processed')
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(2);

    if (platformContent?.length) {
      for (const content of platformContent) {
        if (!usedIds.has(content.id)) {
          selectedContent.push(content);
          usedIds.add(content.id);
        }
      }
      console.log(
        `${platform.padEnd(10)}: Selected ${platformContent.length} items`
      );
    } else {
      console.log(`${platform.padEnd(10)}: No recent content`);
    }
  }

  console.log(`\nPhase 1 total: ${selectedContent.length} items\n`);

  // Phase 2: Fill remaining slots if needed
  if (selectedContent.length < 10) {
    const needed = 10 - selectedContent.length;
    console.log(`Phase 2: Need ${needed} more items to reach 10\n`);

    const selectedIds = Array.from(usedIds);

    let fillQuery = supabase
      .from('content')
      .select('id, title, platform, published_at')
      .in('creator_id', creatorIdList)
      .eq('processing_status', 'processed')
      .gte('published_at', twentyFourHoursAgo.toISOString());

    if (selectedIds.length > 0) {
      fillQuery = fillQuery.not('id', 'in', `(${selectedIds.join(',')})`);
    }

    const { data: fillContent } = await fillQuery
      .order('published_at', { ascending: false })
      .limit(needed);

    if (fillContent?.length) {
      console.log(`Found ${fillContent.length} additional items:`);
      const fillPlatformCounts = {};
      for (const content of fillContent) {
        fillPlatformCounts[content.platform] =
          (fillPlatformCounts[content.platform] || 0) + 1;
        selectedContent.push(content);
      }

      for (const [platform, count] of Object.entries(fillPlatformCounts)) {
        console.log(`  ${platform.padEnd(10)}: ${count} items`);
      }
    } else {
      console.log('No additional content available');
    }
  }

  console.log(`\nFinal digest composition:`);
  console.log('========================');
  const finalPlatformCounts = {};
  for (const content of selectedContent) {
    finalPlatformCounts[content.platform] =
      (finalPlatformCounts[content.platform] || 0) + 1;
  }

  for (const [platform, count] of Object.entries(finalPlatformCounts)) {
    console.log(`${platform.padEnd(10)}: ${count} items`);
  }
  console.log(`\nTotal items: ${selectedContent.length}/10`);

  // Show age of oldest content
  if (selectedContent.length > 0) {
    const oldestContent = selectedContent.reduce((oldest, current) =>
      new Date(current.published_at) < new Date(oldest.published_at)
        ? current
        : oldest
    );
    const hoursAgo = Math.round(
      (Date.now() - new Date(oldestContent.published_at)) / (1000 * 60 * 60)
    );
    console.log(`Oldest content: ${hoursAgo} hours ago`);
  }
}

testDigestContent().catch(console.error);
