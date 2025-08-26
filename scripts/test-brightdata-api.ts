#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { BrightDataFetcher } from '../lib/content-fetcher/brightdata-fetcher';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testBrightDataAPI() {
  const apiKey = process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.error('BRIGHTDATA_API_KEY not found in environment');
    console.error(
      'Available env vars:',
      Object.keys(process.env).filter((k) => k.includes('BRIGHT'))
    );
    process.exit(1);
  }

  console.log(`Using API key: ${apiKey.substring(0, 10)}...`);
  const brightDataFetcher = new BrightDataFetcher({ apiKey });

  // Test profiles - Bernard Marr (working) and Neil Patel (not working)
  const testProfiles = [
    {
      name: 'Bernard Marr',
      url: 'https://www.linkedin.com/in/bernardmarr/',
    },
    {
      name: 'Neil Patel',
      url: 'https://www.linkedin.com/in/neilkpatel/',
    },
  ];

  for (const profile of testProfiles) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${profile.name}`);
    console.log(`URL: ${profile.url}`);
    console.log('='.repeat(60));

    try {
      // Trigger collection with date range
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      const endDate = new Date().toISOString().split('T')[0];

      console.log(`Date range: ${startDate} to ${endDate}`);
      console.log('Triggering collection...');

      const snapshotId = await brightDataFetcher.triggerCollectionOnly(
        [profile.url],
        {
          startDate,
          endDate,
        }
      );

      console.log(`Snapshot ID: ${snapshotId}`);

      // Wait for snapshot to be ready (poll every 5 seconds, max 60 seconds)
      const maxWait = 60000;
      const pollInterval = 5000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        const status = await brightDataFetcher.getSnapshotMetadata(snapshotId);
        console.log(
          `Status: ${status.status}, Result count: ${status.result_count}`
        );

        if (status.status === 'ready') {
          console.log('\nSnapshot ready! Fetching data...');

          // Get the actual data
          const posts =
            await brightDataFetcher.processReadySnapshot(snapshotId);

          console.log(`\nResults: ${posts.length} posts found`);

          if (posts.length > 0) {
            console.log('\nFirst post preview:');
            const firstPost = posts[0];
            console.log(`- Title: ${firstPost.title}`);
            console.log(`- Date: ${firstPost.published_at}`);
            console.log(
              `- Text: ${firstPost.description?.substring(0, 100)}...`
            );
            console.log(`- URL: ${firstPost.url}`);
          }

          // Also get raw snapshot data to see what BrightData returns
          console.log('\nFetching raw snapshot data...');
          const rawEndpoint = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=json`;

          const rawResponse = await fetch(rawEndpoint, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
            },
          });

          if (rawResponse.ok) {
            const rawData = await rawResponse.json();
            console.log(
              `Raw data: ${JSON.stringify(rawData).substring(0, 500)}...`
            );
          }

          break;
        }

        if (status.status === 'failed') {
          console.error('Snapshot failed!');
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    } catch (error) {
      console.error(`Error testing ${profile.name}:`, error);
    }
  }
}

// Run the test
testBrightDataAPI().catch(console.error);
