import { Worker, Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import { getNewsDataService } from '@/lib/services/newsdata-service';
import { getGPTNewsCurator } from '@/lib/services/gpt-news-curator';
import { GenerateNewsResult } from '@/lib/services/perplexity-news-service';
import {
  getRedisConnection,
  QUEUE_NAMES,
  JOB_NAMES,
  WORKER_CONCURRENCY,
} from '../config';
import type { Database } from '@/types/database.types';

interface AINewsJobData {
  loungeId: string;
  loungeName: string;
  loungeDescription?: string;
  isGeneral?: boolean;
  timestamp: string;
}

export function createAINewsProcessorWorkerNewsData() {
  const worker = new Worker<AINewsJobData>(
    QUEUE_NAMES.AI_NEWS_GENERATION,
    async (job: Job<AINewsJobData>) => {
      const startTime = Date.now();
      const { loungeId, loungeName, loungeDescription, isGeneral } = job.data;

      console.log(
        `[AI News Worker - NewsData] Processing news generation for: ${loungeName} (Job ID: ${job.id})`
      );

      try {
        // Initialize Supabase client with service key
        const supabase = createClient<Database>(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY ||
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Initialize NewsData service
        const newsDataService = getNewsDataService();

        // Initialize GPT curator
        const gptCurator = getGPTNewsCurator();

        // Extract lounge type from name (same logic as before)
        let loungeType = loungeName
          .replace(/\s*(Times|Coffee|Lounge|Room|Hub)$/i, '')
          .trim();

        // Special case for B2B Growth
        if (loungeType.toLowerCase() === 'b2b growth') {
          loungeType = 'growth';
        }

        // Fetch news from NewsData.io - separate queries for main stories and special section
        console.log(
          `[AI News Worker - NewsData] Fetching news from NewsData.io for: ${loungeType}`
        );

        // Fetch main news articles for headlines and big story
        const mainNewsResponse = await newsDataService.fetchLatestNews(
          loungeType,
          {
            size: 10, // Free tier limit is 10 (upgrade for more)
            language: 'en',
            // country: 'us,gb,ca', // Optional - might limit results
            // timeframe: 48, // Requires paid plan - without it, gets latest news
          }
        );

        // Fetch special section articles with funding/M&A focus
        // Note: NewsData.io doesn't support complex OR queries, use simpler terms
        const specialQuery =
          loungeType.toLowerCase() === 'saas'
            ? 'funding Series'  // Will catch "Series A", "Series B", etc.
            : loungeType.toLowerCase() === 'venture'
              ? 'venture capital'
              : loungeType.toLowerCase() === 'growth'
                ? 'growth metrics'
                : null;

        let specialSectionResponse = null;
        if (specialQuery) {
          console.log(
            `[AI News Worker - NewsData] Fetching special section articles with query: ${specialQuery}`
          );
          
          // Build query options
          const queryOptions: any = {
            size: 10,
            language: 'en',
            category: ['business', 'technology'],
          };
          
          // Add domain filter for SaaS funding section to prioritize thesaasnews.com
          if (loungeType.toLowerCase() === 'saas') {
            queryOptions.domain = ['thesaasnews.com', 'techcrunch.com', 'venturebeat.com', 'forbes.com', 'bloomberg.com'];
            console.log('[AI News Worker - NewsData] Using domain filter for SaaS funding:', queryOptions.domain);
          }
          
          specialSectionResponse = await newsDataService.fetchNewsByQuery(
            specialQuery,
            queryOptions
          );
        }

        if (
          !mainNewsResponse.results ||
          mainNewsResponse.results.length === 0
        ) {
          throw new Error(
            `No news articles found for ${loungeType} from NewsData.io`
          );
        }

        // Combine both responses for GPT curation
        const combinedResponse = {
          results: [
            ...mainNewsResponse.results,
            ...(specialSectionResponse?.results || []),
          ],
          totalResults:
            mainNewsResponse.totalResults +
            (specialSectionResponse?.totalResults || 0),
          status: mainNewsResponse.status,
        };

        console.log(
          `[AI News Worker - NewsData] Fetched ${mainNewsResponse.results.length} main articles and ${specialSectionResponse?.results.length || 0} special section articles, now curating with GPT-5-mini`
        );

        // Curate news using GPT-5-mini
        const curatedNews = await gptCurator.curateNewsFromNewsData(
          combinedResponse,
          {
            loungeType,
            maxBullets: 5,
            maxSpecialSection: 3,
            includeImages: true,
            model: 'gpt-5-mini',
          }
        );

        if (
          !curatedNews ||
          !curatedNews.items ||
          curatedNews.items.length === 0
        ) {
          throw new Error(
            `Failed to curate news for ${loungeType}: No items generated`
          );
        }

        // Additional validation: Check that items have actual content
        const validItems = curatedNews.items.filter(
          (item) => item.text && item.text.trim().length > 10
        );

        if (validItems.length === 0) {
          throw new Error(
            `Invalid news result for ${loungeType}: All items are empty or too short`
          );
        }

        console.log(
          `[AI News Worker - NewsData] Successfully curated ${validItems.length} news items for ${loungeType}`
        );

        // Save to database with proper structure
        const { data: savedSummary, error: saveError } = await supabase
          .from('daily_news_summaries')
          .insert({
            lounge_id: isGeneral ? null : loungeId,
            topic: curatedNews.topic,
            summary_bullets: curatedNews.items as any,
            special_section: (curatedNews.specialSection || []) as any,
            generated_at: curatedNews.generatedAt,
            model_used: 'gpt-5-mini',
            token_count: 0, // Can be calculated if needed
            generation_time_ms: Date.now() - startTime,
            used_in_digest: false,
            metadata: {
              cron_generated: true,
              is_general: isGeneral || false,
              generated_at: curatedNews.generatedAt,
              job_id: job.id,
              queue_generated: true,
              bigStory: curatedNews.bigStory || null,
              special_section_title: curatedNews.specialSectionTitle || null,
              special_section_type: curatedNews.topic
                .toLowerCase()
                .includes('growth')
                ? 'growth_experiments'
                : 'fundraising',
              articles_found: combinedResponse.totalResults,
              articles_fetched: combinedResponse.results.length,
              articles_used:
                validItems.length + (curatedNews.specialSection?.length || 0),
              news_source: 'newsdata.io',
              curation_model: 'gpt-5-mini',
            } as any,
          })
          .select('id')
          .single();

        if (saveError) {
          throw new Error(`Failed to save summary: ${saveError.message}`);
        }

        const processingTime = Date.now() - startTime;
        console.log(
          `[AI News Worker - NewsData] Successfully generated news for ${loungeName} in ${processingTime}ms (Summary ID: ${savedSummary.id})`
        );

        return {
          success: true,
          loungeId,
          loungeName,
          summaryId: savedSummary.id,
          itemCount: validItems.length,
          processingTime,
          source: 'newsdata.io + gpt-5-mini',
        };
      } catch (error: any) {
        const errorMessage = error.message || error.toString();

        // Check if it's a rate limit error that should trigger retry
        const isRateLimitError =
          errorMessage.includes('429') ||
          errorMessage.includes('Rate limit') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('quota');

        console.error(
          `[AI News Worker - NewsData] Error generating news for ${loungeName}:`,
          errorMessage
        );

        // Log additional details for rate limit errors
        if (isRateLimitError) {
          console.log(
            `[AI News Worker - NewsData] Rate limit detected. Job will be retried with backoff.`
          );
        }

        // Re-throw to trigger BullMQ retry mechanism
        throw error;
      }
    },
    {
      connection: getRedisConnection(),
      concurrency: WORKER_CONCURRENCY.AI_NEWS_GENERATION,
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 50 },
      // Rate limit to be conservative with both NewsData and OpenAI APIs
      limiter: {
        max: 20, // Maximum 20 jobs
        duration: 60000, // Per 60 seconds (1 minute)
      },
    }
  );

  // Event handlers
  worker.on('completed', (job) => {
    console.log(
      `[AI News Worker - NewsData] Job ${job.id} completed for ${job.data.loungeName}`
    );
  });

  worker.on('failed', (job, err) => {
    console.error(
      `[AI News Worker - NewsData] Job ${job?.id} failed for ${job?.data.loungeName}:`,
      err.message
    );
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[AI News Worker - NewsData] Job ${jobId} stalled`);
  });

  console.log(
    `[AI News Worker - NewsData] Started with concurrency: ${WORKER_CONCURRENCY.AI_NEWS_GENERATION}`
  );

  return worker;
}
