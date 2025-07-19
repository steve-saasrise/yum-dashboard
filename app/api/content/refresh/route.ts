import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import type { CreateContentInput } from '@/types/content';

export async function POST() {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contentService = new ContentService(supabase);
    const rssFetcher = new RSSFetcher();
    const normalizer = new ContentNormalizer();
    const stats = {
      processed: 0,
      new: 0,
      updated: 0,
      errors: 0,
      creators: [] as Array<{
        id: string;
        name: string;
        urls: Array<{
          url: string;
          status: string;
          message?: string;
          fetched?: number;
          new?: number;
          updated?: number;
          errors?: number;
          error?: string;
        }>;
      }>,
    };

    // Get user's RSS creators
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        creator_urls!inner (
          url,
          platform
        )
      `
      )
      .eq('creator_urls.platform', 'rss')
      .eq('user_id', user.id); // Only fetch user's creators

    if (creatorsError) {
      // Error fetching creators - details in response
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
        name: creator.display_name,
        urls: [] as Array<{
          url: string;
          status: string;
          message?: string;
          fetched?: number;
          new?: number;
          updated?: number;
          errors?: number;
          error?: string;
        }>,
      };

      for (const creatorUrl of creator.creator_urls) {
        try {
          // Fetching RSS feed

          // Fetch RSS feed
          const result = await rssFetcher.parseURL(creatorUrl.url);

          if (
            !result.success ||
            !result.feed ||
            !result.feed.items ||
            result.feed.items.length === 0
          ) {
            creatorStats.urls.push({
              url: creatorUrl.url,
              status: 'empty',
              message: result.error || 'No items in feed',
            });
            continue;
          }

          // Normalize and store each item (limit to 10 for manual refresh)
          const items = result.feed.items.slice(0, 10);
          const normalizedItems: CreateContentInput[] = items.map((item) =>
            normalizer.normalize({
              platform: 'rss',
              platformData: item,
              creator_id: creator.id,
              sourceUrl: creatorUrl.url,
            })
          );

          // Store content using the service
          const results =
            await contentService.storeMultipleContent(normalizedItems);

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
          // Error processing RSS feed - details captured in stats
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

    // Manual refresh completed

    return NextResponse.json({
      success: true,
      message: `Fetched ${stats.new} new items from ${creators.length} creators`,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Manual refresh error - details in response
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
