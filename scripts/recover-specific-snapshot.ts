#!/usr/bin/env tsx
/**
 * Recovery script to fetch a specific BrightData snapshot
 * Run with: npm run script scripts/recover-specific-snapshot.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { BrightDataFetcher } from '../lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '../lib/services/content-service';
import { createClient } from '@supabase/supabase-js';

async function recoverSpecificSnapshot(snapshotId: string) {
  console.log(`🔄 Recovering specific BrightData snapshot: ${snapshotId}\n`);

  // Check configuration
  if (!process.env.BRIGHTDATA_API_KEY) {
    console.error('❌ BRIGHTDATA_API_KEY not configured');
    process.exit(1);
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY not configured');
    process.exit(1);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const brightDataFetcher = new BrightDataFetcher({
    apiKey: process.env.BRIGHTDATA_API_KEY,
  });
  const contentService = new ContentService(supabase);

  try {
    // Step 1: Check if snapshot exists in database
    console.log('📊 Checking if snapshot exists in database...');
    const { data: existingSnapshot } = await supabase
      .from('brightdata_snapshots')
      .select('*')
      .eq('snapshot_id', snapshotId)
      .single();

    if (existingSnapshot) {
      console.log('Snapshot already exists in database:');
      console.log('- Status:', existingSnapshot.status);
      console.log('- Created:', existingSnapshot.created_at);
      console.log('- Processed:', existingSnapshot.processed_at);
      console.log('- Posts retrieved:', existingSnapshot.posts_retrieved);
      console.log('- Error:', existingSnapshot.error);

      if (existingSnapshot.status === 'processed') {
        console.log('\n✅ Snapshot already processed');
        return;
      }

      const shouldReprocess = await promptUser(
        '\nSnapshot exists but not fully processed. Reprocess? (y/n): '
      );

      if (shouldReprocess.toLowerCase() !== 'y') {
        return;
      }
    }

    // Step 2: Get snapshot metadata from BrightData
    console.log('\n📋 Fetching snapshot metadata from BrightData...');
    try {
      const metadata = await brightDataFetcher.getSnapshotMetadata(snapshotId);
      console.log('Snapshot metadata:');
      console.log('- Status:', metadata.status);
      console.log('- Result count:', metadata.result_count);
      console.log('- Created:', metadata.created);
      console.log('- Cost:', metadata.cost);
      console.log('- File size:', metadata.file_size);

      if (metadata.status !== 'ready') {
        console.log(`\n⚠️ Snapshot is not ready (status: ${metadata.status})`);
        return;
      }
    } catch (error) {
      console.log(
        '\n⚠️ Could not fetch metadata, will try to download anyway...'
      );
    }

    // Step 3: Add to database if not exists
    if (!existingSnapshot) {
      console.log('\n💾 Adding snapshot to database...');
      const { error: insertError } = await supabase
        .from('brightdata_snapshots')
        .insert({
          snapshot_id: snapshotId,
          dataset_id: 'gd_lyy3tktm25m4avu764',
          status: 'ready',
          created_at: new Date().toISOString(),
          metadata: {
            manual_recovery: true,
            recovered_at: new Date().toISOString(),
          },
        });

      if (insertError) {
        console.error('Error adding snapshot to database:', insertError);
      }
    }

    // Step 4: Download and process the snapshot
    console.log('\n📥 Downloading snapshot data...');
    try {
      const contentItems =
        await brightDataFetcher.processReadySnapshot(snapshotId);

      console.log(`Retrieved ${contentItems.length} posts from snapshot`);

      if (contentItems.length > 0) {
        // Try to match creators based on URLs
        console.log('\n🔍 Matching creators...');
        let matchedCount = 0;

        for (const item of contentItems) {
          // Extract username from LinkedIn URL
          const urlMatch = item.url?.match(/linkedin\.com\/in\/([^\/]+)/);
          if (urlMatch) {
            const username = urlMatch[1];

            // Find creator by LinkedIn URL pattern
            const { data: creators } = await supabase
              .from('creator_urls')
              .select('creator_id')
              .eq('platform', 'linkedin')
              .ilike('url', `%${username}%`)
              .limit(1);

            if (creators && creators.length > 0) {
              item.creator_id = creators[0].creator_id;
              matchedCount++;
            }
          }
        }

        console.log(`Matched ${matchedCount} posts to creators`);

        // Store content
        console.log('\n💾 Storing content in database...');
        const results = await contentService.storeMultipleContent(contentItems);

        console.log(
          `\n✅ Successfully stored: ${results.created} new, ${results.updated} updated, ${results.errors.length} errors`
        );

        // Update snapshot status
        await supabase
          .from('brightdata_snapshots')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            posts_retrieved: contentItems.length,
            metadata: {
              manual_recovery: true,
              storage_results: {
                created: results.created,
                updated: results.updated,
                errors: results.errors.length,
              },
            },
          })
          .eq('snapshot_id', snapshotId);

        console.log('\n✨ Snapshot processed successfully!');
      } else {
        console.log('\n⚠️ No content found in snapshot');

        // Update snapshot status
        await supabase
          .from('brightdata_snapshots')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
            posts_retrieved: 0,
          })
          .eq('snapshot_id', snapshotId);
      }
    } catch (error) {
      console.error('\n❌ Error processing snapshot:', error);

      // Update error in database
      await supabase
        .from('brightdata_snapshots')
        .update({
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          last_checked_at: new Date().toISOString(),
        })
        .eq('snapshot_id', snapshotId);
    }
  } catch (error) {
    console.error('❌ Recovery failed:', error);
    process.exit(1);
  }
}

function promptUser(question: string): Promise<string> {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Get snapshot ID from command line argument
const snapshotId = process.argv[2];

if (!snapshotId) {
  console.error('❌ Please provide a snapshot ID as an argument');
  console.error(
    'Usage: npm run script scripts/recover-specific-snapshot.ts s_meoje189itkmbeamv'
  );
  process.exit(1);
}

// Run the recovery
recoverSpecificSnapshot(snapshotId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
