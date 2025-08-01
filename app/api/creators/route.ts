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
  lounge_id: z.string().uuid('Invalid lounge ID'),
  avatar_url: z.string().url().optional(),
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
  lounge_id: z.string().uuid().optional().nullable(),
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
    console.log('POST /api/creators - Starting request processing');

    const cookieStore = await cookies();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
    });

    // Check authentication and role
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

    // Check if user has curator or admin role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      userError ||
      !userData ||
      (userData.role !== 'curator' && userData.role !== 'admin')
    ) {
      return NextResponse.json(
        { error: 'Curator or admin role required' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('Received request body:', JSON.stringify(body, null, 2));

    const validation = createCreatorSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation failed:', validation.error.errors);
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { urls, display_name, description, topics, lounge_id, avatar_url } =
      validation.data;

    // Validate and detect platforms for all URLs
    const urlsWithPlatforms = [];
    const platformUserIds = new Set();

    console.log('Processing URLs:', urls);

    for (const url of urls) {
      let platformInfo;
      try {
        platformInfo = PlatformDetector.detect(url);
        console.log('Platform detection result for', url, ':', platformInfo);

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
        console.error('Platform detection error:', error);
        if (error instanceof PlatformDetectionError) {
          return NextResponse.json(
            { error: `Platform detection failed for ${url}: ${error.message}` },
            { status: 400 }
          );
        }
        throw error;
      }
    }

    // Check if any of the URLs already exist in THIS lounge
    const existingUrls = [];
    let checkError = null;

    try {
      for (const info of urlsWithPlatforms) {
        // Check if this lounge already has this creator URL
        // First check if the URL exists
        const { data: existingUrl, error: urlCheckError } = await supabase
          .from('creator_urls')
          .select(
            `
              id, 
              url, 
              normalized_url,
              creator_id,
              creators!inner(
                id,
                display_name
              )
            `
          )
          .eq('normalized_url', info.profileUrl)
          .limit(1);

        if (!urlCheckError && existingUrl && existingUrl.length > 0) {
          // Now check if this creator is already in the lounge
          const { data: creatorInLounge, error: loungeCheckError } =
            await supabase
              .from('creator_lounges')
              .select('*')
              .eq('creator_id', existingUrl[0].creator_id)
              .eq('lounge_id', lounge_id)
              .limit(1);

          if (
            !loungeCheckError &&
            creatorInLounge &&
            creatorInLounge.length > 0
          ) {
            existingUrls.push(...existingUrl);
          }
        }

        if (urlCheckError) {
          console.error('Error checking existing URLs:', urlCheckError);
          checkError = urlCheckError;
          break;
        }
      }
    } catch (error) {
      checkError = error;
      // Error in URL checking loop - handled below
    }

    if (
      checkError &&
      typeof checkError === 'object' &&
      'code' in checkError &&
      checkError.code !== 'PGRST116'
    ) {
      // Error checking existing URLs - handled in response
      return NextResponse.json(
        { error: 'Failed to check existing URLs' },
        { status: 500 }
      );
    }

    if (existingUrls && existingUrls.length > 0) {
      return NextResponse.json(
        {
          error: 'This lounge already has this creator',
          details: existingUrls.map((u: any) => ({
            url: u.url,
            creator: u.creators?.display_name || 'Unknown',
          })),
        },
        { status: 409 }
      );
    }

    // Create creator without lounge_id (will be handled via junction table)
    const creatorData = {
      display_name,
      bio: description,
      avatar_url: avatar_url || null,
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
      // Error creating creator - details in response
      console.error('Failed to create creator:', {
        error: createError,
        data: creatorData,
        errorMessage: createError.message,
        errorCode: createError.code,
      });

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

    console.log('Creator URLs data to insert:', creatorUrlsData);

    const { error: urlsError } = await supabase
      .from('creator_urls')
      .insert(creatorUrlsData);

    if (urlsError) {
      // Error creating creator URLs
      console.error('Failed to create creator URLs:', {
        error: urlsError,
        data: creatorUrlsData,
        errorDetails: urlsError.message,
        errorCode: urlsError.code,
        errorHint: urlsError.hint,
      });

      // Rollback creator creation
      await supabase.from('creators').delete().eq('id', newCreator.id);
      return NextResponse.json(
        {
          error: 'Failed to create creator URLs',
          details:
            process.env.NODE_ENV === 'development'
              ? {
                  message: urlsError.message,
                  code: urlsError.code,
                  hint: urlsError.hint,
                  data: creatorUrlsData,
                }
              : undefined,
        },
        { status: 500 }
      );
    }

    // Create creator-lounge relationship
    if (lounge_id) {
      const { error: loungeError } = await supabase
        .from('creator_lounges')
        .insert({
          creator_id: newCreator.id,
          lounge_id: lounge_id,
        });

      if (loungeError) {
        console.error('Failed to create creator-lounge relationship:', {
          error: loungeError,
          creatorId: newCreator.id,
          loungeId: lounge_id,
        });

        // Rollback: delete creator and URLs
        await supabase
          .from('creator_urls')
          .delete()
          .eq('creator_id', newCreator.id);
        await supabase.from('creators').delete().eq('id', newCreator.id);

        return NextResponse.json(
          {
            error: 'Failed to assign creator to lounge',
            details:
              process.env.NODE_ENV === 'development'
                ? loungeError.message
                : undefined,
          },
          { status: 500 }
        );
      }
    }

    // Handle additional topics if provided (beyond the primary lounge)
    if (topics && topics.length > 0) {
      const additionalLounges = topics.filter((t) => t !== lounge_id);
      if (additionalLounges.length > 0) {
        const loungeRelations = additionalLounges.map((loungeId) => ({
          creator_id: newCreator.id,
          lounge_id: loungeId,
        }));

        const { error: topicsError } = await supabase
          .from('creator_lounges')
          .insert(loungeRelations);

        if (topicsError) {
          console.error(
            'Failed to create additional lounge relationships:',
            topicsError
          );
          // Non-critical error - continue with single lounge
        }
      }
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

    console.error('Error in POST /api/creators:', errorDetails);

    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
          details: errorDetails,
        }),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Initialize Supabase client
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

    // Check authentication
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
      lounge_id: searchParams.get('lounge_id'),
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

    const {
      page = 1,
      limit = 20,
      platform,
      search,
      lounge_id,
    } = queryValidation.data;

    // Build query to get creators, optionally filtered by lounge
    let baseQuery = supabase.from('creators').select('*');
    let creatorIds: string[] = [];

    // If filtering by lounge, we need to join with creator_lounges
    if (lounge_id) {
      // Get creator IDs for this lounge first
      const { data: creatorLounges, error: loungeError } = await supabase
        .from('creator_lounges')
        .select('creator_id')
        .eq('lounge_id', lounge_id);

      if (loungeError) {
        return NextResponse.json(
          {
            error: 'Failed to fetch lounge creators',
            details: loungeError.message,
          },
          { status: 500 }
        );
      }

      creatorIds = creatorLounges?.map((cl) => cl.creator_id) || [];
      if (creatorIds.length > 0) {
        baseQuery = baseQuery.in('id', creatorIds);
      } else {
        // No creators in this lounge
        return NextResponse.json({
          success: true,
          data: {
            creators: [],
            pagination: {
              page: page || 1,
              limit: limit || 10,
              total: 0,
              totalPages: 0,
              hasNext: false,
              hasPrev: false,
            },
          },
          timestamp: new Date().toISOString(),
        });
      }
    }

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
      // Error fetching creators - details in response
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

    // Get total count for pagination
    let countQuery = supabase
      .from('creators')
      .select('*', { count: 'exact', head: true });

    if (lounge_id && creatorIds && creatorIds.length > 0) {
      countQuery = countQuery.in('id', creatorIds);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      // Error counting creators - details in response
      return NextResponse.json(
        { error: 'Failed to count creators' },
        { status: 500 }
      );
    }

    // Fetch related data separately for better performance
    const allCreatorIds = creators.map((c) => c.id);
    let creatorUrls: Array<{
      id: string;
      creator_id: string;
      platform: string;
      url: string;
      validation_status: string;
    }> = [];
    let creatorLounges: Array<{
      creator_id: string;
      lounge_id: string;
      lounge?: {
        id: string;
        name: string;
        slug: string;
      };
    }> = [];

    if (allCreatorIds.length > 0) {
      // Fetch URLs separately with optional platform filter
      let urlQuery = supabase
        .from('creator_urls')
        .select('id, creator_id, platform, url, validation_status')
        .in('creator_id', allCreatorIds);

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

      // Fetch lounges separately (simplified without deep join)
      const { data: lounges } = await supabase
        .from('creator_lounges')
        .select('creator_id, lounge_id, lounges(id, name)')
        .in(
          'creator_id',
          creators.map((c) => c.id)
        ); // Use filtered creator IDs

      creatorLounges = lounges || [];
    }

    const totalPages = Math.ceil((count || 0) / (limit || 10));

    // Transform creators to include related data
    const transformedCreators = creators.map((creator) => {
      // Get URLs for this creator
      const creatorUrlsList = creatorUrls.filter(
        (url) => url.creator_id === creator.id
      );

      // Get lounges for this creator
      const creatorLoungesList = creatorLounges
        .filter((cl) => cl.creator_id === creator.id)
        .map((cl) => (cl as any).lounges?.name)
        .filter(Boolean);

      // Also get lounge IDs for the edit modal
      const creatorLoungeIds = creatorLounges
        .filter((cl) => cl.creator_id === creator.id)
        .map((cl) => (cl as any).lounges?.id)
        .filter(Boolean);

      // Get the primary platform from the first URL
      const primaryUrl = creatorUrlsList[0];

      return {
        ...creator,
        platform: primaryUrl?.platform || 'website',
        urls: creatorUrlsList,
        creator_urls: creatorUrlsList, // Keep original structure for compatibility
        lounges: creatorLoungesList,
        lounge_ids: creatorLoungeIds, // Add lounge IDs for edit modal
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
  } catch {
    // Error in GET /api/creators - details in response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
