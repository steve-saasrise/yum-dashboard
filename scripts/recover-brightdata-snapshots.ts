#!/usr/bin/env tsx
/**
 * Recovery script to fetch and process historical BrightData snapshots
 * Run with: npm run script scripts/recover-brightdata-snapshots.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { BrightDataFetcher } from '../lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '../lib/services/content-service';
import { createClient } from '@supabase/supabase-js';

async function recoverSnapshots() {
  console.log('🔄 Starting BrightData snapshot recovery...\n');

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
    // Step 1: Get all historical snapshots
    console.log('📋 Fetching historical snapshots from BrightData...');
    const snapshots = await brightDataFetcher.getAllHistoricalSnapshots(50, 'ready');
    
    console.log(`Found ${snapshots.length} ready snapshots\n`);

    if (snapshots.length === 0) {
      console.log('No snapshots to recover');
      return;
    }

    // Display snapshots
    console.log('Available snapshots:');
    snapshots.forEach((snapshot, index) => {
      const date = new Date(snapshot.created || '').toLocaleString();
      console.log(`${index + 1}. ${snapshot.snapshot_id} - Created: ${date} - Records: ${snapshot.result_count || 0}`);
    });

    // Step 2: Check which snapshots are already in our database
    console.log('\n📊 Checking database for existing snapshots...');
    const { data: existingSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('snapshot_id, status, processed_at')
      .in('snapshot_id', snapshots.map(s => s.snapshot_id));

    const existingIds = new Set(existingSnapshots?.map(s => s.snapshot_id) || []);
    const newSnapshots = snapshots.filter(s => !existingIds.has(s.snapshot_id));

    console.log(`Found ${newSnapshots.length} new snapshots not in database`);
    console.log(`Found ${existingIds.size} snapshots already tracked`);

    // Step 3: Process untracked snapshots
    if (newSnapshots.length > 0) {
      console.log('\n🚀 Processing new snapshots...\n');
      
      for (const snapshot of newSnapshots) {
        console.log(`\nProcessing snapshot: ${snapshot.snapshot_id}`);
        console.log(`Created: ${new Date(snapshot.created || '').toLocaleString()}`);
        console.log(`Records: ${snapshot.result_count || 0}`);

        try {
          // Save to database
          await supabase
            .from('brightdata_snapshots')
            .insert({
              snapshot_id: snapshot.snapshot_id,
              dataset_id: 'gd_lyy3tktm25m4avu764',
              status: 'ready',
              created_at: snapshot.created,
              metadata: {
                cost: snapshot.cost,
                file_size: snapshot.file_size,
                result_count: snapshot.result_count,
                recovery_run: true,
              }
            });

          // Download and process the data
          console.log('📥 Downloading snapshot data...');
          const contentItems = await brightDataFetcher.processReadySnapshot(snapshot.snapshot_id);
          
          console.log(`Retrieved ${contentItems.length} posts`);

          if (contentItems.length > 0) {
            // Try to match creators based on URLs
            console.log('🔍 Matching creators...');
            
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
                  console.log(`Matched post to creator: ${creators[0].creator_id}`);
                }
              }
            }

            // Store content
            console.log('💾 Storing content...');
            const results = await contentService.storeMultipleContent(contentItems);
            
            console.log(`✅ Stored: ${results.created} new, ${results.updated} updated, ${results.errors.length} errors`);

            // Update snapshot status
            await supabase
              .from('brightdata_snapshots')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString(),
                posts_retrieved: contentItems.length,
                metadata: {
                  cost: snapshot.cost,
                  file_size: snapshot.file_size,
                  result_count: snapshot.result_count,
                  recovery_run: true,
                  storage_results: {
                    created: results.created,
                    updated: results.updated,
                    errors: results.errors.length,
                  }
                }
              })
              .eq('snapshot_id', snapshot.snapshot_id);
          }
        } catch (error) {
          console.error(`❌ Error processing snapshot ${snapshot.snapshot_id}:`, error);
          
          // Mark as failed
          await supabase
            .from('brightdata_snapshots')
            .update({
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            })
            .eq('snapshot_id', snapshot.snapshot_id);
        }
      }
    }

    // Step 4: Reprocess failed snapshots if any
    console.log('\n🔄 Checking for failed snapshots to retry...');
    const { data: failedSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('*')
      .eq('status', 'failed')
      .limit(10);

    if (failedSnapshots && failedSnapshots.length > 0) {
      console.log(`Found ${failedSnapshots.length} failed snapshots to retry`);
      
      const retry = await promptUser('Do you want to retry failed snapshots? (y/n): ');
      
      if (retry.toLowerCase() === 'y') {
        for (const snapshot of failedSnapshots) {
          console.log(`\nRetrying snapshot: ${snapshot.snapshot_id}`);
          
          try {
            const contentItems = await brightDataFetcher.processReadySnapshot(
              snapshot.snapshot_id,
              snapshot.metadata?.max_results
            );
            
            console.log(`Retrieved ${contentItems.length} posts`);
            
            // Add creator_id from metadata
            if (snapshot.metadata?.creator_id) {
              contentItems.forEach(item => {
                item.creator_id = snapshot.metadata.creator_id;
              });
            }
            
            const results = await contentService.storeMultipleContent(contentItems);
            
            console.log(`✅ Stored: ${results.created} new, ${results.updated} updated`);
            
            // Update as processed
            await supabase
              .from('brightdata_snapshots')
              .update({
                status: 'processed',
                processed_at: new Date().toISOString(),
                posts_retrieved: contentItems.length,
                error: null,
              })
              .eq('snapshot_id', snapshot.snapshot_id);
          } catch (error) {
            console.error(`❌ Retry failed:`, error);
          }
        }
      }
    }

    console.log('\n✨ Recovery complete!');
    
    // Final summary
    const { data: summary } = await supabase
      .from('brightdata_snapshots')
      .select('status')
      .in('status', ['processed', 'failed', 'pending']);
    
    const counts = summary?.reduce((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};
    
    console.log('\n📊 Final Status:');
    console.log(`- Processed: ${counts.processed || 0}`);
    console.log(`- Pending: ${counts.pending || 0}`);
    console.log(`- Failed: ${counts.failed || 0}`);

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

// Run the recovery
recoverSnapshots()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });