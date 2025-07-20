import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { YouTubeFetcher } from '@/lib/content-fetcher/youtube-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import type { CreateContentInput } from '@/types/content';

// Verify cron authorization
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');

  // In production, Vercel adds this header to cron requests
  if (process.env.VERCEL && process.env.CRON_SECRET) {
    return authHeader === `Bearer ${process.env.CRON_SECRET}`;
  }

  // In development or when CRON_SECRET is not set, allow requests for testing
  return true;
}

// Removed unused sleep function

// Removed unused processFeedsInBatches function

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const contentService = new ContentService(supabase);
    const rssFetcher = new RSSFetcher();

    // Initialize YouTube fetcher only if we have credentials
    let youtubeFetcher = null;
    if (process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_CLIENT_ID) {
      youtubeFetcher = new YouTubeFetcher({
        apiKey: process.env.YOUTUBE_API_KEY,
        // TODO: Add OAuth token support here if needed
      });
    }
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

    // Get all active creators with RSS or YouTube URLs
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
      .in('creator_urls.platform', ['rss', 'youtube']);

    if (creatorsError) {
      // Error fetching creators - details in response
      return NextResponse.json(
        { error: 'Failed to fetch creators', details: creatorsError },
        { status: 500 }
      );
    }

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        message: 'No active creators found',
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
          if (creatorUrl.platform === 'rss') {
            // Fetching RSS feed
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

            // Normalize and store each item
            const items = result.feed.items.slice(0, 20); // Limit to 20 most recent items
            const normalizedItems: CreateContentInput[] = items.map((item) => {
              const normalizer = new ContentNormalizer();
              return normalizer.normalize({
                platform: 'rss',
                platformData: item,
                creator_id: creator.id,
                sourceUrl: creatorUrl.url,
              });
            });

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
          } else if (creatorUrl.platform === 'youtube') {
            // Check if YouTube fetcher is initialized
            if (!youtubeFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'YouTube API not configured. Please add YOUTUBE_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Fetching YouTube videos
            const result = await youtubeFetcher.fetchChannelVideosByUrl(
              creatorUrl.url,
              {
                maxResults: 20, // Limit to 20 most recent videos
                storage: {
                  enabled: true,
                  supabaseClient: supabase,
                  creator_id: creator.id,
                },
              }
            );

            if (!result.success) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error: result.error || 'Failed to fetch YouTube videos',
              });
              stats.errors++;
              continue;
            }

            if (!result.videos || result.videos.length === 0) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'empty',
                message: 'No videos found',
              });
              continue;
            }

            const storedContent = result.storedContent || {
              created: 0,
              updated: 0,
              skipped: 0,
              errors: [],
            };

            creatorStats.urls.push({
              url: creatorUrl.url,
              status: 'success',
              fetched: result.videos.length,
              new: storedContent.created,
              updated: storedContent.updated,
              errors: storedContent.errors.length,
            });

            stats.processed += result.videos.length;
            stats.new += storedContent.created;
            stats.updated += storedContent.updated;
            stats.errors += storedContent.errors.length;
          }
        } catch (error) {
          // Error processing content - details captured in stats
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

    // Cron fetch completed

    return NextResponse.json({
      success: true,
      message: 'Content fetch completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Cron fetch error - details in response
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
