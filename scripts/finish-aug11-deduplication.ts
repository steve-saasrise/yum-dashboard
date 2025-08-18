#!/usr/bin/env tsx

/**
 * Process remaining August 11th content for deduplication
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

async function main() {
  console.log('🚀 Finishing August 11th content deduplication...');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Fetch remaining August 11th content
  const { data: content, error: fetchError } = await supabase
    .from('content')
    .select(
      'id, title, description, content_body, url, platform, creator_id, published_at, engagement_metrics'
    )
    .eq('content_hash', null)
    .gte('published_at', '2025-08-11T00:00:00Z')
    .lt('published_at', '2025-08-12T00:00:00Z')
    .order('published_at', { ascending: false });

  if (fetchError) {
    console.error('❌ Failed to fetch content:', fetchError);
    process.exit(1);
  }

  if (!content || content.length === 0) {
    console.log('✅ No remaining August 11th content to process');
    return;
  }

  console.log(`📊 Processing ${content.length} remaining August 11th items...`);

  // Group content by hash
  const hashGroups = new Map();
  const contentHashes = new Map();

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
    hashGroups.get(hash).push(item);
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
        group.map((item: any) => ({
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
        `   Titles: ${group.map((g: any) => g.title?.substring(0, 50)).join(' | ')}`
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
  }

  console.log('✅ August 11th content backfill complete!');
  console.log(`📊 Final stats:`);
  console.log(`   - Content processed: ${processedCount}`);
  console.log(`   - Duplicate groups created: ${duplicateGroupsCreated}`);
  console.log(`   - Unique content hashes: ${hashGroups.size}`);
}

if (require.main === module) {
  main().catch(console.error);
}
