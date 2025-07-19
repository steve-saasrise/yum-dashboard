import { NextRequest, NextResponse } from 'next/server';
import createSupabaseSsr from '@/lib/supabase';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import type { CreateContentInput } from '@/types/content';

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = createSupabaseSsr();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentService = new ContentService(supabase);
    const rssFetcher = new RSSFetcher();
    const stats = {
      processed: 0,
      new: 0,
      updated: 0,
      errors: 0,
      creators: [] as any[],
    };

    // Get user's RSS creators
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        name,
        creator_urls!inner (
          url,
          platform
        )
      `
      )
      .eq('creator_urls.platform', 'rss')
      .eq('is_active', true)
      .eq('user_id', user.id); // Only fetch user's creators

    if (creatorsError) {
      console.error('Error fetching creators:', creatorsError);
      return NextResponse.json(
        { error: 'Failed to fetch creators', details: creatorsError },
        { status: 500 }
      );
    }

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        message: 'No active RSS creators found',
        stats,
      });
    }

    // Process each creator's RSS feeds
    for (const creator of creators) {
      const creatorStats = {
        id: creator.id,
        name: creator.name,
        urls: [] as any[],
      };

      for (const creatorUrl of creator.creator_urls) {
        try {
          console.log(
            `Fetching RSS feed for ${creator.name}: ${creatorUrl.url}`
          );

          // Fetch RSS feed
          const result = await rssFetcher.parseURL(creatorUrl.url);

          if (!result.success || !result.feed || !result.feed.items || result.feed.items.length === 0) {
            creatorStats.urls.push({
              url: creatorUrl.url,
              status: 'empty',
              message: result.error || 'No items in feed',
            });
            continue;
          }

          // Normalize and store each item (limit to 10 for manual refresh)
          const items = result.feed.items.slice(0, 10);
          const normalizedItems: CreateContentInput[] = items.map((item) => {
            const normalizer = new ContentNormalizer();
            return normalizer.normalize({
              platform: 'rss',
              platformData: item,
              creator_id: creator.id,
              sourceUrl: creatorUrl.url
            });
          });

          // Store content using the service
          const results = await contentService.storeMultipleContent(normalizedItems);

          creatorStats.urls.push({
            url: creatorUrl.url,
            status: 'success',
            fetched: items.length,
            new: results.created,
            updated: results.updated,
            errors: results.errors.length,
          });

          stats.processed += items.length;
          stats.new += results.created;
          stats.updated += results.updated;
          stats.errors += results.errors.length;
        } catch (error) {
          console.error(`Error processing RSS feed ${creatorUrl.url}:`, error);
          stats.errors++;
          creatorStats.urls.push({
            url: creatorUrl.url,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      stats.creators.push(creatorStats);

      // Update last_fetched_at for the creator
      await supabase
        .from('creators')
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            last_fetched_at: new Date().toISOString(),
          },
        })
        .eq('id', creator.id);
    }

    console.log('Manual refresh completed:', stats);

    return NextResponse.json({
      success: true,
      message: `Fetched ${stats.new} new items from ${creators.length} creators`,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Manual refresh error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
