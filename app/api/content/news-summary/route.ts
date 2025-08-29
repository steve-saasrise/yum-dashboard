import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

// Query parameters schema
const querySchema = z.object({
  loungeId: z.string().uuid().optional(),
});

interface NewsItem {
  text: string;
  sourceUrl?: string;
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

    // Fetch the most recent AI-generated summary from database
    let summaryQuery = supabase
      .from('daily_news_summaries')
      .select('*')
      .order('generated_at', { ascending: false })
      .limit(1);

    if (query.loungeId) {
      // Get summary for specific lounge
      summaryQuery = summaryQuery.eq('lounge_id', query.loungeId);
    } else {
      // Get general summary (no lounge_id)
      summaryQuery = summaryQuery.is('lounge_id', null);
    }

    const { data: summary, error: summaryError } = await summaryQuery.single();

    if (summaryError || !summary) {
      console.log('No AI summary found in database');
      return NextResponse.json({
        items: [],
        topic: 'Technology and Business',
        generatedAt: new Date().toISOString(),
        message:
          'No AI summary available. Please wait for the next scheduled update.',
      });
    }

    // Check if summary is recent (within last 25 hours)
    const summaryAge =
      Date.now() -
      new Date(summary.generated_at || summary.created_at).getTime();
    const maxAge = 25 * 60 * 60 * 1000; // 25 hours in milliseconds

    if (summaryAge > maxAge) {
      console.log('AI summary is too old');
      return NextResponse.json({
        items: [],
        topic: summary.topic,
        generatedAt: summary.generated_at || summary.created_at,
        message:
          'Summary is outdated. Please wait for the next scheduled update.',
      });
    }

    // Format the response
    const newsResult = {
      items: (summary.summary_bullets as NewsItem[]) || [],
      topic: summary.topic,
      generatedAt: summary.generated_at || summary.created_at,
    };

    // Set cache headers for better performance (30 minutes cache)
    const headers = new Headers();
    headers.set(
      'Cache-Control',
      'public, s-maxage=1800, stale-while-revalidate=3600'
    );

    return NextResponse.json(newsResult, { headers });
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
