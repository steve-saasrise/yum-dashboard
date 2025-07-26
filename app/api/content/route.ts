import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import type { ContentWithCreator } from '@/types/content';

// Query parameters schema
const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(21),
  platform: z
    .enum(['youtube', 'twitter', 'linkedin', 'threads', 'rss', 'website'])
    .optional(),
  creator_id: z.string().uuid().optional(),
  lounge_id: z.string().uuid().optional(),
  search: z.string().optional(),
  sort_by: z.enum(['published_at', 'created_at']).default('published_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});

export async function GET(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    // Get creator IDs based on lounge_id or user
    let creatorIds: string[] = [];

    if (query.lounge_id) {
      // If lounge_id is provided, get creators for that lounge
      const { data: loungeCreators, error: loungeCreatorsError } =
        await supabase
          .from('creator_lounges')
          .select('creator_id')
          .eq('lounge_id', query.lounge_id);

      if (loungeCreatorsError) {
        return NextResponse.json(
          { error: 'Failed to fetch lounge creators' },
          { status: 500 }
        );
      }

      creatorIds = loungeCreators?.map((lc) => lc.creator_id) || [];
    } else {
      // Otherwise, get the user's creators (old behavior)
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id')
        .eq('user_id', user.id);

      if (creatorsError) {
        return NextResponse.json(
          { error: 'Failed to fetch creators' },
          { status: 500 }
        );
      }

      creatorIds = creators?.map((c) => c.id) || [];
    }

    if (creatorIds.length === 0) {
      // No creators, return empty content
      return NextResponse.json({
        content: [],
        page: query.page,
        limit: query.limit,
        total: 0,
        has_more: false,
      });
    }

    // Build the content query
    let contentQuery = supabase
      .from('content')
      .select(
        `
        *,
        creator:creators!inner(
          id,
          display_name,
          avatar_url,
          metadata
        )
      `,
        { count: 'exact' }
      )
      .in('creator_id', creatorIds)
      .eq('processing_status', 'processed');

    // Apply filters
    if (query.platform) {
      contentQuery = contentQuery.eq('platform', query.platform);
    }

    if (query.creator_id && creatorIds.includes(query.creator_id)) {
      contentQuery = contentQuery.eq('creator_id', query.creator_id);
    }

    // Note: Lounge filtering removed as content_topics table doesn't exist yet

    if (query.search) {
      contentQuery = contentQuery.or(
        `title.ilike.%${query.search}%,description.ilike.%${query.search}%`
      );
    }

    // Apply sorting
    contentQuery = contentQuery.order(query.sort_by, {
      ascending: query.sort_order === 'asc',
    });

    // Apply pagination
    const offset = (query.page - 1) * query.limit;
    contentQuery = contentQuery.range(offset, offset + query.limit - 1);

    // Execute query
    const { data: content, error: contentError, count } = await contentQuery;

    if (contentError) {
      // Error fetching content
      return NextResponse.json(
        { error: 'Failed to fetch content' },
        { status: 500 }
      );
    }

    // Transform the data to match ContentWithCreator type
    const transformedContent: ContentWithCreator[] = (content || []).map(
      (item) => ({
        ...item,
        topics: [], // No topics for now since content_topics table doesn't exist
        creator: item.creator
          ? {
              ...item.creator,
              name: item.creator.display_name, // Map display_name to name
              platform: item.platform, // Get platform from content since creators don't have it
            }
          : undefined,
      })
    );

    // Check if user has saved any of this content
    if (transformedContent.length > 0) {
      const contentIds = transformedContent.map((c) => c.id);
      const { data: savedContent } = await supabase
        .from('saved_content')
        .select('content_id')
        .eq('user_id', user.id)
        .in('content_id', contentIds);

      const savedContentIds = new Set(
        savedContent?.map((s) => s.content_id) || []
      );

      // Add saved status to content
      transformedContent.forEach((content) => {
        (content as ContentWithCreator & { is_saved: boolean }).is_saved =
          savedContentIds.has(content.id);
      });
    }

    return NextResponse.json({
      content: transformedContent,
      page: query.page,
      limit: query.limit,
      total: count || 0,
      has_more: (count || 0) > offset + query.limit,
    });
  } catch (error) {
    // Error in content API

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

// POST endpoint for saving/bookmarking content
export async function POST(request: NextRequest) {
  try {
    // Create Supabase server client
    const cookieStore = await cookies();
    const supabase = createServerClient(
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

    const body = await request.json();
    const { content_id, action } = z
      .object({
        content_id: z.string().uuid(),
        action: z.enum(['save', 'unsave']),
      })
      .parse(body);

    if (action === 'save') {
      const { error } = await supabase
        .from('saved_content')
        .insert({
          user_id: user.id,
          content_id,
        })
        .single();

      if (error && error.code !== '23505') {
        // Ignore duplicate key errors
        // Error saving content
        return NextResponse.json(
          { error: 'Failed to save content' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await supabase
        .from('saved_content')
        .delete()
        .eq('user_id', user.id)
        .eq('content_id', content_id);

      if (error) {
        // Error unsaving content
        return NextResponse.json(
          { error: 'Failed to unsave content' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    // Error in save content API

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
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
