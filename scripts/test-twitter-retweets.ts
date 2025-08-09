import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function testTwitterRetweets() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('APIFY_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });

  // Test search that includes retweets - search for tweets about vercel without filtering
  const input = {
    searchTerms: ['vercel'], // This will include retweets about vercel
    maxItems: 20,
    sort: 'Latest',
  };

  console.log('Testing Twitter scraper to find retweets...');
  console.log('Input:', JSON.stringify(input, null, 2));

  try {
    const run = await client.actor('apidojo/tweet-scraper').call(input, {
      memory: 1024,
      timeout: 300,
    });

    if (!run.defaultDatasetId) {
      console.error('No dataset ID returned from Twitter actor');
      return;
    }

    const { items } = await client.dataset(run.defaultDatasetId).listItems();

    // Save raw results for analysis
    const outputDir = path.join(process.cwd(), 'test-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputFile = path.join(
      outputDir,
      `twitter-retweets-${Date.now()}.json`
    );
    fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));

    console.log(`\nFetched ${items.length} tweets`);
    console.log(`Raw data saved to: ${outputFile}`);

    // Find retweets
    const retweets = items.filter((item: any) => item.isRetweet === true);
    const quotes = items.filter((item: any) => item.isQuote === true);
    const replies = items.filter((item: any) => item.isReply === true);

    console.log(`\nFound ${retweets.length} retweets`);
    console.log(`Found ${quotes.length} quote tweets`);
    console.log(`Found ${replies.length} replies`);

    if (retweets.length > 0) {
      console.log('\n=== First Retweet Structure ===');
      const firstRetweet = retweets[0];
      console.log('Available fields:', Object.keys(firstRetweet));

      // Check for retweeted status
      if (
        firstRetweet.retweetedStatus ||
        firstRetweet.retweeted_status ||
        firstRetweet.retweet
      ) {
        console.log('\n✅ Found retweeted tweet data!');
        const retweetField = firstRetweet.retweetedStatus
          ? 'retweetedStatus'
          : firstRetweet.retweeted_status
            ? 'retweeted_status'
            : 'retweet';
        console.log('Retweet field:', retweetField);
        console.log(
          'Retweeted data keys:',
          Object.keys(firstRetweet[retweetField] as any)
        );
      } else {
        console.log(
          '\n❌ No nested retweet data found, but tweet is marked as retweet'
        );
      }
    }

    if (quotes.length > 0) {
      console.log('\n=== Quote Tweet Structure ===');
      const firstQuote = quotes[0];
      if (firstQuote.quote) {
        console.log(
          '✅ Quote field found with keys:',
          Object.keys(firstQuote.quote)
        );
      }
    }

    if (replies.length > 0) {
      console.log('\n=== Reply Structure ===');
      const firstReply = replies[0];
      console.log('Reply fields:');
      console.log('  - inReplyToId:', firstReply.inReplyToId);
      console.log('  - inReplyToUserId:', firstReply.inReplyToUserId);
      console.log('  - inReplyToUsername:', firstReply.inReplyToUsername);
      console.log('  - conversationId:', firstReply.conversationId);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTwitterRetweets().catch(console.error);
