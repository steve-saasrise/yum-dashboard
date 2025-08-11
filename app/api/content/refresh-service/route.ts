import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { YouTubeFetcher } from '@/lib/content-fetcher/youtube-fetcher';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import { getAISummaryService } from '@/lib/services/ai-summary-service';
import type { CreateContentInput } from '@/types/content';

export async function POST() {
  try {
    // Create Supabase server client for auth check
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
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
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create service role client for content operations (bypasses RLS)
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const contentService = new ContentService(supabaseService);
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

    // Initialize BrightData fetcher only if we have API key
    let brightDataFetcher = null;
    if (process.env.BRIGHTDATA_API_KEY) {
      brightDataFetcher = new BrightDataFetcher({
        apiKey: process.env.BRIGHTDATA_API_KEY,
      });
    }
    const stats: {
      processed: number;
      new: number;
      updated: number;
      errors: number;
      summariesGenerated?: number;
      summaryErrors?: number;
      summaryGenerationError?: string;
      creators: Array<{
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
      }>;
    } = {
      processed: 0,
      new: 0,
      updated: 0,
      errors: 0,
      creators: [],
    };

    // Get all creators across all supported platforms
    // Using service role client to bypass RLS
    const { data: creators, error: creatorsError } = await supabaseService
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
      ]);

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
                  supabaseClient: supabaseService, // Use service role client
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
            // Check if BrightData fetcher is initialized
            if (!brightDataFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'BrightData API not configured. Please add BRIGHTDATA_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Fetching LinkedIn content with date filtering
            try {
              const fetchOptions: {
                maxResults?: number;
                startDate?: string;
              } = {
                maxResults: 20, // Increased since we're filtering
              };

              // Add date filter if we have last fetch time
              if (lastFetchedAt) {
                // BrightData supports date filtering via start_date parameter
                fetchOptions.startDate = new Date(lastFetchedAt)
                  .toISOString()
                  .split('T')[0];
                console.log(
                  `[Refresh] LinkedIn filtering posts after: ${fetchOptions.startDate}`
                );
              }

              const items = await brightDataFetcher.fetchLinkedInContent(
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

      // Update last_fetched_at for the creator using service role
      await supabaseService
        .from('creators')
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            last_fetched_at: new Date().toISOString(),
          },
        })
        .eq('id', creator.id);
    }

    // Generate AI summaries for newly created content
    if (stats.new > 0 && process.env.OPENAI_API_KEY) {
      try {
        const summaryService = getAISummaryService();

        // Get all newly created content IDs from user's creators that need summaries
        const creatorIds = creators.map((c: { id: string }) => c.id);
        const { data: newContent } = await supabaseService
          .from('content')
          .select('id')
          .in('creator_id', creatorIds)
          .eq('summary_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(Math.min(stats.new, 50)); // Limit to 50 summaries per refresh to control costs

        if (newContent && newContent.length > 0) {
          const contentIds = newContent.map((item: { id: string }) => item.id);
          const summaryResults = await summaryService.generateBatchSummaries(
            contentIds,
            {
              batchSize: 3, // Smaller batch size for manual refresh to be faster
            }
          );

          stats.summariesGenerated = summaryResults.processed;
          stats.summaryErrors = summaryResults.errors;
        }
      } catch (summaryError) {
        // Log summary generation error but don't fail the entire refresh
        console.error('Error generating summaries:', summaryError);
        stats.summaryGenerationError =
          summaryError instanceof Error
            ? summaryError.message
            : 'Failed to generate summaries';
      }
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
