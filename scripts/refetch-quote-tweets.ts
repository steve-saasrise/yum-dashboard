import { createClient } from '@supabase/supabase-js';
import { ApifyFetcher } from '../lib/content-fetcher/apify-fetcher';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apifyApiKey = process.env.APIFY_API_KEY!;

if (!supabaseUrl || !supabaseServiceKey || !apifyApiKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function refetchQuoteTweets() {
  console.log('Finding potential quote tweets that need refetching...\n');

  // Find tweets that likely are quote tweets but don't have referenced content
  const { data: potentialQuotes, error } = await supabase
    .from('content')
    .select(
      `
      id,
      platform_content_id,
      url,
      title,
      description,
      creator_id,
      creators!inner(
        id,
        display_name
      )
    `
    )
    .eq('platform', 'twitter')
    .is('reference_type', null)
    .is('referenced_content', null)
    .or(
      'description.like.%https://t.co/%,description.like.%https://twitter.com/%/status/%,description.like.%https://x.com/%/status/%'
    )
    .order('published_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching potential quotes:', error);
    return;
  }

  console.log(`Found ${potentialQuotes?.length || 0} potential quote tweets\n`);

  if (!potentialQuotes || potentialQuotes.length === 0) {
    console.log('No tweets to refetch');
    return;
  }

  // First, get creator URLs to extract usernames
  const creatorIds = [...new Set(potentialQuotes.map((t) => t.creator_id))];
  const { data: creatorUrls } = await supabase
    .from('creator_urls')
    .select('creator_id, url')
    .in('creator_id', creatorIds)
    .eq('platform', 'twitter');

  // Map creator IDs to usernames
  const creatorUsernameMap = new Map<string, string>();
  for (const urlData of creatorUrls || []) {
    const match = urlData.url.match(/(?:x\.com|twitter\.com)\/(@?\w+)/);
    if (match) {
      creatorUsernameMap.set(urlData.creator_id, match[1].replace('@', ''));
    }
  }

  // Group by creator for efficient refetching
  const tweetsByCreator = new Map<string, typeof potentialQuotes>();

  for (const tweet of potentialQuotes) {
    const creatorUsername = creatorUsernameMap.get(tweet.creator_id);
    if (!creatorUsername) {
      console.log(
        `  Warning: No username found for creator ${(tweet.creators as any).display_name}`
      );
      continue;
    }
    if (!tweetsByCreator.has(creatorUsername)) {
      tweetsByCreator.set(creatorUsername, []);
    }
    tweetsByCreator.get(creatorUsername)!.push(tweet);
  }

  console.log(`Grouped into ${tweetsByCreator.size} creators\n`);

  const fetcher = new ApifyFetcher({ apiKey: apifyApiKey });
  let totalUpdated = 0;
  let totalQuotesFound = 0;

  // Process each creator
  for (const [username, tweets] of tweetsByCreator) {
    console.log(`\nProcessing @${username} (${tweets.length} tweets)...`);

    try {
      // Fetch fresh data for this creator
      const freshContent = await fetcher.fetchTwitterContent(
        [`from:${username}`],
        { maxTweets: Math.min(tweets.length * 2, 50) } // Fetch extra to ensure we get all
      );

      console.log(`  Fetched ${freshContent.length} tweets from API`);

      // Match fresh content with our stored tweets
      for (const storedTweet of tweets) {
        const freshTweet = freshContent.find(
          (f) => f.platform_content_id === storedTweet.platform_content_id
        );

        if (
          freshTweet &&
          freshTweet.reference_type === 'quote' &&
          freshTweet.referenced_content
        ) {
          // Found a quote tweet with referenced content!
          console.log(
            `  ✅ Found quote tweet: ${storedTweet.platform_content_id}`
          );
          console.log(
            `     Quoted: @${freshTweet.referenced_content.author?.username}`
          );

          // Update the database
          const { error: updateError } = await supabase
            .from('content')
            .update({
              reference_type: freshTweet.reference_type,
              referenced_content: freshTweet.referenced_content,
              updated_at: new Date().toISOString(),
            })
            .eq('id', storedTweet.id);

          if (updateError) {
            console.error(`     ❌ Failed to update:`, updateError);
          } else {
            totalUpdated++;
            totalQuotesFound++;
          }
        }
      }
    } catch (error) {
      console.error(`  Error processing @${username}:`, error);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total tweets processed: ${potentialQuotes.length}`);
  console.log(`Quote tweets found: ${totalQuotesFound}`);
  console.log(`Database records updated: ${totalUpdated}`);
}

refetchQuoteTweets().catch(console.error);
