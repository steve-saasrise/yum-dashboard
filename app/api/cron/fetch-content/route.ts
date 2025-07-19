import { NextRequest, NextResponse } from 'next/server';
import createSupabaseSsr from '@/lib/supabase';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
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

// Rate limiting helper
async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Process feeds in batches to avoid overwhelming the system
async function processFeedsInBatches<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<any>
): Promise<any[]> {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item) => processor(item).catch((error) => ({ error, item })))
    );
    results.push(...batchResults);

    // Add delay between batches to avoid rate limiting
    if (i + batchSize < items.length) {
      await sleep(1000); // 1 second delay between batches
    }
  }

  return results;
}

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseSsr();
    const contentService = new ContentService(supabase);
    const rssFetcher = new RSSFetcher();
    const stats = {
      processed: 0,
      new: 0,
      updated: 0,
      errors: 0,
      creators: [] as any[],
    };

    // Get all RSS creators
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
      .eq('is_active', true);

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

          // Normalize and store each item
          const items = result.feed.items.slice(0, 20); // Limit to 20 most recent items
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

    console.log('Cron fetch completed:', stats);

    return NextResponse.json({
      success: true,
      message: 'Content fetch completed',
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron fetch error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
