import { createClient } from '@supabase/supabase-js';
import { ApifyFetcher } from '../lib/content-fetcher/apify-fetcher';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateCreatorAvatars() {
  try {
    // Get all creators without avatars who have X or LinkedIn URLs
    const { data: creators, error } = await supabase
      .from('creators')
      .select(`
        id,
        display_name,
        avatar_url,
        creator_urls!inner(
          url,
          platform
        )
      `)
      .or('avatar_url.is.null,avatar_url.eq.')
      .in('creator_urls.platform', ['twitter', 'linkedin']);

    if (error) {
      console.error('Error fetching creators:', error);
      return;
    }

    console.log(`Found ${creators?.length || 0} creators without avatars`);

    if (!creators || creators.length === 0) {
      console.log('No creators need avatar updates');
      return;
    }

    const apifyFetcher = new ApifyFetcher({ 
      apiKey: process.env.APIFY_API_KEY! 
    });

    for (const creator of creators) {
      console.log(`\nProcessing: ${creator.display_name}`);
      
      // Get the first X or LinkedIn URL
      const twitterUrl = creator.creator_urls.find((u: any) => u.platform === 'twitter');
      const linkedinUrl = creator.creator_urls.find((u: any) => u.platform === 'linkedin');
      
      let avatarUrl: string | null = null;
      
      try {
        if (twitterUrl) {
          console.log(`  Fetching from X/Twitter: ${twitterUrl.url}`);
          
          // Fetch just 1 tweet to get author info
          await apifyFetcher.fetchTwitterContent([twitterUrl.url], { maxTweets: 1 });
          
          const authorInfo = apifyFetcher.getExtractedAuthors();
          if (authorInfo.length > 0 && authorInfo[0].avatar_url) {
            avatarUrl = authorInfo[0].avatar_url;
            console.log(`  Found avatar from Twitter: ${avatarUrl}`);
          }
        } else if (linkedinUrl) {
          console.log(`  Fetching from LinkedIn: ${linkedinUrl.url}`);
          
          // Fetch just 1 post to get author info
          await apifyFetcher.fetchLinkedInContent([linkedinUrl.url], { maxResults: 1 });
          
          const authorInfo = apifyFetcher.getExtractedAuthors();
          if (authorInfo.length > 0 && authorInfo[0].avatar_url) {
            avatarUrl = authorInfo[0].avatar_url;
            console.log(`  Found avatar from LinkedIn: ${avatarUrl}`);
          }
        }
        
        if (avatarUrl) {
          // Update the creator's avatar
          const { error: updateError } = await supabase
            .from('creators')
            .update({
              avatar_url: avatarUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', creator.id);
          
          if (updateError) {
            console.error(`  Error updating avatar:`, updateError);
          } else {
            console.log(`  ✅ Successfully updated avatar!`);
          }
        } else {
          console.log(`  ⚠️ No avatar found in fetched content`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`  Error processing ${creator.display_name}:`, error);
      }
    }
    
    console.log('\n✅ Avatar update complete!');
    
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the update
updateCreatorAvatars();