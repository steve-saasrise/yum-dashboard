import { ApifyFetcher } from '../lib/content-fetcher/apify-fetcher';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const apifyApiKey = process.env.APIFY_API_KEY!;

async function checkGaryQuote() {
  const fetcher = new ApifyFetcher({ apiKey: apifyApiKey });

  // Fetch recent tweets from Gary Marcus
  console.log('Fetching recent tweets from @GaryMarcus...');
  const tweets = await fetcher.fetchTwitterContent(['from:GaryMarcus'], {
    maxTweets: 20,
  });

  console.log(`Fetched ${tweets.length} tweets\n`);

  // Find the specific tweet
  const targetTweet = tweets.find(
    (t) =>
      t.platform_content_id === '1954027179043369294' ||
      t.description?.includes('I often (not always) agree with @miles_brundage')
  );

  if (targetTweet) {
    console.log('✅ Found the tweet!');
    console.log('Tweet ID:', targetTweet.platform_content_id);
    console.log(
      'Text preview:',
      targetTweet.description?.substring(0, 100) + '...'
    );
    console.log('Reference type:', targetTweet.reference_type || 'NONE');
    console.log('Has referenced content:', !!targetTweet.referenced_content);

    if (targetTweet.referenced_content) {
      console.log('\n📎 QUOTED TWEET:');
      console.log('  Author:', targetTweet.referenced_content.author?.username);
      console.log(
        '  Text:',
        targetTweet.referenced_content.text?.substring(0, 100) + '...'
      );
    } else {
      console.log('\n❌ NO QUOTED CONTENT FOUND');
      console.log(
        'This tweet appears to be a regular tweet, not a quote tweet.'
      );
    }
  } else {
    console.log('❌ Tweet not found in recent timeline');
    console.log('Available tweets:');
    tweets.forEach((t) => {
      console.log(
        `  - ${t.platform_content_id}: ${t.description?.substring(0, 50)}...`
      );
    });
  }
}

checkGaryQuote().catch(console.error);
