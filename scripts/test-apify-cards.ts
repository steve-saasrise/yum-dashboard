import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apifyApiKey = process.env.APIFY_API_KEY!;

if (!apifyApiKey) {
  console.error('Missing APIFY_API_KEY');
  process.exit(1);
}

async function testApifyCards() {
  const client = new ApifyClient({ token: apifyApiKey });

  // Test with a tweet that has a link
  const input = {
    searchTerms: ['from:ttunguz -filter:replies -filter:retweets'],
    maxItems: 2,
    sort: 'Latest',
  };

  console.log('Fetching tweets with potential link cards...\n');

  try {
    const run = await client.actor('apidojo/tweet-scraper').call(input, {
      memory: 1024,
      timeout: 300,
    });

    if (!run.defaultDatasetId) {
      console.error('No dataset ID returned');
      return;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    for (const tweet of items) {
      console.log('='.repeat(80));
      console.log('Tweet ID:', tweet.id);
      console.log('Text:', (tweet as any).text?.substring(0, 100) + '...');

      // Check for card data
      if ((tweet as any).card) {
        console.log('\n📇 Card found:');
        console.log('  Name:', (tweet as any).card.name);
        console.log('  URL:', (tweet as any).card.url);

        if ((tweet as any).card.binding_values || (tweet as any).card.values) {
          const values =
            (tweet as any).card.binding_values || (tweet as any).card.values;
          console.log('\n  Card Values:');

          for (const [key, value] of Object.entries(values)) {
            if (typeof value === 'object' && value !== null) {
              console.log(`    ${key}:`, JSON.stringify(value, null, 2));
            } else {
              console.log(`    ${key}:`, value);
            }
          }
        }
      } else {
        console.log('\n❌ No card data');
      }

      // Check for entities.urls
      if ((tweet as any).entities?.urls) {
        console.log('\n🔗 URLs in entities:');
        for (const url of (tweet as any).entities.urls) {
          console.log('  - Expanded:', url.expanded_url);
          console.log('    Display:', url.display_url);
          if (url.title) console.log('    Title:', url.title);
          if (url.description) console.log('    Description:', url.description);
          if (url.images) console.log('    Images:', url.images);
        }
      }

      console.log();
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testApifyCards().catch(console.error);
