import { ApifyFetcher } from '../lib/content-fetcher/apify-fetcher';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

async function testTwitterReferencesIntegration() {
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    console.error('APIFY_API_KEY is not set in .env.local');
    process.exit(1);
  }

  const fetcher = new ApifyFetcher({ apiKey });

  // Test with a search that will include quotes
  // Using a popular account that often quotes and gets quoted
  const urls = ['from:vercel'];

  console.log('Testing Twitter fetcher with reference support...');
  console.log('URLs:', urls);

  try {
    const content = await fetcher.fetchTwitterContent(urls, { maxTweets: 20 });

    // Save results for analysis
    const outputDir = path.join(process.cwd(), 'test-outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const outputFile = path.join(
      outputDir,
      `twitter-integration-${Date.now()}.json`
    );
    fs.writeFileSync(outputFile, JSON.stringify(content, null, 2));

    console.log(`\nFetched ${content.length} items`);
    console.log(`Results saved to: ${outputFile}`);

    // Analyze the results
    const quoteTweets = content.filter(
      (item) => item.reference_type === 'quote'
    );
    const replies = content.filter((item) => item.reference_type === 'reply');
    const regular = content.filter((item) => !item.reference_type);

    console.log('\n=== Content Analysis ===');
    console.log(`Regular tweets: ${regular.length}`);
    console.log(`Quote tweets: ${quoteTweets.length}`);
    console.log(`Replies: ${replies.length}`);

    if (quoteTweets.length > 0) {
      console.log('\n=== First Quote Tweet ===');
      const firstQuote = quoteTweets[0];
      console.log(
        'Main tweet:',
        firstQuote.description?.substring(0, 100) + '...'
      );
      console.log('Reference type:', firstQuote.reference_type);
      if (firstQuote.referenced_content) {
        console.log(
          'Quoted tweet author:',
          firstQuote.referenced_content.author?.username
        );
        console.log(
          'Quoted tweet text:',
          firstQuote.referenced_content.text?.substring(0, 100) + '...'
        );
        console.log(
          'Quoted tweet has media:',
          (firstQuote.referenced_content.media_urls?.length || 0) > 0
        );
      }
    }

    if (replies.length > 0) {
      console.log('\n=== First Reply ===');
      const firstReply = replies[0];
      console.log(
        'Main tweet:',
        firstReply.description?.substring(0, 100) + '...'
      );
      console.log('Reference type:', firstReply.reference_type);
      if (firstReply.referenced_content) {
        console.log(
          'Replying to:',
          firstReply.referenced_content.author?.username
        );
      }
    }

    // Check data structure
    console.log('\n=== Data Structure Check ===');
    const sampleItem = content[0];
    if (sampleItem) {
      console.log('Fields present in content item:');
      console.log(
        '- Basic fields:',
        ['id', 'title', 'description', 'url', 'platform'].every(
          (field) => field in sampleItem
        )
          ? '✅'
          : '❌'
      );
      console.log('- Media:', 'media_urls' in sampleItem ? '✅' : '❌');
      console.log(
        '- Engagement:',
        'engagement_metrics' in sampleItem ? '✅' : '❌'
      );
      console.log(
        '- Reference fields:',
        'reference_type' in sampleItem || 'referenced_content' in sampleItem
          ? '✅'
          : '❌'
      );
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testTwitterReferencesIntegration().catch(console.error);
