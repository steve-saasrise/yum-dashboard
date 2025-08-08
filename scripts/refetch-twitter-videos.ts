import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function refetchTwitterVideos() {
  const apiKey = process.env.APIFY_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const fetcher = new ApifyFetcher({ apiKey });
  
  // Get all Twitter creators
  const { data: creators, error: creatorsError } = await supabase
    .from('creators')
    .select('id, display_name')
    .order('display_name');
  
  if (creatorsError || !creators) {
    console.error('Error fetching creators:', creatorsError);
    return;
  }
  
  // Filter to get Twitter creators (those who have Twitter content)
  const { data: twitterCreators } = await supabase
    .from('content')
    .select('creator_id, creators!inner(id, display_name)')
    .eq('platform', 'twitter')
    .limit(1000);
  
  const uniqueCreatorIds = [...new Set(twitterCreators?.map(tc => tc.creator_id) || [])];
  const twitterCreatorsList = creators.filter(c => uniqueCreatorIds.includes(c.id));
  
  console.log(`Found ${twitterCreatorsList.length} Twitter creators to check for videos\n`);
  
  let totalVideosFound = 0;
  
  // Skip creators we already processed
  const skipCreators = [
    'Andy Jankowski', 'Ashley Faus', 'Ben Tossell', 'Bilawal Sidhu', 'Bob Gourley',
    'Catherine Adenle', 'Dan Martell', 'Dave Gerhardt', 'Demis Hassabis', 
    'Gary Marcus', 'Google AI', 'Greg Brockman', 'Hugging Face', 'Jamin Ball'
  ];
  
  for (const creator of twitterCreatorsList) {
    if (skipCreators.includes(creator.display_name)) {
      console.log(`Skipping ${creator.display_name} (already processed)`);
      continue;
    }
    
    // Search for videos from this creator
    const searchTerm = `from:${creator.display_name.replace(/\s+/g, '')} filter:native_video -filter:replies -filter:retweets`;
    
    console.log(`Searching for videos from ${creator.display_name}...`);
    
    try {
      const results = await fetcher.fetchTwitterContent([searchTerm], { maxTweets: 5 });
      
      const withVideos = results.filter(r => 
        r.media_urls?.some(m => m.type === 'video' && m.url?.includes('video.twimg.com'))
      );
      
      if (withVideos.length > 0) {
        console.log(`  Found ${withVideos.length} videos`);
        
        // Insert the video tweets
        for (const tweet of withVideos) {
          tweet.creator_id = creator.id;
          
          const { error } = await supabase
            .from('content')
            .upsert({
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
              processing_status: 'processed'
            }, {
              onConflict: 'platform,platform_content_id'
            });
          
          if (!error) {
            const videoMedia = tweet.media_urls?.find((m: any) => m.type === 'video');
            console.log(`    ✓ ${tweet.url.split('/').pop()}`);
            totalVideosFound++;
          }
        }
      }
    } catch (error) {
      console.log(`  Error fetching: ${error}`);
    }
    
    // Small delay between creators to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\nDone! Found and inserted ${totalVideosFound} videos total.`);
}

refetchTwitterVideos();