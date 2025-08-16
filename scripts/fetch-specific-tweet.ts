import { createClient } from '@supabase/supabase-js';
import { ApifyFetcher } from '../lib/content-fetcher/apify-fetcher';
import { ContentService } from '../lib/services/content-service';
import { getRelevancyService } from '../lib/services/relevancy-service';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fetchSpecificTweet() {
  // Create Supabase service client
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Initialize Apify fetcher
  const apifyFetcher = new ApifyFetcher({
    apiKey: process.env.APIFY_API_KEY!,
  });

  // Initialize content service
  const contentService = new ContentService(supabase);

  // First, let's check if we already have this tweet
  const { data: existingContent } = await supabase
    .from('content')
    .select('*')
    .eq('creator_id', '26be45db-1eea-49ce-91a1-deb2ae92ae81') // Dharmesh's creator ID
    .ilike('description', '%heebie-jeebies%')
    .single();

  if (existingContent) {
    console.log('Tweet already exists in database:');
    console.log(`  ID: ${existingContent.id}`);
    console.log(`  Description: ${existingContent.description}`);
    console.log(`  URL: ${existingContent.url}`);
    console.log(`  Relevancy Score: ${existingContent.relevancy_score}`);
    console.log(
      `  Relevancy Checked At: ${existingContent.relevancy_checked_at}`
    );

    // Delete it so we can re-fetch it
    console.log('\nDeleting existing tweet to re-fetch it...');
    await supabase.from('content').delete().eq('id', existingContent.id);
  }

  // Search for the tweet using Dharmesh's handle and the phrase
  console.log('\nSearching for tweet using search terms...');

  try {
    // Use search to find the specific tweet
    const searchQuery = 'from:dharmesh "heebie-jeebies"';
    console.log(`Search query: ${searchQuery}`);

    const apifyClient = (apifyFetcher as any).client;
    const actor = apifyClient.actor('apidojo/tweet-scraper');

    const run = await actor.call(
      {
        searchTerms: [searchQuery],
        maxItems: 5, // Get a few results to ensure we find it
        sort: 'Latest',
      },
      {
        memory: 1024,
        timeout: 300, // 5 minutes
      }
    );

    if (!run.defaultDatasetId) {
      console.error('No dataset ID returned from Twitter actor');
      process.exit(1);
    }

    // Fetch the results from the dataset
    const { items } = await apifyClient
      .dataset(run.defaultDatasetId)
      .listItems();

    console.log(`\nFound ${items.length} tweets from search`);

    if (items.length === 0) {
      console.log(
        'No tweets found with search. Tweet might be too old or deleted.'
      );
      process.exit(1);
    }

    // Find the heebie-jeebies tweet
    const heebieJeebiesTweet = items.find(
      (item: any) =>
        item.text?.toLowerCase().includes('heebie-jeebies') ||
        item.full_text?.toLowerCase().includes('heebie-jeebies')
    );

    if (!heebieJeebiesTweet) {
      console.log('Could not find the heebie-jeebies tweet.');
      console.log('Tweets found:');
      items.forEach((item: any, index: number) => {
        console.log(`  ${index + 1}. ${item.text || item.full_text}`);
      });
      process.exit(1);
    }

    console.log('\nFound the heebie-jeebies tweet!');
    console.log(
      `  Text: ${heebieJeebiesTweet.text || heebieJeebiesTweet.full_text}`
    );
    console.log(`  URL: ${heebieJeebiesTweet.url}`);
    console.log(`  Created at: ${heebieJeebiesTweet.created_at}`);

    // Transform to our content format
    const transformedContent = {
      platform: 'twitter' as const,
      platform_content_id: heebieJeebiesTweet.id_str || heebieJeebiesTweet.id,
      creator_id: '26be45db-1eea-49ce-91a1-deb2ae92ae81', // Dharmesh's creator ID
      title: `Tweet by @${heebieJeebiesTweet.author?.username || 'dharmesh'}`,
      description: heebieJeebiesTweet.text || heebieJeebiesTweet.full_text,
      url:
        heebieJeebiesTweet.url ||
        `https://twitter.com/dharmesh/status/${heebieJeebiesTweet.id_str || heebieJeebiesTweet.id}`,
      published_at: heebieJeebiesTweet.created_at
        ? new Date(heebieJeebiesTweet.created_at).toISOString()
        : new Date().toISOString(),
      media_type: 'text',
      metadata: {
        likes:
          heebieJeebiesTweet.likeCount ||
          heebieJeebiesTweet.favorite_count ||
          0,
        retweets:
          heebieJeebiesTweet.retweetCount ||
          heebieJeebiesTweet.retweet_count ||
          0,
        replies:
          heebieJeebiesTweet.replyCount || heebieJeebiesTweet.reply_count || 0,
        views:
          heebieJeebiesTweet.viewCount || heebieJeebiesTweet.view_count || 0,
        is_retweet: heebieJeebiesTweet.isRetweet || false,
        is_quote:
          heebieJeebiesTweet.isQuote ||
          heebieJeebiesTweet.is_quote_status ||
          false,
        author: {
          id: heebieJeebiesTweet.author?.id || heebieJeebiesTweet.user?.id_str,
          username:
            heebieJeebiesTweet.author?.username ||
            heebieJeebiesTweet.user?.screen_name ||
            'dharmesh',
          name:
            heebieJeebiesTweet.author?.name ||
            heebieJeebiesTweet.user?.name ||
            'Dharmesh Shah',
          avatar:
            heebieJeebiesTweet.author?.profilePicture ||
            heebieJeebiesTweet.user?.profile_image_url_https,
          verified:
            heebieJeebiesTweet.author?.isVerified ||
            heebieJeebiesTweet.user?.verified ||
            false,
          followers:
            heebieJeebiesTweet.author?.followers ||
            heebieJeebiesTweet.user?.followers_count,
        },
      },
      processing_status: 'processed' as const,
    };

    // Store the content
    console.log('\nStoring content in database...');
    const result = await contentService.storeMultipleContent([
      transformedContent,
    ]);

    console.log(`  Created: ${result.created}`);
    console.log(`  Updated: ${result.updated}`);
    console.log(`  Errors: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.error('Errors:', result.errors);
    }

    // Get the newly created content ID
    const { data: newContent } = await supabase
      .from('content')
      .select('*')
      .eq('creator_id', '26be45db-1eea-49ce-91a1-deb2ae92ae81')
      .ilike('description', '%heebie-jeebies%')
      .single();

    if (newContent) {
      console.log(`\nNew content ID: ${newContent.id}`);

      // Run relevancy check
      const relevancyService = getRelevancyService(supabase);
      if (relevancyService) {
        console.log('\nRunning relevancy check...');
        const relevancyResults =
          await relevancyService.processRelevancyChecks(1);
        console.log('Relevancy check results:', relevancyResults);

        // Check the score
        const { data: scoredContent } = await supabase
          .from('content')
          .select('relevancy_score, relevancy_reason')
          .eq('id', newContent.id)
          .single();

        if (scoredContent) {
          console.log(
            `\nFinal relevancy score: ${scoredContent.relevancy_score}/100`
          );
          console.log(`Reason: ${scoredContent.relevancy_reason}`);
          console.log(
            `Would be deleted: ${scoredContent.relevancy_score < 60 ? 'YES ❌' : 'NO ✅'}`
          );
        }
      }
    }

    console.log('\n✅ Tweet fetched and processed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error fetching tweet:', error);
    process.exit(1);
  }
}

fetchSpecificTweet().catch(console.error);
