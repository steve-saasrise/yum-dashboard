import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function fetchTwitterVideos() {
  const apiKey = process.env.APIFY_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const fetcher = new ApifyFetcher({ apiKey });

  // NASA often posts videos
  const searchTerms = [
    'from:NASA filter:native_video -filter:replies -filter:retweets',
  ];

  console.log('Fetching Twitter videos with search:', searchTerms[0]);

  try {
    const results = await fetcher.fetchTwitterContent(searchTerms, {
      maxTweets: 10,
    });

    console.log(`\nFetched ${results.length} tweets\n`);

    const withVideos = results.filter((r) =>
      r.media_urls?.some((m) => m.type === 'video')
    );

    console.log(`Found ${withVideos.length} tweets with videos\n`);

    if (withVideos.length > 0) {
      // Get or create NASA creator
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('id')
        .eq("metadata->>'platform'", 'twitter')
        .eq("metadata->>'username'", 'NASA')
        .single();

      let creatorId: string;

      if (creatorError || !creator) {
        console.log('Creating NASA creator...');
        const { data: newCreator, error: createError } = await supabase
          .from('creators')
          .insert({
            display_name: 'NASA',
            bio: 'NASA explores the unknown in air and space, innovates for the benefit of humanity, and inspires the world through discovery.',
            avatar_url:
              'https://pbs.twimg.com/profile_images/1321163587679784960/0ZxKlEKB_400x400.jpg',
            verified: true,
            follower_count: 98000000,
            status: 'active',
            metadata: {
              platform: 'twitter',
              username: 'NASA',
              platform_user_id: '11348282',
              profile_url: 'https://x.com/NASA',
            },
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating creator:', createError);
          return;
        }

        creatorId = newCreator.id;
        console.log('Created NASA creator with ID:', creatorId);
      } else {
        creatorId = creator.id;
        console.log('Using existing NASA creator with ID:', creatorId);
      }

      // Insert the video tweets
      for (const tweet of withVideos) {
        tweet.creator_id = creatorId;

        const { data, error } = await supabase
          .from('content')
          .upsert(
            {
              creator_id: tweet.creator_id,
              platform: tweet.platform,
              platform_content_id: tweet.platform_content_id,
              url: tweet.url,
              title: tweet.title,
              description: tweet.description,
              content_body: tweet.content_body,
              published_at: tweet.published_at,
              media_urls: tweet.media_urls,
              engagement_metrics: tweet.engagement_metrics,
              processing_status: 'processed',
            },
            {
              onConflict: 'platform,platform_content_id',
            }
          )
          .select();

        if (error) {
          console.error('Error inserting tweet:', error);
        } else {
          const videoMedia = tweet.media_urls?.find(
            (m: any) => m.type === 'video'
          );
          console.log(`✓ Inserted tweet with video: ${tweet.url}`);
          if (videoMedia) {
            console.log(`  Video URL: ${videoMedia.url}`);
          }
        }
      }

      console.log('\nDone! You can now view the videos in your dashboard.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchTwitterVideos();
