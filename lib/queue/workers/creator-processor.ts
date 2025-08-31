import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  WORKER_CONCURRENCY,
} from '../config';
import { queueContentForSummaries } from '../queue-service';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { YouTubeFetcher } from '@/lib/content-fetcher/youtube-fetcher';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import type { CreateContentInput } from '@/types/content';

// Initialize clients and fetchers inside the worker function
let supabase: any;
let rssFetcher: RSSFetcher;
let youtubeFetcher: YouTubeFetcher | null;
let apifyFetcher: ApifyFetcher | null;
let brightDataFetcher: BrightDataFetcher | null;

function initializeServices() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    rssFetcher = new RSSFetcher();
    youtubeFetcher = process.env.YOUTUBE_API_KEY
      ? new YouTubeFetcher({ apiKey: process.env.YOUTUBE_API_KEY })
      : null;
    apifyFetcher = process.env.APIFY_API_KEY
      ? new ApifyFetcher({ apiKey: process.env.APIFY_API_KEY })
      : null;
    brightDataFetcher = process.env.BRIGHTDATA_API_KEY
      ? new BrightDataFetcher({ apiKey: process.env.BRIGHTDATA_API_KEY })
      : null;
  }
}

// Process a single creator
async function processCreator(job: Job) {
  // Initialize services on first use
  initializeServices();

  const { creatorId, creatorName, skipLinkedIn = false } = job.data;
  const stats = {
    processed: 0,
    new: 0,
    updated: 0,
    errors: 0,
    platforms: {} as Record<string, any>,
  };

  try {
    // Remove progress update to reduce Redis operations

    // Get creator's URLs
    const { data: creatorUrls, error: urlsError } = await supabase
      .from('creator_urls')
      .select('*')
      .eq('creator_id', creatorId);

    if (urlsError || !creatorUrls) {
      throw new Error(`Failed to fetch URLs for creator ${creatorId}`);
    }

    // Removed progress update

    const contentService = new ContentService(supabase);

    // Process each platform URL
    for (let i = 0; i < creatorUrls.length; i++) {
      const creatorUrl = creatorUrls[i];
      const platformStats = {
        fetched: 0,
        new: 0,
        updated: 0,
        error: null as string | null,
      };

      try {
        let items: CreateContentInput[] = [];

        switch (creatorUrl.platform) {
          case 'rss':
            if (rssFetcher) {
              const result = await rssFetcher.parseURL(creatorUrl.url);
              if (result.success && result.feed?.items) {
                const normalizer = new ContentNormalizer();
                items = result.feed.items.slice(0, 20).map((item) =>
                  normalizer.normalize({
                    platform: 'rss',
                    platformData: item,
                    creator_id: creatorId,
                    sourceUrl: creatorUrl.url,
                  })
                );
              }
            }
            break;

          case 'youtube':
            if (youtubeFetcher) {
              const result = await youtubeFetcher.fetchChannelVideosByUrl(
                creatorUrl.url,
                {
                  maxResults: 20,
                  storage: {
                    enabled: true,
                    supabaseClient: supabase,
                    creator_id: creatorId,
                  },
                }
              );
              // YouTube fetcher handles storage internally
              platformStats.fetched = result.videos?.length || 0;
              platformStats.new = result.storedContent?.created || 0;
              platformStats.updated = result.storedContent?.updated || 0;

              // Update main stats for YouTube
              stats.processed += platformStats.fetched;
              stats.new += platformStats.new;
              stats.updated += platformStats.updated;
            }
            break;

          case 'twitter':
            if (apifyFetcher) {
              items = await apifyFetcher.fetchTwitterContent([creatorUrl.url], {
                maxTweets: 20,
              });
              items = items.map((item) => ({ ...item, creator_id: creatorId }));

              // Extract and update creator avatar if missing
              const authorInfo = apifyFetcher.getExtractedAuthors();
              if (authorInfo.length > 0) {
                const { data: creator } = await supabase
                  .from('creators')
                  .select('avatar_url')
                  .eq('id', creatorId)
                  .single();

                if (
                  creator &&
                  !creator.avatar_url &&
                  authorInfo[0].avatar_url
                ) {
                  await supabase
                    .from('creators')
                    .update({
                      avatar_url: authorInfo[0].avatar_url,
                      updated_at: new Date().toISOString(),
                    })
                    .eq('id', creatorId);
                  console.log(
                    `[Creator ${creatorName}] Updated avatar from Twitter`
                  );
                }
              }
            }
            break;

          case 'threads':
            if (apifyFetcher) {
              const match = creatorUrl.url.match(/@([^/]+)/);
              const username = match ? match[1] : null;
              if (username) {
                items = await apifyFetcher.fetchThreadsContent([username], {
                  resultsLimit: 20,
                });
                items = items.map((item) => ({
                  ...item,
                  creator_id: creatorId,
                }));
              }
            }
            break;

          case 'linkedin':
            // Skip LinkedIn if flag is set (when called from queue-creators)
            if (skipLinkedIn) {
              console.log(
                `[LinkedIn] Skipping LinkedIn for ${creatorName} (skipLinkedIn flag set)`
              );
              break;
            }

            // Use BrightData for LinkedIn - now with two-phase approach
            if (brightDataFetcher) {
              console.log(
                `[LinkedIn] Triggering BrightData collection for ${creatorName}: ${creatorUrl.url}`
              );

              try {
                // Phase 1: Just trigger the collection and save snapshot ID
                // Note: We don't set date filters because many LinkedIn posts lack dates
                // and will be filtered out if dates are specified (per BrightData API warning)
                const snapshotId =
                  await brightDataFetcher.triggerCollectionOnly(
                    [creatorUrl.url]
                    // Removed date filter - causes posts without dates to be excluded
                  );

                // Save snapshot to database for processing later
                const { error: insertError } = await supabase
                  .from('brightdata_snapshots')
                  .insert({
                    snapshot_id: snapshotId,
                    dataset_id: 'gd_lyy3tktm25m4avu764',
                    status: 'pending',
                    creator_urls: [creatorUrl.url],
                    metadata: {
                      creator_id: creatorId,
                      creator_name: creatorName,
                      max_results: 10,
                    },
                  });

                if (insertError) {
                  console.error(
                    `[LinkedIn] Failed to save snapshot ${snapshotId}:`,
                    insertError
                  );
                }

                console.log(
                  `[LinkedIn] Collection triggered for ${creatorName}, snapshot: ${snapshotId}`
                );

                // Don't wait for results - they'll be processed by separate worker
                platformStats.fetched = 0;
                (platformStats as any).status = 'collection_triggered';
              } catch (error) {
                console.error(
                  `[LinkedIn] Failed to trigger collection for ${creatorName}:`,
                  error
                );
                platformStats.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to trigger collection';
              }
            } else {
              console.warn(
                `[LinkedIn] BrightData not configured for ${creatorName}`
              );
            }
            break;
        }

        // Store content if not already handled by the fetcher
        if (items.length > 0 && creatorUrl.platform !== 'youtube') {
          console.log(
            `[${creatorUrl.platform.toUpperCase()}] Storing ${items.length} items for ${creatorName}`
          );
          const results = await contentService.storeMultipleContent(items);
          platformStats.fetched = items.length;
          platformStats.new = results.created;
          platformStats.updated = results.updated;

          console.log(
            `[${creatorUrl.platform.toUpperCase()}] Storage results for ${creatorName}: ` +
              `${results.created} new, ${results.updated} updated, ${results.errors.length} errors`
          );

          // Log specific errors if any
          if (results.errors.length > 0) {
            console.error(
              `[${creatorUrl.platform.toUpperCase()}] Storage errors for ${creatorName}:`,
              results.errors
            );
          }

          stats.processed += items.length;
          stats.new += results.created;
          stats.updated += results.updated;
          stats.errors += results.errors.length;
        }
      } catch (error) {
        platformStats.error =
          error instanceof Error ? error.message : 'Unknown error';
        stats.errors++;
      }

      stats.platforms[creatorUrl.platform] = platformStats;

      // Removed progress update to reduce Redis operations
    }

    // Update creator's last_fetched_at
    await supabase
      .from('creators')
      .update({
        updated_at: new Date().toISOString(),
        metadata: {
          last_fetched_at: new Date().toISOString(),
          last_fetch_stats: stats,
        },
      })
      .eq('id', creatorId);

    // Log final stats for this creator
    console.log(
      `[Creator ${creatorName}] Processing complete: ` +
        `${stats.processed} processed, ${stats.new} new, ${stats.updated} updated, ${stats.errors} errors`
    );

    // Queue new content for AI summary generation
    console.log(`[Creator ${creatorName}] Summary queue check:`, {
      newItems: stats.new,
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      willQueue: stats.new > 0 && !!process.env.OPENAI_API_KEY,
    });

    if (stats.new > 0 && process.env.OPENAI_API_KEY) {
      const { data: newContent } = await supabase
        .from('content')
        .select('id')
        .eq('creator_id', creatorId)
        .eq('summary_status', 'pending')
        .order('created_at', { ascending: false })
        .limit(stats.new);

      console.log(
        `[Creator ${creatorName}] Found ${newContent?.length || 0} items to queue for summaries`
      );

      if (newContent && newContent.length > 0) {
        const contentIds = newContent.map((item: { id: string }) => item.id);
        await queueContentForSummaries(contentIds, creatorId);
        console.log(
          `[Creator ${creatorName}] Queued ${contentIds.length} items for AI summaries`
        );
      }
    }

    // Final progress update only if needed for monitoring
    // await job.updateProgress(100);

    return {
      success: true,
      creatorId,
      creatorName,
      stats,
    };
  } catch (error) {
    console.error(`Error processing creator ${creatorId}:`, error);
    throw error;
  }
}

// Create the worker
export function createCreatorProcessorWorker() {
  const worker = new Worker(QUEUE_NAMES.CREATOR_PROCESSING, processCreator, {
    connection: getRedisConnection(),
    concurrency: WORKER_CONCURRENCY.CREATOR_PROCESSING, // Use config value (3)
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
    // Extended timeouts for slow external APIs (BrightData)
    drainDelay: 5, // Standard drain delay
    stalledInterval: 300000, // 5 minutes - matches lock duration
    lockDuration: 300000, // 5 minutes - for slow BrightData API
    skipStalledCheck: false, // Keep stalled checks for reliability
    // Additional settings for performance
  });

  worker.on('completed', (job) => {
    console.log(`Creator ${job.data.creatorName} processed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Creator ${job?.data.creatorName} processing failed:`, err);
  });

  return worker;
}
