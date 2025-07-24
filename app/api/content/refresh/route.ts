import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { YouTubeFetcher } from '@/lib/content-fetcher/youtube-fetcher';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
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

    // Initialize YouTube fetcher only if we have credentials
    let youtubeFetcher = null;
    if (process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_CLIENT_ID) {
      youtubeFetcher = new YouTubeFetcher({
        apiKey: process.env.YOUTUBE_API_KEY,
        // TODO: Add OAuth token support here if needed
      });
    }

    // Initialize Apify fetcher only if we have API key
    let apifyFetcher = null;
    if (process.env.APIFY_API_KEY) {
      apifyFetcher = new ApifyFetcher({
        apiKey: process.env.APIFY_API_KEY,
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

    // Get user's creators across all supported platforms
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        metadata,
        creator_urls!inner (
          url,
          platform
        )
      `
      )
      .in('creator_urls.platform', [
        'rss',
        'youtube',
        'twitter',
        'threads',
        'linkedin',
      ])
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

      // Get last fetched timestamp from creator metadata
      const lastFetchedAt = creator.metadata?.last_fetched_at as
        | string
        | undefined;

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
                maxResults: 10, // Limit to 10 for manual refresh
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
          } else if (creatorUrl.platform === 'twitter') {
            // Check if Apify fetcher is initialized
            if (!apifyFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'Apify API not configured. Please add APIFY_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Fetching Twitter/X content with time-based filtering
            try {
              // For Twitter, we can use since: in the search query
              // Extract username from URL
              const twitterMatch = creatorUrl.url.match(
                /twitter\.com\/([^/]+)|x\.com\/([^/]+)/
              );
              const twitterUsername = twitterMatch
                ? twitterMatch[1] || twitterMatch[2]
                : null;

              if (!twitterUsername) {
                throw new Error('Could not extract username from Twitter URL');
              }

              // Build time-filtered query if we have a last fetch date
              let searchUrl = creatorUrl.url;
              if (lastFetchedAt) {
                const sinceDate = new Date(lastFetchedAt)
                  .toISOString()
                  .split('T')[0];
                // Use Twitter's advanced search with from: and since:
                searchUrl = `from:${twitterUsername} since:${sinceDate}`;
              }

              const items = await apifyFetcher.fetchTwitterContent(
                [searchUrl],
                {
                  maxTweets: 20, // Increased since we're filtering by date
                }
              );

              if (!items || items.length === 0) {
                creatorStats.urls.push({
                  url: creatorUrl.url,
                  status: 'empty',
                  message: 'No tweets found',
                });
                continue;
              }

              // Add creator_id to each item and store
              const contentToStore: CreateContentInput[] = items.map(
                (item) => ({
                  ...item,
                  creator_id: creator.id,
                })
              );

              const results =
                await contentService.storeMultipleContent(contentToStore);

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
              stats.errors++;
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch Twitter content',
              });
            }
          } else if (creatorUrl.platform === 'threads') {
            // Check if Apify fetcher is initialized
            if (!apifyFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'Apify API not configured. Please add APIFY_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Extract username from URL
            const match = creatorUrl.url.match(/@([^/]+)/);
            const username = match ? match[1] : null;

            if (!username) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error: 'Could not extract username from Threads URL',
              });
              stats.errors++;
              continue;
            }

            // Fetching Threads content
            try {
              const items = await apifyFetcher.fetchThreadsContent([username], {
                resultsLimit: 10, // Limit to 10 for manual refresh
              });

              if (!items || items.length === 0) {
                creatorStats.urls.push({
                  url: creatorUrl.url,
                  status: 'empty',
                  message: 'No threads found',
                });
                continue;
              }

              // Add creator_id to each item and store
              const contentToStore: CreateContentInput[] = items.map(
                (item) => ({
                  ...item,
                  creator_id: creator.id,
                })
              );

              const results =
                await contentService.storeMultipleContent(contentToStore);

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
              stats.errors++;
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch Threads content',
              });
            }
          } else if (creatorUrl.platform === 'linkedin') {
            // Check if Apify fetcher is initialized
            if (!apifyFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'Apify API not configured. Please add APIFY_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Fetching LinkedIn content with date filtering
            try {
              // LinkedIn actor supports published_after parameter
              const fetchOptions: {
                maxResults?: number;
                published_after?: string;
              } = {
                maxResults: 20, // Increased since we're filtering
              };

              // Add date filter if we have last fetch time
              if (lastFetchedAt) {
                // apimaestro actor will filter posts client-side in transformLinkedInData
                fetchOptions.published_after = lastFetchedAt;
                console.log(
                  `[Refresh] LinkedIn filtering posts after: ${lastFetchedAt}`
                );
              }

              const items = await apifyFetcher.fetchLinkedInContent(
                [creatorUrl.url],
                fetchOptions
              );

              if (!items || items.length === 0) {
                creatorStats.urls.push({
                  url: creatorUrl.url,
                  status: 'empty',
                  message: 'No LinkedIn posts found',
                });
                continue;
              }

              // Add creator_id to each item and store
              const contentToStore: CreateContentInput[] = items.map(
                (item) => ({
                  ...item,
                  creator_id: creator.id,
                })
              );

              const results =
                await contentService.storeMultipleContent(contentToStore);

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
              stats.errors++;
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  error instanceof Error
                    ? error.message
                    : 'Failed to fetch LinkedIn content',
              });
            }
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
