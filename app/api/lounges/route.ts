import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CreateLoungeSchema, LoungeFiltersSchema } from '@/types/lounge';

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
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const userId = user.id;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const queryValidation = LoungeFiltersSchema.safeParse({
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
      search: searchParams.get('search') || undefined,
      parent_lounge_id: searchParams.get('parent_lounge_id') || undefined,
      is_system_lounge: searchParams.get('is_system_lounge') || undefined,
      has_creators: searchParams.get('has_creators') || undefined,
      sort: searchParams.get('sort') || undefined,
      order: searchParams.get('order') || undefined,
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
      limit = 50,
      search,
      parent_lounge_id,
      is_system_lounge,
      has_creators,
      sort = 'name',
      order = 'asc',
    } = queryValidation.data;

    // Build query - get user's lounges and system lounges
    let query = supabase
      .from('lounges')
      .select(
        `
        *,
        parent_lounge:lounges!parent_lounge_id (
          id,
          name
        ),
        creator_lounges (
          creator_id
        )
      `,
        { count: 'exact' }
      )
      .or(`user_id.eq.${userId},is_system_lounge.eq.true`);

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (parent_lounge_id !== undefined) {
      query = query.eq('parent_lounge_id', parent_lounge_id);
    }

    if (is_system_lounge !== undefined) {
      query = query.eq('is_system_lounge', is_system_lounge);
    }

    if (has_creators) {
      query = query.gt('creator_count', 0);
    }

    // Apply sorting
    const sortColumn = sort === 'name' ? 'name' : sort;
    query = query.order(sortColumn, { ascending: order === 'asc' });

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: lounges, count, error: fetchError } = await query;

    if (fetchError) {
      // Error fetching lounges - details in response
      return NextResponse.json(
        { error: 'Failed to fetch lounges' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    // Transform lounges to include creator count
    const transformedLounges = (lounges || []).map((lounge) => {
      const { creator_lounges, ...loungeData } = lounge;
      return {
        ...loungeData,
        creator_count: creator_lounges?.length || 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        lounges: transformedLounges,
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
  } catch {
    // Unexpected error - details in response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const userId = user.id;

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateLoungeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { name, description, parent_lounge_id } = validation.data;

    // Check if lounge name already exists for this user
    const { data: existingLounge } = await supabase
      .from('lounges')
      .select('id, name')
      .eq('user_id', userId)
      .ilike('name', name)
      .single();

    if (existingLounge) {
      return NextResponse.json(
        {
          error: 'Lounge already exists',
          details: `A lounge named "${existingLounge.name}" already exists`,
        },
        { status: 409 }
      );
    }

    // Validate parent lounge if provided
    if (parent_lounge_id) {
      const { data: parentLounge } = await supabase
        .from('lounges')
        .select('id, name')
        .eq('id', parent_lounge_id)
        .or(`user_id.eq.${userId},is_system_lounge.eq.true`)
        .single();

      if (!parentLounge) {
        return NextResponse.json(
          { error: 'Parent lounge not found or not accessible' },
          { status: 404 }
        );
      }

      // Check nesting depth
      let currentParentId = parent_lounge_id;
      let depth = 1;
      const MAX_DEPTH = 3;

      while (currentParentId && depth < MAX_DEPTH) {
        const { data: parent } = await supabase
          .from('lounges')
          .select('parent_lounge_id')
          .eq('id', currentParentId)
          .single();

        if (!parent || !parent.parent_lounge_id) break;
        currentParentId = parent.parent_lounge_id;
        depth++;
      }

      if (depth >= MAX_DEPTH) {
        return NextResponse.json(
          {
            error: 'Maximum nesting depth exceeded',
            details: `Lounges can only be nested up to ${MAX_DEPTH} levels deep`,
          },
          { status: 400 }
        );
      }
    }

    // Create lounge
    const loungeData = {
      user_id: userId,
      name: name.trim(),
      description: description?.trim(),
      parent_lounge_id,
      is_system_lounge: false,
      usage_count: 0,
      creator_count: 0,
      content_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newLounge, error: createError } = await supabase
      .from('lounges')
      .insert(loungeData)
      .select(
        `
        *,
        parent_lounge:lounges!parent_lounge_id (
          id,
          name
        )
      `
      )
      .single();

    if (createError) {
      // Error creating lounge - details in response
      return NextResponse.json(
        { error: 'Failed to create lounge' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Lounge created successfully',
        data: newLounge,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch {
    // Unexpected error - details in response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
