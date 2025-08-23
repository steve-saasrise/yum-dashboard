#!/usr/bin/env tsx
/**
 * Debug script to see raw content from a BrightData snapshot
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function debugSnapshot(snapshotId: string) {
  console.log(`🔍 Debugging BrightData snapshot: ${snapshotId}\n`);

  if (!process.env.BRIGHTDATA_API_KEY) {
    console.error('❌ BRIGHTDATA_API_KEY not configured');
    process.exit(1);
  }

  try {
    // Download the raw snapshot data
    const endpoint = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
    const url = `${endpoint}?format=json`;
    
    console.log(`📥 Downloading from: ${url}\n`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to download snapshot: ${response.status}`);
      console.error(errorText);
      return;
    }

    const data = await response.json();
    
    console.log(`✅ Downloaded snapshot data\n`);
    console.log('Raw data structure:');
    console.log('='.repeat(80));
    
    // Show the structure
    if (Array.isArray(data)) {
      console.log(`Data is an array with ${data.length} items\n`);
      
      if (data.length > 0) {
        console.log('First item structure:');
        console.log(JSON.stringify(data[0], null, 2));
        
        // Save to file for inspection
        const outputPath = path.join(
          process.cwd(),
          `snapshot-${snapshotId}-debug.json`
        );
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`\n💾 Full data saved to: ${outputPath}`);
        
        // Check for required fields
        console.log('\n📋 Field analysis:');
        data.forEach((item: any, index: number) => {
          console.log(`\nItem ${index + 1}:`);
          console.log(`- Has id: ${!!item.id}`);
          console.log(`- Has url: ${!!item.url}`);
          console.log(`- Has content: ${!!item.content}`);
          console.log(`- Has description: ${!!item.description}`);
          console.log(`- Has creator_name: ${!!item.creator_name}`);
          console.log(`- Has creator_url: ${!!item.creator_url}`);
          console.log(`- URL value: ${item.url || 'MISSING'}`);
        });
      }
    } else {
      console.log('Data is not an array:', typeof data);
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get snapshot ID from command line
const snapshotId = process.argv[2] || 's_meoje189itkmbeamv';

debugSnapshot(snapshotId)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });