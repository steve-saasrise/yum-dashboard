#!/usr/bin/env tsx

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkSnapshot() {
  const apiKey = process.env.BRIGHTDATA_API_KEY;

  if (!apiKey) {
    console.error('BRIGHTDATA_API_KEY not found');
    process.exit(1);
  }

  // Check specific snapshots - one that worked and one that didn't
  const snapshots = [
    { id: 's_merbpb57y8vm1ramr', name: 'Bernard Marr (2 posts)' },
    { id: 's_merbux861mw385maur', name: 'Neil Patel (0 posts)' },
  ];

  for (const snapshot of snapshots) {
    console.log(`\nChecking ${snapshot.name}: ${snapshot.id}`);

    // Get snapshot metadata
    const metadataUrl = `https://api.brightdata.com/datasets/v3/log/${snapshot.id}`;
    const metadataResponse = await fetch(metadataUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (metadataResponse.ok) {
      const metadata = await metadataResponse.json();
      console.log('Metadata:', JSON.stringify(metadata, null, 2));
    }

    // Get actual data
    const dataUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot.id}?format=json`;
    const dataResponse = await fetch(dataUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (dataResponse.ok) {
      const data = await dataResponse.json();
      console.log(`Data: ${Array.isArray(data) ? data.length : 1} items`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(
          'First item:',
          JSON.stringify(data[0], null, 2).substring(0, 500)
        );
      } else if (!Array.isArray(data)) {
        console.log('Data:', JSON.stringify(data, null, 2).substring(0, 500));
      }
    }
  }
}

checkSnapshot().catch(console.error);
