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

    console.log('Auth check:', {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError,
    });

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is curator or admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    console.log('User data query:', {
      userData,
      userError,
    });

    const isPrivilegedUser =
      userData?.role === 'curator' || userData?.role === 'admin';

    console.log('User role check:', {
      userId: user.id,
      userEmail: user.email,
      userRole: userData?.role,
      isPrivilegedUser,
    });

    // Parse query parameters
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const query = querySchema.parse(searchParams);

    // Get creator IDs based on lounge_id
    let creatorIds: string[] = [];

    if (query.lounge_id) {
      // If lounge_id is provided, get creators for that specific lounge
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id')
        .eq('lounge_id', query.lounge_id);

      if (creatorsError) {
        return NextResponse.json(
          { error: 'Failed to fetch lounge creators' },
          { status: 500 }
        );
      }

      creatorIds = creators?.map((c) => c.id) || [];
    } else {
      // When no lounge is selected, show ALL content from ALL creators
      // This provides a unified feed view
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id');

      if (creatorsError) {
        return NextResponse.json(
          { error: 'Failed to fetch creators' },
          { status: 500 }
        );
      }

      creatorIds = creators?.map((c) => c.id) || [];
    }

    console.log('Creator IDs for query:', {
      loungeId: query.lounge_id,
      creatorCount: creatorIds.length,
      includesLinkedInCreator: creatorIds.includes(
        '67597381-9a5c-4a88-9f21-db122c404e80'
      ),
    });

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

    console.log('Content query results:', {
      totalCount: count,
      fetchedCount: content?.length || 0,
      contentIds: content?.slice(0, 5).map((c) => ({
        id: c.id,
        platform_content_id: c.platform_content_id,
        platform: c.platform,
        title: c.title?.substring(0, 50),
      })),
    });

    // Get deleted content for filtering or marking
    const deletedContentMap = new Map<string, boolean>();

    if (content && content.length > 0) {
      const { data: deletedContent, error: deletedError } = await supabase
        .from('deleted_content')
        .select('platform_content_id, platform, creator_id')
        .in('creator_id', creatorIds);

      console.log('Deleted content query result:', {
        found: deletedContent?.length || 0,
        data: deletedContent,
        error: deletedError,
      });

      if (deletedContent && deletedContent.length > 0) {
        deletedContent.forEach((dc) => {
          // Find matching content by platform_content_id, platform, and creator_id
          const matchingContent = content.find((c) => {
            const matches =
              c.platform_content_id === dc.platform_content_id &&
              c.platform === dc.platform &&
              c.creator_id === dc.creator_id;

            if (c.platform_content_id === '7355329890079952898') {
              console.log('Checking LinkedIn content:', {
                contentId: c.id,
                matches,
                contentPlatformId: c.platform_content_id,
                deletedPlatformId: dc.platform_content_id,
                contentPlatform: c.platform,
                deletedPlatform: dc.platform,
                contentCreatorId: c.creator_id,
                deletedCreatorId: dc.creator_id,
              });
            }

            return matches;
          });

          if (matchingContent) {
            console.log('Matching deleted content:', {
              contentId: matchingContent.id,
              title: matchingContent.title,
              platform: matchingContent.platform,
              platformContentId: matchingContent.platform_content_id,
              creatorId: matchingContent.creator_id,
            });
            deletedContentMap.set(matchingContent.id, true);
          } else {
            console.log('No match found for deleted content:', dc);
          }
        });
      }

      console.log('Deleted content map size:', deletedContentMap.size);
    }

    // Filter out deleted content for regular users
    let filteredContent = content || [];
    if (!isPrivilegedUser) {
      const beforeCount = filteredContent.length;
      filteredContent = filteredContent.filter(
        (item) => !deletedContentMap.has(item.id)
      );
      const afterCount = filteredContent.length;
      console.log(
        `Filtered content for non-privileged user: ${beforeCount} -> ${afterCount} items`
      );
    }

    // Transform the data to match ContentWithCreator type
    const transformedContent: ContentWithCreator[] = filteredContent.map(
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
        // Add deletion status for privileged users
        ...(isPrivilegedUser && { is_deleted: deletedContentMap.has(item.id) }),
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

    const response = {
      content: transformedContent,
      page: query.page,
      limit: query.limit,
      total: count || 0,
      has_more: (count || 0) > offset + query.limit,
    };

    console.log('API Response:', {
      contentCount: transformedContent.length,
      isPrivilegedUser,
      deletedContentIds: Array.from(deletedContentMap.keys()),
      firstFewItems: transformedContent.slice(0, 3).map((c) => ({
        id: c.id,
        title: c.title,
        is_deleted: c.is_deleted,
      })),
    });

    return NextResponse.json(response);
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

// DELETE endpoint for deleting/undeleting content
export async function DELETE(request: NextRequest) {
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

    // Check if user is curator or admin
    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      !userData ||
      (userData.role !== 'curator' && userData.role !== 'admin')
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const content_id = searchParams.get('content_id');
    const action = searchParams.get('action');

    if (
      !content_id ||
      !action ||
      (action !== 'delete' && action !== 'undelete')
    ) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      // Get content details for the deleted_content table
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('platform_content_id, platform, creator_id, title, url')
        .eq('id', content_id)
        .single();

      if (contentError || !content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        );
      }

      // Insert into deleted_content
      const { error: deleteError } = await supabase
        .from('deleted_content')
        .insert({
          platform_content_id: content.platform_content_id,
          platform: content.platform,
          creator_id: content.creator_id,
          deleted_by: user.id,
          deleted_at: new Date().toISOString(),
          title: content.title,
          url: content.url,
        });

      if (deleteError && deleteError.code !== '23505') {
        // Ignore duplicate key errors
        return NextResponse.json(
          { error: 'Failed to delete content' },
          { status: 500 }
        );
      }
    } else {
      // Undelete - remove from deleted_content
      // First get the content details to match the deletion
      const { data: content, error: contentError } = await supabase
        .from('content')
        .select('platform_content_id, platform, creator_id')
        .eq('id', content_id)
        .single();

      if (contentError || !content) {
        return NextResponse.json(
          { error: 'Content not found' },
          { status: 404 }
        );
      }

      const { error: undeleteError } = await supabase
        .from('deleted_content')
        .delete()
        .eq('platform_content_id', content.platform_content_id)
        .eq('platform', content.platform)
        .eq('creator_id', content.creator_id);

      if (undeleteError) {
        return NextResponse.json(
          { error: 'Failed to undelete content' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
