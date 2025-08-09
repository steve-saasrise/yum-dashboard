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

async function refetchTweetsWithLinks() {
  console.log(
    'Finding tweets with links to refetch for link preview data...\n'
  );

  // Find tweets that contain links
  const { data: tweetsWithLinks, error } = await supabase
    .from('content')
    .select(
      `
      id,
      platform_content_id,
      url,
      title,
      description,
      content_body,
      creator_id,
      media_urls,
      creators!inner(
        id,
        display_name
      )
    `
    )
    .eq('platform', 'twitter')
    .or('content_body.like.%http%,content_body.like.%t.co%')
    .order('published_at', { ascending: false })
    .limit(20); // Process 20 at a time to avoid rate limits

  if (error) {
    console.error('Error fetching tweets with links:', error);
    return;
  }

  console.log(`Found ${tweetsWithLinks?.length || 0} tweets with links\n`);

  if (!tweetsWithLinks || tweetsWithLinks.length === 0) {
    console.log('No tweets to refetch');
    return;
  }

  // Check if any already have link preview data
  const tweetsNeedingRefetch = tweetsWithLinks.filter((tweet) => {
    const hasLinkPreview = tweet.media_urls?.some(
      (m: any) => m.type === 'link_preview'
    );
    return !hasLinkPreview;
  });

  console.log(`${tweetsNeedingRefetch.length} tweets need link preview data\n`);

  if (tweetsNeedingRefetch.length === 0) {
    console.log('All tweets already have link preview data');
    return;
  }

  // Get creator URLs to extract usernames
  const creatorIds = [
    ...new Set(tweetsNeedingRefetch.map((t) => t.creator_id)),
  ];
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
  const tweetsByCreator = new Map<string, typeof tweetsNeedingRefetch>();

  for (const tweet of tweetsNeedingRefetch) {
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
  let linkPreviewsFound = 0;

  // Process each creator
  for (const [username, tweets] of tweetsByCreator) {
    console.log(`\nProcessing @${username} (${tweets.length} tweets)...`);

    try {
      // Fetch fresh data for this creator
      const freshContent = await fetcher.fetchTwitterContent(
        [`from:${username}`],
        { maxTweets: Math.min(tweets.length * 2, 50) }
      );

      console.log(`  Fetched ${freshContent.length} tweets from API`);

      // Match fresh content with our stored tweets
      for (const storedTweet of tweets) {
        const freshTweet = freshContent.find(
          (f) => f.platform_content_id === storedTweet.platform_content_id
        );

        if (freshTweet && freshTweet.media_urls) {
          // Check if fresh tweet has link preview data
          const linkPreviews = freshTweet.media_urls.filter(
            (m: any) => m.type === 'link_preview'
          );

          if (linkPreviews.length > 0) {
            console.log(
              `  ✅ Found link preview data for: ${storedTweet.platform_content_id}`
            );
            linkPreviews.forEach((preview: any) => {
              console.log(`     - ${preview.link_title || preview.link_url}`);
            });

            // Update the database with new media_urls that include link previews
            const { error: updateError } = await supabase
              .from('content')
              .update({
                media_urls: freshTweet.media_urls,
                updated_at: new Date().toISOString(),
              })
              .eq('id', storedTweet.id);

            if (updateError) {
              console.error(`     ❌ Failed to update:`, updateError);
            } else {
              totalUpdated++;
              linkPreviewsFound += linkPreviews.length;
            }
          } else {
            console.log(
              `  ⚠️  No link preview data found for: ${storedTweet.platform_content_id}`
            );
          }
        }
      }
    } catch (error) {
      console.error(`  Error processing @${username}:`, error);
    }

    // Add a small delay between creators to avoid rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n=== Summary ===');
  console.log(`Total tweets processed: ${tweetsNeedingRefetch.length}`);
  console.log(`Link previews found: ${linkPreviewsFound}`);
  console.log(`Database records updated: ${totalUpdated}`);
}

refetchTweetsWithLinks().catch(console.error);
