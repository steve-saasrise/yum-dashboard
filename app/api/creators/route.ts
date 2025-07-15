import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { PlatformDetector, PlatformDetectionError } from '@/lib/platform-detector';

const createCreatorSchema = z.object({
  url: z.string().url('Invalid URL format'),
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
  topics: z.array(z.string()).optional(),
});

const getCreatorsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).optional(),
  platform: z.enum(['youtube', 'twitter', 'linkedin', 'threads', 'rss']).optional(),
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    const { url, display_name, description, topics } = validation.data;

    // Detect platform from URL
    let platformInfo;
    try {
      platformInfo = PlatformDetector.detect(url);
    } catch (error) {
      if (error instanceof PlatformDetectionError) {
        return NextResponse.json(
          { error: `Platform detection failed: ${error.message}` },
          { status: 400 }
        );
      }
      throw error;
    }

    // Check if creator already exists
    const { data: existingCreator, error: checkError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', platformInfo.platform)
      .eq('platform_user_id', platformInfo.platformUserId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing creator:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing creator' },
        { status: 500 }
      );
    }

    if (existingCreator) {
      return NextResponse.json(
        { error: 'Creator already exists' },
        { status: 409 }
      );
    }

    // Create creator
    const creatorData = {
      user_id: user.id,
      display_name,
      description,
      platform: platformInfo.platform,
      platform_user_id: platformInfo.platformUserId,
      profile_url: platformInfo.profileUrl,
      metadata: platformInfo.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newCreator, error: createError } = await supabase
      .from('creators')
      .insert(creatorData)
      .select()
      .single();

    if (createError) {
      console.error('Error creating creator:', createError);
      return NextResponse.json(
        { error: 'Failed to create creator' },
        { status: 500 }
      );
    }

    // Handle topics if provided
    if (topics && topics.length > 0) {
      // TODO: Implement topic assignment
      // This would require topic management endpoints to be implemented first
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Creator created successfully',
        data: newCreator,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/creators:', error);
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
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

    const {
      page = 1,
      limit = 20,
      platform,
      topic,
      search,
    } = queryValidation.data;

    // Build query
    let query = supabase
      .from('creators')
      .select(`
        *,
        creator_topics (
          topics (
            id,
            name,
            color
          )
        )
      `)
      .eq('user_id', user.id);

    // Apply filters
    if (platform) {
      query = query.eq('platform', platform);
    }

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: creators, error: fetchError } = await query
      .range(from, to)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching creators:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch creators' },
        { status: 500 }
      );
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('creators')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (platform) {
      countQuery = countQuery.eq('platform', platform);
    }

    if (search) {
      countQuery = countQuery.or(
        `display_name.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting creators:', countError);
      return NextResponse.json(
        { error: 'Failed to count creators' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        creators,
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
    console.error('Unexpected error in GET /api/creators:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}