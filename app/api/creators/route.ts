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
  page: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1))
    .optional()
    .nullable(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional()
    .nullable(),
  platform: z
    .enum(['youtube', 'twitter', 'linkedin', 'threads', 'rss'])
    .optional()
    .nullable(),
  topic: z.string().optional().nullable(),
  search: z.string().optional().nullable(),
  sort: z
    .enum(['display_name', 'platform', 'created_at', 'updated_at'])
    .optional()
    .nullable(),
  order: z.enum(['asc', 'desc']).optional().nullable(),
  status: z.enum(['active', 'inactive', 'all']).optional().nullable(),
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
    // Use a simpler approach to avoid dynamic query issues
    const existingUrls = [];
    let checkError = null;
    
    try {
      for (const info of urlsWithPlatforms) {
        const { data: urlExists, error: urlCheckError } = await supabase
          .from('creator_urls')
          .select('url, creators!inner(display_name)')
          .eq('creators.user_id', user.id)
          .eq('platform', info.platform)
          .eq('normalized_url', info.profileUrl)
          .limit(1);

        if (urlCheckError) {
          checkError = urlCheckError;
          break;
        }

        if (urlExists && urlExists.length > 0) {
          existingUrls.push(...urlExists);
        }
      }
    } catch (error) {
      checkError = error;
      if (process.env.NODE_ENV === 'development') {
        console.error('Error in URL checking loop:', error);
      }
    }

    if (checkError && typeof checkError === 'object' && 'code' in checkError && checkError.code !== 'PGRST116') {
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
      const errorLog = {
        operation: 'creator_insert',
        error: createError,
        data: creatorData,
        timestamp: new Date().toISOString(),
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating creator:', errorLog);
      } else {
        console.error('Production error creating creator:', errorLog);
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
      const errorLog = {
        operation: 'creator_urls_insert',
        error: urlsError,
        data: creatorUrlsData,
        creator_id: newCreator.id,
        timestamp: new Date().toISOString(),
      };
      
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating creator URLs:', errorLog);
      } else {
        console.error('Production error creating creator URLs:', errorLog);
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
    // Enhanced error logging for production debugging
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      route: 'POST /api/creators',
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in POST /api/creators:', errorDetails);
    } else {
      // Log to console in production for Vercel logs
      console.error('Production error in POST /api/creators:', errorDetails);
    }

    return NextResponse.json(
      { 
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { details: errorDetails })
      },
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
        { error: 'Authentication required', details: authError?.message },
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
      sort: searchParams.get('sort'),
      order: searchParams.get('order'),
      status: searchParams.get('status'),
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

    // Build simplified query - avoid complex joins that cause timeouts
    let baseQuery = supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id);

    // Apply search filter
    if (search) {
      baseQuery = baseQuery.or(
        `display_name.ilike.%${search}%,bio.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = ((page || 1) - 1) * (limit || 10);
    const to = from + (limit || 10) - 1;

    const { data: creatorsData, error: fetchError } = await baseQuery
      .range(from, to)
      .order('created_at', { ascending: false });

    if (fetchError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching creators:', fetchError);
      }
      return NextResponse.json(
        { error: 'Failed to fetch creators', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!creatorsData) {
      return NextResponse.json({ error: 'No creators found' }, { status: 404 });
    }

    // Use mutable variable for potential filtering
    let creators = creatorsData;

    // Get total count for pagination (simplified)
    const { count, error: countError } = await supabase
      .from('creators')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error counting creators:', countError);
      }
      return NextResponse.json(
        { error: 'Failed to count creators' },
        { status: 500 }
      );
    }

    // Fetch related data separately for better performance
    const creatorIds = creators.map((c) => c.id);
    let creatorUrls: any[] = [];
    let creatorTopics: any[] = [];

    if (creatorIds.length > 0) {
      // Fetch URLs separately with optional platform filter
      let urlQuery = supabase
        .from('creator_urls')
        .select('id, creator_id, platform, url, validation_status')
        .in('creator_id', creatorIds);

      if (platform) {
        urlQuery = urlQuery.eq('platform', platform);
      }

      const { data: urls } = await urlQuery;
      creatorUrls = urls || [];

      // If platform filtering is applied, we need to filter creators that don't have URLs for that platform
      if (platform && creatorUrls.length > 0) {
        const creatorsWithPlatform = new Set(
          creatorUrls.map((url) => url.creator_id)
        );
        creators = creators.filter((creator) =>
          creatorsWithPlatform.has(creator.id)
        );
      }

      // Fetch topics separately (simplified without deep join)
      const { data: topics } = await supabase
        .from('creator_topics')
        .select('creator_id, topic_id, topics(id, name)')
        .in(
          'creator_id',
          creators.map((c) => c.id)
        ); // Use filtered creator IDs

      creatorTopics = topics || [];
    }

    const totalPages = Math.ceil((count || 0) / (limit || 10));

    // Transform creators to include related data
    const transformedCreators = creators.map((creator) => {
      // Get URLs for this creator
      const creatorUrlsList = creatorUrls.filter(
        (url) => url.creator_id === creator.id
      );

      // Get topics for this creator
      const creatorTopicsList = creatorTopics
        .filter((ct) => ct.creator_id === creator.id)
        .map((ct) => ct.topics?.name)
        .filter(Boolean);

      // Get the primary platform from the first URL
      const primaryUrl = creatorUrlsList[0];

      return {
        ...creator,
        platform: primaryUrl?.platform || 'website',
        urls: creatorUrlsList,
        creator_urls: creatorUrlsList, // Keep original structure for compatibility
        topics: creatorTopicsList,
        is_active: creator.status === 'active',
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        creators: transformedCreators,
        pagination: {
          page: page || 1,
          limit: limit || 10,
          total: count || 0,
          totalPages,
          hasNext: (page || 1) < totalPages,
          hasPrev: (page || 1) > 1,
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
