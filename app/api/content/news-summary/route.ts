import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { NewsSummaryService } from '@/lib/services/news-summary-service';
import { NewsAggregationService } from '@/lib/services/news-aggregation-service';
import type { Database } from '@/types/database.types';

// Query parameters schema
const querySchema = z.object({
  loungeId: z.string().uuid().optional(),
  topic: z.string().optional(),
  fallbackToManual: z.coerce.boolean().default(true),
});

export interface NewsSummaryResponse {
  summary: {
    bullets: Array<{
      text: string;
      sourceUrl?: string;
    }>;
    generatedAt: string;
    topic: string;
    loungeId?: string;
  } | null;
  fallbackContent?: any[];
  source: 'ai' | 'manual' | 'none';
}

export async function GET(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    const summaryService = new NewsSummaryService();
    let summary = null;

    // Try to get AI-generated summary
    if (query.loungeId) {
      // Get summary for specific lounge
      summary = await summaryService.getLatestSummary(query.loungeId);
    } else if (query.topic) {
      // Get summary by topic
      summary = await summaryService.getLatestSummaryByTopic(query.topic);
    } else {
      // Get general news summary
      summary = await summaryService.getLatestSummaryByTopic(
        'Technology and Business'
      );
    }

    // Check if summary is recent (within last 25 hours)
    if (summary) {
      const summaryAge = Date.now() - new Date(summary.generatedAt).getTime();
      const maxAge = 25 * 60 * 60 * 1000; // 25 hours in milliseconds

      if (summaryAge > maxAge) {
        console.log('AI summary is too old, will fallback if enabled');
        summary = null;
      }
    }

    // If no AI summary and fallback is enabled, get manual news
    let fallbackContent = null;
    if (!summary && query.fallbackToManual) {
      console.log('No AI summary found, falling back to manual news content');

      // Fetch recent news content as fallback
      const aggregationService = new NewsAggregationService();

      if (query.loungeId) {
        // Get lounge-specific content
        const newsContent = await aggregationService.getNewsContentForLounge(
          query.loungeId
        );
        fallbackContent = newsContent.slice(0, 6).map((item) => ({
          id: item.id,
          text: item.title,
          url: item.url,
          publishedAt: item.published_at,
          creator: item.creator_name,
        }));
      } else {
        // Get general news content
        const { data: newsContent } = await supabase
          .from('content')
          .select(
            `
            id,
            title,
            url,
            published_at,
            creator:creators(
              display_name
            )
          `
          )
          .eq('processing_status', 'processed')
          .eq('is_primary', true)
          .gte(
            'published_at',
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
          )
          .order('published_at', { ascending: false })
          .limit(6);

        fallbackContent = (newsContent || []).map((item) => ({
          id: item.id,
          text: item.title || 'Untitled',
          url: item.url,
          publishedAt: item.published_at,
          creator: item.creator?.display_name || 'Unknown',
        }));
      }
    }

    const response: NewsSummaryResponse = {
      summary: summary
        ? {
            bullets: summary.bullets,
            generatedAt: summary.generatedAt,
            topic: query.topic || 'Technology and Business',
            loungeId: query.loungeId,
          }
        : null,
      fallbackContent,
      source: summary ? 'ai' : fallbackContent ? 'manual' : 'none',
    };

    // Set cache headers for better performance
    const headers = new Headers();
    headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    ); // Cache for 5 minutes

    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error('Error in news summary API:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
