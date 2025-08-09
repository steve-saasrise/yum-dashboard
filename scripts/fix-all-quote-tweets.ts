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

async function fixAllQuoteTweets() {
  console.log('🔍 Finding ALL Twitter content to check for quote tweets...\n');

  // Get ALL Twitter content
  const { data: allTweets, error } = await supabase
    .from('content')
    .select(
      `
      id,
      platform_content_id,
      url,
      title,
      description,
      creator_id,
      reference_type,
      referenced_content,
      creators!inner(
        id,
        display_name
      )
    `
    )
    .eq('platform', 'twitter')
    .order('published_at', { ascending: false });

  if (error) {
    console.error('Error fetching tweets:', error);
    return;
  }

  console.log(`Found ${allTweets?.length || 0} total Twitter posts\n`);

  // Filter to only those without reference data
  const tweetsToCheck = allTweets?.filter((t) => !t.reference_type) || [];
  console.log(
    `${tweetsToCheck.length} tweets need to be checked for quote content\n`
  );

  if (tweetsToCheck.length === 0) {
    console.log('✅ All tweets already have reference data!');
    return;
  }

  // Get creator URLs to extract usernames
  const creatorIds = [...new Set(tweetsToCheck.map((t) => t.creator_id))];
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

  // Group by creator for efficient fetching
  const tweetsByCreator = new Map<string, typeof tweetsToCheck>();

  for (const tweet of tweetsToCheck) {
    const creatorUsername = creatorUsernameMap.get(tweet.creator_id);
    if (!creatorUsername) {
      console.log(
        `  ⚠️  No username found for creator ${(tweet.creators as any).display_name}`
      );
      continue;
    }
    if (!tweetsByCreator.has(creatorUsername)) {
      tweetsByCreator.set(creatorUsername, []);
    }
    tweetsByCreator.get(creatorUsername)!.push(tweet);
  }

  console.log(`Grouped into ${tweetsByCreator.size} creators\n`);
  console.log('='.repeat(60) + '\n');

  const fetcher = new ApifyFetcher({ apiKey: apifyApiKey });
  let totalUpdated = 0;
  let totalQuotesFound = 0;
  let creatorIndex = 0;

  // Process each creator
  for (const [username, tweets] of tweetsByCreator) {
    creatorIndex++;
    console.log(
      `[${creatorIndex}/${tweetsByCreator.size}] Processing @${username} (${tweets.length} tweets to check)...`
    );

    try {
      // Fetch more tweets to ensure we get all the ones we need
      const maxTweets = Math.min(tweets.length * 3, 100); // Fetch 3x as many, max 100
      const freshContent = await fetcher.fetchTwitterContent(
        [`from:${username}`],
        { maxTweets }
      );

      console.log(`  ↓ Fetched ${freshContent.length} tweets from API`);

      let foundQuotesForCreator = 0;

      // Match fresh content with our stored tweets
      for (const storedTweet of tweets) {
        const freshTweet = freshContent.find(
          (f) => f.platform_content_id === storedTweet.platform_content_id
        );

        if (freshTweet) {
          // Check if it's a quote tweet
          if (
            freshTweet.reference_type === 'quote' &&
            freshTweet.referenced_content
          ) {
            console.log(
              `  ✅ Found quote tweet: "${storedTweet.description?.substring(0, 50)}..."`
            );
            console.log(
              `     → Quotes @${freshTweet.referenced_content.author?.username}: "${freshTweet.referenced_content.text?.substring(0, 50)}..."`
            );

            foundQuotesForCreator++;

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
          } else if (freshTweet.reference_type) {
            // It's a reply or something else
            console.log(
              `  ℹ️  Found ${freshTweet.reference_type}: "${storedTweet.description?.substring(0, 50)}..."`
            );
          }
        } else {
          // Tweet not found in fresh fetch - might be too old or deleted
          // console.log(`  ⚠️  Tweet not in recent timeline: ${storedTweet.platform_content_id}`);
        }
      }

      if (foundQuotesForCreator > 0) {
        console.log(
          `  📊 Found ${foundQuotesForCreator} quote tweets for @${username}\n`
        );
      } else {
        console.log(`  📊 No quote tweets found for @${username}\n`);
      }

      // Add a small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ❌ Error processing @${username}:`, error);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log('\n🎉 === FINAL SUMMARY ===');
  console.log(`Total tweets checked: ${tweetsToCheck.length}`);
  console.log(`Quote tweets found: ${totalQuotesFound}`);
  console.log(`Database records updated: ${totalUpdated}`);
  console.log('\n✅ Complete!');
}

fixAllQuoteTweets().catch(console.error);
