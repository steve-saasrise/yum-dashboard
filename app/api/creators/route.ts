import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  PlatformDetector,
  PlatformDetectionError,
} from '@/lib/platform-detector';

const createCreatorSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
  urls: z
    .array(z.string().url('Invalid URL format'))
    .min(1, 'At least one URL is required'),
  topics: z.array(z.string()).optional(),
});

const getCreatorsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  platform: z
    .enum(['youtube', 'twitter', 'linkedin', 'threads', 'rss'])
    .optional(),
  topic: z.string().optional(),
  search: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createCreatorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { urls, display_name, description, topics } = validation.data;

    // Validate and detect platforms for all URLs
    const urlsWithPlatforms = [];
    const platformUserIds = new Set();

    for (const url of urls) {
      let platformInfo;
      try {
        platformInfo = PlatformDetector.detect(url);

        // Check for duplicate platform/user combinations
        const platformKey = `${platformInfo.platform}:${platformInfo.platformUserId}`;
        if (platformUserIds.has(platformKey)) {
          return NextResponse.json(
            { error: `Duplicate URL for ${platformInfo.platform} account` },
            { status: 400 }
          );
        }
        platformUserIds.add(platformKey);

        urlsWithPlatforms.push({
          url,
          platform: platformInfo.platform,
          platformUserId: platformInfo.platformUserId,
          profileUrl: platformInfo.profileUrl,
          metadata: platformInfo.metadata,
        });
      } catch (error) {
        if (error instanceof PlatformDetectionError) {
          return NextResponse.json(
            { error: `Platform detection failed for ${url}: ${error.message}` },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // Check if any of the URLs already exist for this user
    const existingUrlsQuery = supabase
      .from('creator_urls')
      .select('url, creators!inner(display_name)')
      .eq('creators.user_id', user.id);

    const orConditions = urlsWithPlatforms
      .map(
        (info) =>
          `(platform.eq.${info.platform},normalized_url.eq.${info.profileUrl})`
      )
      .join(',');

    const { data: existingUrls, error: checkError } =
      await existingUrlsQuery.or(orConditions);

    if (checkError && checkError.code !== 'PGRST116') {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error checking existing URLs:', checkError);
      }
      return NextResponse.json(
        { error: 'Failed to check existing URLs' },
        { status: 500 }
      );
    }

    if (existingUrls && existingUrls.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more URLs already exist',
          details: existingUrls.map((u) => ({
            url: u.url,
            creator: (u as any).creators?.display_name,
          })),
        },
        { status: 409 }
      );
    }

    // Create creator
    const creatorData = {
      user_id: user.id,
      display_name,
      bio: description,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newCreator, error: createError } = await supabase
      .from('creators')
      .insert(creatorData)
      .select()
      .single();

    if (createError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating creator:', createError);
      }
      return NextResponse.json(
        { error: 'Failed to create creator' },
        { status: 500 }
      );
    }

    // Create creator URLs
    const creatorUrlsData = urlsWithPlatforms.map((info) => ({
      creator_id: newCreator.id,
      platform: info.platform,
      url: info.url,
      normalized_url: info.profileUrl,
      validation_status: 'valid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error: urlsError } = await supabase
      .from('creator_urls')
      .insert(creatorUrlsData);

    if (urlsError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating creator URLs:', urlsError);
      }
      // Rollback creator creation
      await supabase.from('creators').delete().eq('id', newCreator.id);
      return NextResponse.json(
        { error: 'Failed to create creator URLs' },
        { status: 500 }
      );
    }

    // Handle topics if provided
    if (topics && topics.length > 0) {
      // TODO: Implement topic assignment
      // This would require topic management endpoints to be implemented first
    }

    // Fetch the complete creator with URLs
    const { data: completeCreator } = await supabase
      .from('creators')
      .select(
        `
        *,
        creator_urls (
          id,
          platform,
          url,
          validation_status
        )
      `
      )
      .eq('id', newCreator.id)
      .single();

    return NextResponse.json(
      {
        success: true,
        message: 'Creator created successfully',
        data: completeCreator || newCreator,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in POST /api/creators:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = getCreatorsSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      platform: searchParams.get('platform'),
      topic: searchParams.get('topic'),
      search: searchParams.get('search'),
    });

    if (!queryValidation.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryValidation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { page = 1, limit = 20, platform, search } = queryValidation.data;

    // Build query
    let query = supabase
      .from('creators')
      .select(
        `
        *,
        creator_urls (
          id,
          platform,
          url,
          validation_status
        ),
        creator_topics (
          topics (
            id,
            name,
            color
          )
        )
      `
      )
      .eq('user_id', user.id);

    // Apply filters
    if (platform) {
      // Filter through creator_urls table
      query = query.eq('creator_urls.platform', platform);
    }

    if (search) {
      query = query.or(`display_name.ilike.%${search}%,bio.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: creators, error: fetchError } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (fetchError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching creators:', fetchError);
      }
      return NextResponse.json(
        { error: 'Failed to fetch creators' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('creators')
      .select('*, creator_urls!inner(*)', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (platform) {
      countQuery = countQuery.eq('creator_urls.platform', platform);
    }

    if (search) {
      countQuery = countQuery.or(
        `display_name.ilike.%${search}%,bio.ilike.%${search}%`
      );
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error counting creators:', countError);
      }
      return NextResponse.json(
        { error: 'Failed to count creators' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    // Transform creators to include platform info for backward compatibility
    const transformedCreators =
      creators?.map((creator) => {
        // Get the first URL's platform as the primary platform
        const primaryUrl = creator.creator_urls?.[0];
        return {
          ...creator,
          platform: primaryUrl?.platform || 'website',
          // Keep the full creator_urls array for components that support multiple URLs
          urls: creator.creator_urls,
          // Extract topics from the nested structure
          topics:
            creator.creator_topics
              ?.map((ct: { topics?: { name?: string } }) => ct.topics?.name)
              .filter(Boolean) || [],
          // Add is_active based on status for backward compatibility
          is_active: creator.status === 'active',
        };
      }) || [];

    return NextResponse.json({
      success: true,
      data: {
        creators: transformedCreators,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in GET /api/creators:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
