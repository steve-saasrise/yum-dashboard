import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testTransform() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('APIFY_API_KEY not found in environment variables');
    process.exit(1);
  }

  const fetcher = new ApifyFetcher({ apiKey });

  // Test with a search that will return videos
  const testUrls = [
    'from:NASA filter:native_video -filter:replies -filter:retweets',
  ];

  console.log('Testing transformation with search:', testUrls[0]);

  try {
    // Use the fetcher's transform method
    const results = await fetcher.fetchTwitterContent(testUrls, {
      maxTweets: 5,
    });

    console.log(`\nTransformed ${results.length} tweets\n`);

    // Check for videos in the transformed results
    const withVideos = results.filter((r) =>
      r.media_urls?.some((m) => m.type === 'video')
    );

    console.log(
      `Found ${withVideos.length} tweets with videos after transformation\n`
    );

    if (withVideos.length > 0) {
      const first = withVideos[0];
      console.log('First transformed tweet with video:');
      console.log('URL:', first.url);
      console.log('Media URLs:', JSON.stringify(first.media_urls, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTransform();
