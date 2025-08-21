import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { getAISummaryService } from '@/lib/services/ai-summary-service';
import type { CreateContentInput } from '@/types/content';

// Verify cron authorization
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  return process.env.NODE_ENV === 'development';
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const contentService = new ContentService(supabase);

    // Initialize Bright Data fetcher for LinkedIn
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        {
          error: 'LinkedIn API not configured',
          details: 'BRIGHTDATA_API_KEY is missing',
        },
        { status: 500 }
      );
    }

    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    // Initialize stats tracking
    const stats = {
      processed: 0,
      new: 0,
      updated: 0,
      errors: 0,
      summariesGenerated: 0,
      summaryErrors: 0,
      creatorsProcessed: 0,
      creatorsSkipped: 0,
      creatorsFailed: 0,
      totalDuration: 0,
      creators: [] as Array<{
        id: string;
        name: string;
        url: string;
        status: string;
        fetched?: number;
        new?: number;
        updated?: number;
        duration?: number;
        error?: string;
      }>,
    };

    // Get all active LinkedIn creators
    console.log('[LinkedIn Cron] Starting LinkedIn content fetch...');

    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select(
        `
        id,
        display_name,
        metadata,
        creator_urls!inner (
          url,
          platform,
          metadata
        )
      `
      )
      .eq('creator_urls.platform', 'linkedin');

    if (creatorsError) {
      console.error('[LinkedIn Cron] Error fetching creators:', creatorsError);
      return NextResponse.json(
        { error: 'Failed to fetch LinkedIn creators', details: creatorsError },
        { status: 500 }
      );
    }

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        message: 'No active LinkedIn creators found',
        stats,
      });
    }

    console.log(
      `[LinkedIn Cron] Found ${creators.length} LinkedIn creators to process`
    );

    // Process creators in smaller batches to avoid timeouts
    const BATCH_SIZE = 10; // Process 10 creators at a time
    const creatorBatches = [];

    for (let i = 0; i < creators.length; i += BATCH_SIZE) {
      creatorBatches.push(creators.slice(i, i + BATCH_SIZE));
    }

    console.log(
      `[LinkedIn Cron] Processing ${creatorBatches.length} batches of creators`
    );

    // Process each batch sequentially
    for (let batchIndex = 0; batchIndex < creatorBatches.length; batchIndex++) {
      const batch = creatorBatches[batchIndex];
      console.log(
        `[LinkedIn Cron] Processing batch ${batchIndex + 1}/${creatorBatches.length} with ${batch.length} creators`
      );

      // Process creators in parallel within each batch
      const batchPromises = batch.map(async (creator) => {
        const creatorStartTime = Date.now();
        const creatorUrl = creator.creator_urls[0]; // LinkedIn creators should have only one URL

        const creatorStat: {
          id: string;
          name: string;
          url: string;
          status: string;
          fetched?: number;
          new?: number;
          updated?: number;
          duration: number;
          error?: string;
        } = {
          id: creator.id,
          name: creator.display_name,
          url: creatorUrl.url,
          status: 'pending',
          duration: 0,
        };

        try {
          console.log(
            `[LinkedIn Cron] Fetching content for ${creator.display_name}`
          );

          // Fetch LinkedIn content with Bright Data
          const items = await brightDataFetcher.fetchLinkedInContent(
            [creatorUrl.url],
            {
              maxResults: 10, // Get 10 most recent posts
              // Get posts from the last 24 hours (as per your recent change)
              startDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
                .toISOString()
                .split('T')[0],
            }
          );

          console.log(
            `[LinkedIn Cron] Bright Data returned ${items.length} items for ${creator.display_name}`
          );

          if (!items || items.length === 0) {
            creatorStat.status = 'empty';
            stats.creatorsSkipped++;
            return creatorStat;
          }

          // Add creator_id to each item and store
          const contentToStore: CreateContentInput[] = items.map((item) => ({
            ...item,
            creator_id: creator.id,
          }));

          const results =
            await contentService.storeMultipleContent(contentToStore);

          // Update stats
          creatorStat.status = 'success';
          creatorStat.fetched = items.length;
          creatorStat.new = results.created;
          creatorStat.updated = results.updated;

          stats.processed += items.length;
          stats.new += results.created;
          stats.updated += results.updated;
          stats.errors += results.errors.length;
          stats.creatorsProcessed++;

          // Generate AI summaries for new content if available
          if (results.created > 0 && process.env.OPENAI_API_KEY) {
            try {
              const summaryService = getAISummaryService();

              // Get newly created content for this creator
              const { data: newContent } = await supabase
                .from('content')
                .select('id')
                .eq('creator_id', creator.id)
                .eq('summary_status', 'pending')
                .eq('platform', 'linkedin')
                .order('created_at', { ascending: false })
                .limit(results.created);

              if (newContent && newContent.length > 0) {
                const contentIds = newContent.map(
                  (item: { id: string }) => item.id
                );
                const summaryResults =
                  await summaryService.generateBatchSummaries(contentIds, {
                    batchSize: 3, // Smaller batch for faster processing
                    supabaseClient: supabase,
                  });

                stats.summariesGenerated += summaryResults.processed;
                stats.summaryErrors += summaryResults.errors;
              }
            } catch (summaryError) {
              console.error(
                `[LinkedIn Cron] Error generating summaries for creator ${creator.id}:`,
                summaryError
              );
              // Don't fail the whole job, just log and continue
            }
          }

          // Update last_fetched_at for the creator
          await supabase
            .from('creators')
            .update({
              updated_at: new Date().toISOString(),
              metadata: {
                ...(creator.metadata || {}),
                last_linkedin_fetch: new Date().toISOString(),
                last_linkedin_count: items.length,
              },
            })
            .eq('id', creator.id);
        } catch (error) {
          console.error(
            `[LinkedIn Cron] Error processing ${creator.display_name}:`,
            error
          );
          creatorStat.status = 'error';
          creatorStat.error =
            error instanceof Error ? error.message : 'Unknown error';
          stats.creatorsFailed++;
          stats.errors++;
        } finally {
          creatorStat.duration = Date.now() - creatorStartTime;
          stats.creators.push(creatorStat);
        }

        return creatorStat;
      });

      // Wait for batch to complete before moving to next
      await Promise.all(batchPromises);

      // Add a small delay between batches to avoid rate limiting
      if (batchIndex < creatorBatches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Calculate total duration
    stats.totalDuration = Date.now() - startTime;

    // Log summary
    console.log('[LinkedIn Cron] Fetch completed:', {
      creatorsProcessed: stats.creatorsProcessed,
      creatorsSkipped: stats.creatorsSkipped,
      creatorsFailed: stats.creatorsFailed,
      newContent: stats.new,
      updatedContent: stats.updated,
      errors: stats.errors,
      duration: `${(stats.totalDuration / 1000).toFixed(2)}s`,
    });

    return NextResponse.json({
      success: true,
      message: `LinkedIn fetch completed. Processed ${stats.creatorsProcessed}/${creators.length} creators, ${stats.new} new posts`,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[LinkedIn Cron] Fatal error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
