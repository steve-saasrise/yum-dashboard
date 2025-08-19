#!/usr/bin/env tsx

/**
 * Test the improved deduplication logic on the Taylor Swift example
 */

import { createClient } from '@supabase/supabase-js';
import {
  generateContentHash,
  ContentForDeduplication,
} from '../lib/services/content-deduplication';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

function createContentFingerprint(text: string): string {
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const words = normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 2) // Filter out short words
    .slice(0, 100); // Take first 100 significant words

  return words.join(' ');
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const normalizeText = (text: string): string => {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const words1 = new Set(
    normalizeText(text1)
      .split(' ')
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    normalizeText(text2)
      .split(' ')
      .filter((w) => w.length > 2)
  );

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

async function main() {
  console.log('🧪 Testing improved deduplication logic...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Get the Taylor Swift posts
  const { data: taylorPosts, error } = await supabase
    .from('content')
    .select(
      'id, title, description, content_body, platform, creator_id, content_hash'
    )
    .in('id', [
      '074877af-5d81-48bb-b63e-9bc50762a8b1',
      '31a19835-1887-4181-90ed-7ab31a6d0d20',
    ]);

  if (error || !taylorPosts || taylorPosts.length !== 2) {
    console.error('❌ Could not fetch Taylor Swift posts:', error);
    return;
  }

  const [twitterPost, linkedinPost] = taylorPosts;

  console.log('📝 Analyzing posts:');
  console.log(`Twitter: "${twitterPost.description?.substring(0, 100)}..."`);
  console.log(`LinkedIn: "${linkedinPost.description?.substring(0, 100)}..."`);

  // Test similarity
  const similarity = calculateTextSimilarity(
    twitterPost.description || '',
    linkedinPost.description || ''
  );
  console.log(`\n🔍 Text similarity: ${(similarity * 100).toFixed(1)}%`);

  // Test new fingerprinting
  const twitterFingerprint = createContentFingerprint(
    twitterPost.description || ''
  );
  const linkedinFingerprint = createContentFingerprint(
    linkedinPost.description || ''
  );

  console.log(`\n📋 Fingerprint comparison:`);
  console.log(
    `Twitter fingerprint: "${twitterFingerprint.substring(0, 100)}..."`
  );
  console.log(
    `LinkedIn fingerprint: "${linkedinFingerprint.substring(0, 100)}..."`
  );
  console.log(
    `Fingerprints match: ${twitterFingerprint === linkedinFingerprint}`
  );

  // Test new hash generation
  const twitterContent: ContentForDeduplication = {
    title: twitterPost.title,
    description: twitterPost.description,
    content_body: twitterPost.content_body,
    url: 'https://twitter.com/test',
    platform: 'twitter',
    creator_id: twitterPost.creator_id,
  };

  const linkedinContent: ContentForDeduplication = {
    title: linkedinPost.title,
    description: linkedinPost.description,
    content_body: linkedinPost.content_body,
    url: 'https://linkedin.com/test',
    platform: 'linkedin',
    creator_id: linkedinPost.creator_id,
  };

  const newTwitterHash = generateContentHash(twitterContent);
  const newLinkedInHash = generateContentHash(linkedinContent);

  console.log(`\n🔐 New hash generation:`);
  console.log(`Twitter hash: ${newTwitterHash}`);
  console.log(`LinkedIn hash: ${newLinkedInHash}`);
  console.log(`New hashes match: ${newTwitterHash === newLinkedInHash}`);

  console.log(`\n📊 Current database hashes:`);
  console.log(`Twitter current: ${twitterPost.content_hash}`);
  console.log(`LinkedIn current: ${linkedinPost.content_hash}`);

  if (newTwitterHash === newLinkedInHash) {
    console.log(
      '\n✅ SUCCESS: Improved algorithm would detect these as duplicates!'
    );

    // Optionally update the database to group these posts
    const duplicateGroupId = crypto.randomUUID();

    console.log('\n🔄 Updating database to group these posts...');

    await supabase
      .from('content')
      .update({
        content_hash: newTwitterHash,
        duplicate_group_id: duplicateGroupId,
        is_primary: true, // Twitter has higher priority
      })
      .eq('id', twitterPost.id);

    await supabase
      .from('content')
      .update({
        content_hash: newLinkedInHash,
        duplicate_group_id: duplicateGroupId,
        is_primary: false, // LinkedIn is secondary
      })
      .eq('id', linkedinPost.id);

    console.log('✅ Posts successfully grouped as duplicates!');
  } else {
    console.log('\n❌ Algorithm still does not detect these as duplicates');
    console.log('Need to adjust similarity threshold or fingerprinting logic');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
