import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  CreateTopicSchema,
  TopicFiltersSchema,
  type Topic,
} from '@/types/topic';

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
    const queryValidation = TopicFiltersSchema.safeParse({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
      search: searchParams.get('search'),
      parent_topic_id: searchParams.get('parent_topic_id'),
      is_system_topic: searchParams.get('is_system_topic'),
      has_creators: searchParams.get('has_creators'),
      sort: searchParams.get('sort'),
      order: searchParams.get('order'),
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
      parent_topic_id,
      is_system_topic,
      has_creators,
      sort = 'name',
      order = 'asc',
    } = queryValidation.data;

    // Build query - get user's topics and system topics
    let query = supabase
      .from('topics')
      .select(
        `
        *,
        parent_topic:topics!parent_topic_id (
          id,
          name
        )
      `,
        { count: 'exact' }
      )
      .or(`user_id.eq.${user.id},is_system_topic.eq.true`);

    // Apply filters
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (parent_topic_id !== undefined) {
      query = query.eq('parent_topic_id', parent_topic_id);
    }

    if (is_system_topic !== undefined) {
      query = query.eq('is_system_topic', is_system_topic);
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

    const { data: topics, count, error: fetchError } = await query;

    if (fetchError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error fetching topics:', fetchError);
      }
      return NextResponse.json(
        { error: 'Failed to fetch topics' },
        { status: 500 }
      );
    }

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      success: true,
      data: {
        topics: topics || [],
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
      console.error('Unexpected error in GET /api/topics:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
    const validation = CreateTopicSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { name, description, parent_topic_id } = validation.data;

    // Check if topic name already exists for this user
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('id, name')
      .eq('user_id', user.id)
      .ilike('name', name)
      .single();

    if (existingTopic) {
      return NextResponse.json(
        {
          error: 'Topic already exists',
          details: `A topic named "${existingTopic.name}" already exists`,
        },
        { status: 409 }
      );
    }

    // Validate parent topic if provided
    if (parent_topic_id) {
      const { data: parentTopic } = await supabase
        .from('topics')
        .select('id, name')
        .eq('id', parent_topic_id)
        .or(`user_id.eq.${user.id},is_system_topic.eq.true`)
        .single();

      if (!parentTopic) {
        return NextResponse.json(
          { error: 'Parent topic not found or not accessible' },
          { status: 404 }
        );
      }

      // Check nesting depth
      let currentParentId = parent_topic_id;
      let depth = 1;
      const MAX_DEPTH = 3;

      while (currentParentId && depth < MAX_DEPTH) {
        const { data: parent } = await supabase
          .from('topics')
          .select('parent_topic_id')
          .eq('id', currentParentId)
          .single();

        if (!parent || !parent.parent_topic_id) break;
        currentParentId = parent.parent_topic_id;
        depth++;
      }

      if (depth >= MAX_DEPTH) {
        return NextResponse.json(
          {
            error: 'Maximum nesting depth exceeded',
            details: `Topics can only be nested up to ${MAX_DEPTH} levels deep`,
          },
          { status: 400 }
        );
      }
    }

    // Create topic
    const topicData = {
      user_id: user.id,
      name: name.trim(),
      description: description?.trim(),
      parent_topic_id,
      is_system_topic: false,
      usage_count: 0,
      creator_count: 0,
      content_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: newTopic, error: createError } = await supabase
      .from('topics')
      .insert(topicData)
      .select(
        `
        *,
        parent_topic:topics!parent_topic_id (
          id,
          name
        )
      `
      )
      .single();

    if (createError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error creating topic:', createError);
      }
      return NextResponse.json(
        { error: 'Failed to create topic' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Topic created successfully',
        data: newTopic,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in POST /api/topics:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
