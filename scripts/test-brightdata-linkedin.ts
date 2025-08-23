#!/usr/bin/env tsx

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { BrightDataFetcher } from '../lib/content-fetcher/brightdata-fetcher';

async function testBrightDataLinkedIn() {
  console.log('Testing BrightData LinkedIn fetcher...\n');

  if (!process.env.BRIGHTDATA_API_KEY) {
    console.error('❌ BRIGHTDATA_API_KEY environment variable not set');
    process.exit(1);
  }

  const fetcher = new BrightDataFetcher({
    apiKey: process.env.BRIGHTDATA_API_KEY,
  });

  // Test with Geoffrey Moore's LinkedIn profile
  const profileUrl = 'https://www.linkedin.com/in/geoffreyamoore/';

  try {
    console.log(`🔍 Fetching LinkedIn content for: ${profileUrl}`);
    console.log('⏳ This may take 2-3 minutes...\n');

    const startTime = Date.now();

    // Fetch with debug output
    const content = await fetcher.fetchLinkedInContent([profileUrl], {
      maxResults: 5, // Just get 5 posts for testing
      startDate: '2025-08-20', // Recent posts
      timeout: 300000, // 5 minutes
      useExistingData: false, // Force new collection
    });

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`\n✅ Fetching completed in ${elapsedTime} seconds`);
    console.log(`📊 Total posts returned: ${content.length}`);

    if (content.length > 0) {
      console.log('\n📝 Sample posts:');
      content.forEach((post, index) => {
        console.log(`\n--- Post ${index + 1} ---`);
        console.log(`ID: ${post.platform_content_id}`);
        console.log(`URL: ${post.url}`);
        console.log(`Title: ${post.title?.substring(0, 100)}...`);
        console.log(`Published: ${post.published_at}`);
        console.log(`Description: ${post.description?.substring(0, 150)}...`);
      });

      // Save full response for inspection
      const outputPath = path.join(
        process.cwd(),
        'brightdata-test-output.json'
      );
      fs.writeFileSync(outputPath, JSON.stringify(content, null, 2));
      console.log(`\n💾 Full response saved to: ${outputPath}`);
    } else {
      console.log('\n⚠️ No posts returned from BrightData');
    }

    // Also test getting existing snapshots
    console.log('\n📦 Checking for existing snapshots...');
    const snapshots = await fetcher.getExistingSnapshots('ready');
    console.log(`Found ${snapshots.length} existing snapshots`);
    if (snapshots.length > 0) {
      console.log('Latest snapshot:', {
        id: snapshots[0].id,
        created: snapshots[0].created,
        status: snapshots[0].status,
      });
    }
  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testBrightDataLinkedIn().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
