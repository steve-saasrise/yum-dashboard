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
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import type { CreateContentInput } from '@/types/content';

// Initialize clients and fetchers inside the worker function
let supabase: any;
let rssFetcher: RSSFetcher;
let youtubeFetcher: YouTubeFetcher | null;
let apifyFetcher: ApifyFetcher | null;

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
  }
}

// Process a single creator
async function processCreator(job: Job) {
  // Initialize services on first use
  initializeServices();

  const { creatorId, creatorName } = job.data;
  const stats = {
    processed: 0,
    new: 0,
    updated: 0,
    errors: 0,
    platforms: {} as Record<string, any>,
  };

  try {
    // Update job progress
    await job.updateProgress(10);

    // Get creator's URLs
    const { data: creatorUrls, error: urlsError } = await supabase
      .from('creator_urls')
      .select('*')
      .eq('creator_id', creatorId);

    if (urlsError || !creatorUrls) {
      throw new Error(`Failed to fetch URLs for creator ${creatorId}`);
    }

    await job.updateProgress(20);

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
            if (apifyFetcher) {
              items = await apifyFetcher.fetchLinkedInContent(
                [creatorUrl.url],
                { maxResults: 20 }
              );
              items = items.map((item) => ({ ...item, creator_id: creatorId }));
            }
            break;
        }

        // Store content if not already handled by the fetcher
        if (items.length > 0 && creatorUrl.platform !== 'youtube') {
          const results = await contentService.storeMultipleContent(items);
          platformStats.fetched = items.length;
          platformStats.new = results.created;
          platformStats.updated = results.updated;

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

      // Update progress
      await job.updateProgress(20 + (60 * (i + 1)) / creatorUrls.length);
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

    await job.updateProgress(90);

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

    await job.updateProgress(100);

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
    concurrency: WORKER_CONCURRENCY.CREATOR_PROCESSING,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  });

  worker.on('completed', (job) => {
    console.log(`Creator ${job.data.creatorName} processed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Creator ${job?.data.creatorName} processing failed:`, err);
  });

  return worker;
}
