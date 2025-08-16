import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { YouTubeFetcher } from '@/lib/content-fetcher/youtube-fetcher';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import { getAISummaryService } from '@/lib/services/ai-summary-service';
import { getRelevancyService } from '@/lib/services/relevancy-service';
import type { CreateContentInput } from '@/types/content';

// Verify cron authorization
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, require it for authorization
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // In development or when CRON_SECRET is not set, allow requests for testing
  // WARNING: Always set CRON_SECRET in production to prevent unauthorized access
  return process.env.NODE_ENV === 'development';
}

// Removed unused sleep function

// Removed unused processFeedsInBatches function

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create Supabase service client (bypasses RLS for cron job)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
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

    // Initialize Apify fetcher only if we have API key
    let apifyFetcher = null;
    if (process.env.APIFY_API_KEY) {
      apifyFetcher = new ApifyFetcher({
        apiKey: process.env.APIFY_API_KEY,
      });
    }

    // Initialize Bright Data fetcher for LinkedIn
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

    // Get all active creators with RSS, YouTube, Twitter, Threads, or LinkedIn URLs
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        creator_urls!inner (
          url,
          platform,
          metadata
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

            // Fetching Twitter/X content
            try {
              const items = await apifyFetcher.fetchTwitterContent(
                [creatorUrl.url],
                {
                  maxTweets: 20, // Limit to 20 most recent tweets
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
                resultsLimit: 20, // Limit to 20 most recent threads
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
            // Use Bright Data for LinkedIn ONLY (no Apify fallback)
            if (!brightDataFetcher) {
              creatorStats.urls.push({
                url: creatorUrl.url,
                status: 'error',
                error:
                  'LinkedIn API not configured. Please add BRIGHTDATA_API_KEY to environment variables.',
              });
              stats.errors++;
              continue;
            }

            // Fetching LinkedIn content with Bright Data
            try {
              console.log(
                '[Cron] Using Bright Data for LinkedIn:',
                creatorUrl.url
              );
              const items = await brightDataFetcher.fetchLinkedInContent(
                [creatorUrl.url],
                {
                  maxResults: 10, // Get 10 most recent posts to ensure we get variety
                  // Get posts from the last 7 days (profile_url endpoint supports date filtering)
                  startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    .toISOString()
                    .split('T')[0],
                }
              );
              console.log(
                `[Cron] Bright Data returned ${items.length} items for ${creatorUrl.url}`
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

      // Generate AI summaries for this creator's new content immediately
      // This ensures summaries are created even if the job times out later
      if (
        creatorStats.urls.some((u) => (u.new || 0) > 0) &&
        process.env.OPENAI_API_KEY
      ) {
        try {
          const summaryService = getAISummaryService();

          // Get newly created content for this creator
          const { data: newContent } = await supabase
            .from('content')
            .select('id')
            .eq('creator_id', creator.id)
            .eq('summary_status', 'pending')
            .order('created_at', { ascending: false })
            .limit(20); // Limit per creator to avoid overwhelming

          if (newContent && newContent.length > 0) {
            const contentIds = newContent.map(
              (item: { id: string }) => item.id
            );
            await summaryService.generateBatchSummaries(contentIds, {
              batchSize: 3, // Smaller batch for faster processing
              supabaseClient: supabase,
            });
          }
        } catch (summaryError) {
          console.error(
            `[CRON] Error generating summaries for creator ${creator.id}:`,
            summaryError
          );
          // Don't fail the whole job, just log and continue
        }
      }
    }

    // Generate AI summaries for newly created content
    console.log('[CRON] Summary generation check:', {
      newContent: stats.new,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      willGenerateSummaries: stats.new > 0 && !!process.env.OPENAI_API_KEY,
    });

    if (stats.new > 0 && process.env.OPENAI_API_KEY) {
      try {
        const summaryService = getAISummaryService();

        // Get all newly created content IDs that need summaries
        const { data: newContent } = await supabase
          .from('content')
          .select('id')
          .eq('summary_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(stats.new);

        console.log('[CRON] Content needing summaries:', {
          foundContent: newContent?.length || 0,
          contentIds: newContent?.slice(0, 5).map((c: any) => c.id), // Log first 5 IDs
        });

        if (newContent && newContent.length > 0) {
          const contentIds = newContent.map((item: { id: string }) => item.id);
          const summaryResults = await summaryService.generateBatchSummaries(
            contentIds,
            {
              batchSize: 5, // Process 5 at a time to avoid rate limits
              supabaseClient: supabase, // Pass the service role client
            }
          );

          stats.summariesGenerated = summaryResults.processed;
          stats.summaryErrors = summaryResults.errors;

          console.log('[CRON] Summary generation results:', {
            processed: summaryResults.processed,
            errors: summaryResults.errors,
          });
        }
      } catch (summaryError) {
        // Log summary generation error but don't fail the entire cron job
        console.error('Error generating summaries:', summaryError);
        stats.summaryGenerationError =
          summaryError instanceof Error
            ? summaryError.message
            : 'Failed to generate summaries';
      }
    }

    // Run relevancy checks on new content
    if (stats.new > 0 && process.env.OPENAI_API_KEY) {
      try {
        const relevancyService = getRelevancyService(supabase);
        if (relevancyService) {
          console.log('[CRON] Starting relevancy checks for new content');
          const relevancyResults =
            await relevancyService.processRelevancyChecks(stats.new * 2); // Check up to 2x new items to handle multiple lounges
          console.log('[CRON] Relevancy check results:', relevancyResults);
        }
      } catch (relevancyError) {
        console.error('[CRON] Error running relevancy checks:', relevancyError);
        // Don't fail the cron job for relevancy check errors
      }
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
