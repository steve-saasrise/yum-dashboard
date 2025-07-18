import { createClient } from '@supabase/supabase-js';
import { RSSFetcher } from '../lib/content-fetcher/rss-fetcher';
import { ContentService } from '../lib/services/content-service';
import { ContentNormalizer } from '../lib/services/content-normalizer';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for admin access
);

async function populateRSSContent() {
  try {
    console.log('Fetching RSS creators...');

    // Get all RSS creators
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        user_id,
        creator_urls!inner(
          url,
          platform
        )
      `
      )
      .eq('creator_urls.platform', 'rss');

    if (creatorsError) {
      console.error('Error fetching creators:', creatorsError);
      return;
    }

    console.log(`Found ${creators?.length || 0} RSS creators`);

    if (!creators || creators.length === 0) {
      console.log('No RSS creators found');
      return;
    }

    // Initialize services
    const rssFetcher = new RSSFetcher();
    const contentService = new ContentService(supabase);
    const normalizer = new ContentNormalizer();

    // Process each creator
    for (const creator of creators) {
      console.log(`\nProcessing creator: ${creator.display_name}`);

      for (const urlData of creator.creator_urls) {
        console.log(`  Fetching RSS from: ${urlData.url}`);

        try {
          // Fetch RSS content
          const result = await rssFetcher.parseURL(urlData.url);

          if (!result.success || !result.feed) {
            console.error(`  Failed to fetch RSS: ${result.error}`);
            continue;
          }

          console.log(`  Found ${result.feed.items.length} items`);

          // Normalize and store each item
          const normalizedItems = normalizer.normalizeMultiple(
            creator.id,
            'rss',
            result.feed.items,
            urlData.url
          );

          // Store content in batches
          const batchResult =
            await contentService.storeMultipleContent(normalizedItems);

          console.log(`  Stored: ${batchResult.created} new items`);
          console.log(`  Updated: ${batchResult.updated} existing items`);
          console.log(`  Skipped: ${batchResult.skipped} duplicate items`);

          if (batchResult.errors.length > 0) {
            console.error(`  Errors:`, batchResult.errors);
          }
        } catch (error) {
          console.error(`  Error processing ${urlData.url}:`, error);
        }
      }
    }

    console.log('\nRSS content population complete!');
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

// Run the script
populateRSSContent();
