#!/usr/bin/env tsx

/**
 * Backfill deduplication fields for existing content
 *
 * This script:
 * 1. Processes all existing content to generate content hashes
 * 2. Groups content by hash to identify duplicates
 * 3. Sets primary content and duplicate group IDs
 * 4. Updates the database with deduplication information
 */

import { createClient } from '@supabase/supabase-js';
import {
  generateContentHash,
  selectPrimaryContent,
  ContentForDeduplication,
} from '../lib/services/content-deduplication';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

interface ContentRow {
  id: string;
  title: string;
  description?: string;
  content_body?: string;
  url: string;
  platform: string;
  creator_id: string;
  published_at: string;
  engagement_metrics?: any;
}

async function main() {
  console.log('🚀 Starting content deduplication backfill...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch all content that needs processing (where content_hash is null)
  console.log('📥 Fetching existing content...');
  const { data: content, error: fetchError } = await supabase
    .from('content')
    .select(
      'id, title, description, content_body, url, platform, creator_id, published_at, engagement_metrics'
    )
    .is('content_hash', null);

  if (fetchError) {
    console.error('❌ Failed to fetch content:', fetchError);
    process.exit(1);
  }

  if (!content || content.length === 0) {
    console.log('✅ No content to process (all content already has hashes)');
    return;
  }

  console.log(`📊 Processing ${content.length} content items...`);

  // Group content by hash
  const hashGroups = new Map<string, ContentRow[]>();
  const contentHashes = new Map<string, string>();

  for (const item of content) {
    const contentForHash: ContentForDeduplication = {
      title: item.title || '',
      description: item.description,
      content_body: item.content_body,
      url: item.url,
      platform: item.platform,
      creator_id: item.creator_id,
    };

    const hash = generateContentHash(contentForHash);
    contentHashes.set(item.id, hash);

    if (!hashGroups.has(hash)) {
      hashGroups.set(hash, []);
    }
    hashGroups.get(hash)!.push(item);
  }

  console.log(`🔍 Found ${hashGroups.size} unique content hashes`);
  console.log(
    `📈 Duplicate groups: ${Array.from(hashGroups.values()).filter((group) => group.length > 1).length}`
  );

  // Process each hash group
  let processedCount = 0;
  let duplicateGroupsCreated = 0;

  for (const [hash, group] of hashGroups) {
    if (group.length === 1) {
      // Single content - just update hash and mark as primary
      const item = group[0];
      const { error } = await supabase
        .from('content')
        .update({
          content_hash: hash,
          is_primary: true,
          duplicate_group_id: null,
        })
        .eq('id', item.id);

      if (error) {
        console.error(`❌ Failed to update single content ${item.id}:`, error);
      }
    } else {
      // Multiple content - create duplicate group
      const duplicateGroupId = crypto.randomUUID();
      duplicateGroupsCreated++;

      // Select primary content
      const primaryContentId = selectPrimaryContent(
        group.map((item) => ({
          id: item.id,
          platform: item.platform,
          published_at: item.published_at,
          engagement_metrics: item.engagement_metrics,
        }))
      );

      console.log(
        `📋 Creating duplicate group for ${group.length} items (primary: ${primaryContentId})`
      );
      console.log(
        `   Titles: ${group.map((g) => g.title?.substring(0, 50)).join(' | ')}`
      );

      // Update all items in the group
      for (const item of group) {
        const { error } = await supabase
          .from('content')
          .update({
            content_hash: hash,
            duplicate_group_id: duplicateGroupId,
            is_primary: item.id === primaryContentId,
          })
          .eq('id', item.id);

        if (error) {
          console.error(`❌ Failed to update content ${item.id}:`, error);
        }
      }
    }

    processedCount += group.length;

    if (processedCount % 100 === 0) {
      console.log(`⏳ Processed ${processedCount}/${content.length} items...`);
    }
  }

  console.log('✅ Backfill complete!');
  console.log(`📊 Stats:`);
  console.log(`   - Total content processed: ${processedCount}`);
  console.log(`   - Duplicate groups created: ${duplicateGroupsCreated}`);
  console.log(`   - Unique content hashes: ${hashGroups.size}`);

  // Show some sample duplicate groups
  const sampleDuplicates = Array.from(hashGroups.values())
    .filter((group) => group.length > 1)
    .slice(0, 5);

  if (sampleDuplicates.length > 0) {
    console.log('\n📋 Sample duplicate groups:');
    sampleDuplicates.forEach((group, index) => {
      console.log(`\n${index + 1}. Group of ${group.length} items:`);
      group.forEach((item) => {
        console.log(
          `   - [${item.platform}] ${item.title?.substring(0, 60)}...`
        );
      });
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}
