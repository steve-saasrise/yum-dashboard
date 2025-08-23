#!/usr/bin/env tsx
/**
 * Recovery script to fetch ALL BrightData snapshots
 * Run with: npm run script scripts/recover-all-brightdata-snapshots.ts
 */

import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { BrightDataFetcher } from '../lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '../lib/services/content-service';
import { createClient } from '@supabase/supabase-js';

async function recoverAllSnapshots() {
  console.log('🔄 Starting comprehensive BrightData snapshot recovery...\n');

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

  try {
    // Step 1: Get ALL snapshots from the last 48 hours
    console.log('📋 Fetching ALL snapshots from the last 48 hours from BrightData API...');
    
    // Calculate 48 hours ago
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    console.log(`Looking for snapshots created after: ${fortyEightHoursAgo.toISOString()}\n`);
    
    // Fetch snapshots with higher limit
    const endpoint = `https://api.brightdata.com/datasets/v3/snapshots`;
    const queryParams = new URLSearchParams({
      dataset_id: 'gd_lyy3tktm25m4avu764',
      limit: '500', // Get up to 500 snapshots
    });

    const response = await fetch(`${endpoint}?${queryParams}`, {
      headers: {
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch snapshots: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch snapshots: ${response.status}`);
    }

    const fetchedSnapshots = await response.json();
    console.log(`Fetched ${fetchedSnapshots.length} snapshots from API`);
    
    // Filter for snapshots from the last 48 hours
    const allSnapshots = fetchedSnapshots.filter((s: any) => {
      const createdDate = new Date(s.created);
      return createdDate >= fortyEightHoursAgo;
    });
    
    console.log(`Found ${allSnapshots.length} snapshots from the last 48 hours`);
    
    // Also show how many have content
    const withContent = allSnapshots.filter((s: any) => s.dataset_size && s.dataset_size > 0);
    console.log(`${withContent.length} snapshots have content (> 0 records)\n`);

    // Display snapshots with content first
    if (withContent.length > 0) {
      console.log('Snapshots WITH CONTENT:');
      console.log('='.repeat(80));
      
      withContent.forEach((snapshot: any, index: number) => {
        const date = new Date(snapshot.created || '').toLocaleString();
        const status = snapshot.status || 'unknown';
        
        console.log(
          `${index + 1}. ${snapshot.id}`,
          `| Status: ${status}`,
          `| Created: ${date}`,
          `| Records: ${snapshot.dataset_size}`
        );
      });
      console.log('='.repeat(80));
    }
    
    // Count by status
    const statusCounts: Record<string, number> = {};
    allSnapshots.forEach((snapshot: any) => {
      const status = snapshot.status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\nStatus summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`- ${status}: ${count} snapshots`);
    });
    console.log('='.repeat(80));

    // Step 2: Check which snapshots are already in our database
    console.log('\n📊 Checking database for existing snapshots...');
    const { data: existingSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('snapshot_id, status, processed_at');

    const existingIds = new Set(
      existingSnapshots?.map((s) => s.snapshot_id) || []
    );

    const newSnapshots = allSnapshots.filter(
      (s: any) => !existingIds.has(s.id)
    );

    // Filter for snapshots with actual content
    const newSnapshotsWithContent = newSnapshots.filter(
      (s: any) => s.dataset_size && s.dataset_size > 0
    );
    const newSnapshotsEmpty = newSnapshots.filter(
      (s: any) => !s.dataset_size || s.dataset_size === 0
    );

    console.log(`\nFound ${newSnapshots.length} snapshots not in database`);
    console.log(`- ${newSnapshotsWithContent.length} with content`);
    console.log(`- ${newSnapshotsEmpty.length} empty`);
    console.log(`Found ${existingIds.size} snapshots already tracked`);

    if (newSnapshotsWithContent.length > 0) {
      console.log('\n📦 New snapshots WITH CONTENT not in database:');
      newSnapshotsWithContent.forEach((s: any) => {
        const date = new Date(s.created || '').toLocaleString();
        console.log(`- ${s.id} (${s.status}) - ${s.dataset_size} records - Created: ${date}`);
      });

      const proceed = await promptUser(
        `\nDo you want to add these ${newSnapshotsWithContent.length} snapshots with content to the database? (y/n): `
      );

      if (proceed.toLowerCase() === 'y') {
        // Add only snapshots with content to database
        for (const snapshot of newSnapshotsWithContent) {
          console.log(`\nAdding snapshot: ${snapshot.id} (${snapshot.dataset_size} records)`);
          
          const { error } = await supabase
            .from('brightdata_snapshots')
            .insert({
              snapshot_id: snapshot.id,
              dataset_id: 'gd_lyy3tktm25m4avu764',
              status: snapshot.status || 'ready',
              created_at: snapshot.created || new Date().toISOString(),
              metadata: {
                result_count: snapshot.dataset_size,
                cost: snapshot.cost,
                file_size: snapshot.file_size,
                recovery_run: true,
                original_status: snapshot.status,
              },
            });

          if (error) {
            console.error(`Error adding snapshot ${snapshot.id}:`, error);
          } else {
            console.log(`✅ Added snapshot ${snapshot.id}`);
          }
        }
      }
    } else if (newSnapshots.length > 0) {
      console.log('\n⚠️ All new snapshots are empty (0 records)');
      console.log('No snapshots with content to add.');
    }

    // Step 3: Offer to process ready snapshots with content
    const readySnapshotsWithContent = allSnapshots.filter(
      (s: any) => s.status === 'ready' && s.dataset_size > 0
    );

    // Check which ones are in database but not processed
    const { data: unprocessedSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('snapshot_id')
      .in('status', ['ready', 'pending'])
      .not('status', 'eq', 'processed');

    const unprocessedWithContent = readySnapshotsWithContent.filter(
      (s: any) => unprocessedSnapshots?.some(u => u.snapshot_id === s.id)
    );

    if (unprocessedWithContent.length > 0) {
      console.log(`\n📦 Found ${unprocessedWithContent.length} unprocessed snapshots with content in database`);
      unprocessedWithContent.forEach((s: any) => {
        console.log(`- ${s.id} - ${s.dataset_size} records`);
      });
      
      const processReady = await promptUser(
        'Do you want to queue these for processing? (y/n): '
      );

      if (processReady.toLowerCase() === 'y') {
        console.log('\n✨ Run the cron job to process them:');
        console.log('curl -X GET https://lounge-ai.up.railway.app/api/cron/process-brightdata-snapshots \\');
        console.log('  -H "Authorization: Bearer YOUR_CRON_SECRET"');
      }
    } else if (readySnapshotsWithContent.length > 0) {
      console.log(`\n✅ All snapshots with content (${readySnapshotsWithContent.length}) are already processed or not in database`);
    }

    console.log('\n✨ Recovery scan complete!');
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
recoverAllSnapshots()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });