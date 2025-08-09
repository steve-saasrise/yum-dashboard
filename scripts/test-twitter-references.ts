import { ApifyClient } from 'apify-client';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function testTwitterReferences() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('APIFY_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const client = new ApifyClient({ token: apiKey });

  // Test with a search that will include quotes and retweets
  // Using a popular account that gets quoted and retweeted often
  const input = {
    searchTerms: ['from:vercel'], // Don't filter out retweets and quotes
    maxItems: 10,
    sort: 'Latest',
  };

  console.log(
    'Testing Twitter scraper WITHOUT filtering retweets and quotes...'
  );
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
      `twitter-references-${Date.now()}.json`
    );
    fs.writeFileSync(outputFile, JSON.stringify(items, null, 2));

    console.log(`\nFetched ${items.length} tweets`);
    console.log(`Raw data saved to: ${outputFile}`);

    // Analyze the structure
    if (items.length > 0) {
      console.log('\n=== First Tweet Structure ===');
      const firstTweet = items[0];
      console.log('Available fields:', Object.keys(firstTweet));

      // Check for quote tweet fields
      if (
        firstTweet.quotedTweet ||
        firstTweet.quoted_status ||
        firstTweet.quotedStatus
      ) {
        console.log('\n✅ Found quoted tweet data!');
        console.log(
          'Quote tweet field:',
          firstTweet.quotedTweet
            ? 'quotedTweet'
            : firstTweet.quoted_status
              ? 'quoted_status'
              : 'quotedStatus'
        );
      }

      // Check for retweet fields
      if (
        firstTweet.retweetedStatus ||
        firstTweet.retweeted_status ||
        firstTweet.retweetedTweet
      ) {
        console.log('\n✅ Found retweet data!');
        console.log(
          'Retweet field:',
          firstTweet.retweetedStatus
            ? 'retweetedStatus'
            : firstTweet.retweeted_status
              ? 'retweeted_status'
              : 'retweetedTweet'
        );
      }

      // Check for reply fields
      if (
        firstTweet.inReplyToStatusId ||
        firstTweet.in_reply_to_status_id ||
        firstTweet.repliedTo
      ) {
        console.log('\n✅ Found reply data!');
        console.log(
          'Reply field:',
          firstTweet.inReplyToStatusId
            ? 'inReplyToStatusId'
            : firstTweet.in_reply_to_status_id
              ? 'in_reply_to_status_id'
              : 'repliedTo'
        );
      }

      // Log a sample tweet for detailed inspection
      console.log('\n=== Sample Tweet (first 500 chars of JSON) ===');
      console.log(
        JSON.stringify(firstTweet, null, 2).substring(0, 500) + '...'
      );
    }

    // Now test with including quotes filter
    console.log('\n\n=== Testing with filter:quote ===');
    const quoteInput = {
      searchTerms: ['from:vercel filter:quote'],
      maxItems: 5,
      sort: 'Latest',
    };

    const quoteRun = await client
      .actor('apidojo/tweet-scraper')
      .call(quoteInput, {
        memory: 1024,
        timeout: 300,
      });

    if (quoteRun.defaultDatasetId) {
      const { items: quoteItems } = await client
        .dataset(quoteRun.defaultDatasetId)
        .listItems();

      console.log(`Fetched ${quoteItems.length} quote tweets`);

      if (quoteItems.length > 0) {
        const quoteFile = path.join(
          outputDir,
          `twitter-quotes-${Date.now()}.json`
        );
        fs.writeFileSync(quoteFile, JSON.stringify(quoteItems, null, 2));
        console.log(`Quote tweets saved to: ${quoteFile}`);
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTwitterReferences().catch(console.error);
