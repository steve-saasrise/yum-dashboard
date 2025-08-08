import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testTwitterVideo() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('APIFY_API_KEY not found in environment variables');
    process.exit(1);
  }

  const fetcher = new ApifyFetcher({ apiKey });

  // Test with a known Twitter video post
  // Using NASA as they often post videos
  const testUrls = [
    'from:NASA filter:native_video -filter:replies -filter:retweets',
  ];

  console.log('Testing Twitter video fetch with search:', testUrls[0]);

  try {
    // First, let's use the actual Apify client to see raw data
    const { ApifyClient } = require('apify-client');
    const client = new ApifyClient({ token: apiKey });

    const input = {
      searchTerms: testUrls,
      maxItems: 5,
      sort: 'Latest',
      includeSearchTerms: false,
    };

    console.log('Running Apify actor with input:', input);

    const run = await client.actor('apidojo/tweet-scraper').call(input, {
      memory: 1024,
      timeout: 300,
    });

    if (!run.defaultDatasetId) {
      console.error('No dataset ID returned');
      return;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    console.log(`\nFound ${items.length} tweets\n`);

    // Look for tweets with videos
    const tweetsWithVideos = items.filter((tweet: any) => {
      return tweet.extendedEntities?.media?.some(
        (m: any) => m.type === 'video' || m.type === 'animated_gif'
      );
    });

    console.log(`Found ${tweetsWithVideos.length} tweets with videos\n`);

    if (tweetsWithVideos.length > 0) {
      const firstVideoTweet = tweetsWithVideos[0];
      console.log('First tweet with video:');
      console.log('Tweet URL:', firstVideoTweet.url);
      console.log(
        'Tweet text:',
        firstVideoTweet.text?.substring(0, 100) + '...'
      );

      const videoMedia = firstVideoTweet.extendedEntities.media.find(
        (m: any) => m.type === 'video' || m.type === 'animated_gif'
      );

      console.log('\nVideo media object:');
      console.log(JSON.stringify(videoMedia, null, 2));

      if (videoMedia?.video_info?.variants) {
        console.log('\nVideo variants:');
        videoMedia.video_info.variants.forEach((v: any, i: number) => {
          console.log(`  Variant ${i + 1}:`);
          console.log(`    Content-Type: ${v.content_type}`);
          console.log(`    Bitrate: ${v.bitrate || 'N/A'}`);
          console.log(`    URL: ${v.url}`);
        });
      }
    } else {
      console.log('No tweets with videos found. Showing first tweet:');
      if (items.length > 0) {
        console.log(
          'Tweet:',
          JSON.stringify(items[0], null, 2).substring(0, 1000) + '...'
        );
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTwitterVideo();
