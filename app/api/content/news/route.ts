import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { Database } from '@/types/database.types';

// Query parameters schema for news
const newsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(20).default(7), // Default to 7 headlines
  hours_ago: z.coerce.number().min(1).max(48).default(24), // Default to last 24 hours
});

export interface NewsItem {
  id: string;
  title: string;
  url: string;
  published_at: string;
  creator: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  engagement_metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
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
    const query = newsQuerySchema.parse(searchParams);

    // Get news creators
    const { data: newsCreators, error: creatorsError } = await supabase
      .from('creators')
      .select('id')
      .eq('content_type', 'news');

    if (creatorsError || !newsCreators || newsCreators.length === 0) {
      // No news creators found
      return NextResponse.json({
        news: [],
        total: 0,
      });
    }

    const newsCreatorIds = newsCreators.map(c => c.id);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - query.hours_ago);

    // Get feed subscription exclusions
    const { data: unsubscribedLounges } = await supabase
      .from('lounge_feed_subscriptions')
      .select('lounge_id')
      .eq('user_id', user.id)
      .eq('subscribed', false);

    let excludedCreatorIds: string[] = [];
    if (unsubscribedLounges && unsubscribedLounges.length > 0) {
      const unsubscribedLoungeIds = unsubscribedLounges.map(s => s.lounge_id);
      
      // Get all lounges the user is subscribed to
      const { data: allLounges } = await supabase
        .from('lounges')
        .select('id');
      
      const subscribedLoungeIds = allLounges
        ?.filter(l => !unsubscribedLoungeIds.includes(l.id))
        .map(l => l.id) || [];

      // Get creators from unsubscribed lounges
      const { data: creatorsInUnsubscribed } = await supabase
        .from('creator_lounges')
        .select('creator_id')
        .in('lounge_id', unsubscribedLoungeIds);

      // Get creators from subscribed lounges
      let creatorsInSubscribed: { creator_id: string }[] | null = null;
      if (subscribedLoungeIds.length > 0) {
        const result = await supabase
          .from('creator_lounges')
          .select('creator_id')
          .in('lounge_id', subscribedLoungeIds);
        creatorsInSubscribed = result.data;
      }

      if (creatorsInUnsubscribed) {
        const subscribedCreatorSet = new Set(
          creatorsInSubscribed?.map(cl => cl.creator_id) || []
        );
        
        const unsubscribedCreatorIds = creatorsInUnsubscribed.map(cl => cl.creator_id);
        excludedCreatorIds = unsubscribedCreatorIds.filter(
          id => !subscribedCreatorSet.has(id)
        );
      }
    }

    // Filter news creators to exclude unsubscribed ones
    const filteredNewsCreatorIds = newsCreatorIds.filter(
      id => !excludedCreatorIds.includes(id)
    );

    if (filteredNewsCreatorIds.length === 0) {
      return NextResponse.json({
        news: [],
        total: 0,
      });
    }

    // Build query for news content
    const { data: newsContent, error: contentError, count } = await supabase
      .from('content')
      .select(`
        id,
        title,
        url,
        published_at,
        engagement_metrics,
        creator:creators(
          id,
          display_name,
          avatar_url
        )
      `, { count: 'exact' })
      .in('creator_id', filteredNewsCreatorIds)
      .gte('published_at', cutoffDate.toISOString())
      .eq('processing_status', 'processed')
      .eq('is_primary', true)
      .not('relevancy_checked_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(query.limit);

    if (contentError) {
      console.error('Error fetching news content:', contentError);
      return NextResponse.json(
        { error: 'Failed to fetch news' },
        { status: 500 }
      );
    }

    // Transform to NewsItem format
    const newsItems: NewsItem[] = (newsContent || []).map(item => ({
      id: item.id,
      title: item.title || 'Untitled',
      url: item.url,
      published_at: item.published_at,
      creator: {
        id: item.creator?.id || '',
        name: item.creator?.display_name || 'Unknown',
        avatar_url: item.creator?.avatar_url,
      },
      engagement_metrics: item.engagement_metrics as any,
    }));

    return NextResponse.json({
      news: newsItems,
      total: count || 0,
    });
  } catch (error) {
    console.error('Error in news API:', error);

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