import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { UpdateTopicSchema } from '@/types/topic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid topic ID format' },
        { status: 400 }
      );
    }

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

    // Fetch topic with parent and child topics
    const { data: topic, error: fetchError } = await supabase
      .from('topics')
      .select(
        `
        *,
        parent_topic:topics!parent_topic_id (
          id,
          name,
          description
        ),
        child_topics:topics!parent_topic_id (
          id,
          name,
          description,
          creator_count,
          content_count
        )
      `
      )
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_system_topic.eq.true`)
      .single();

    if (fetchError || !topic) {
      return NextResponse.json(
        { error: 'Topic not found or not accessible' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: topic,
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

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid topic ID format' },
        { status: 400 }
      );
    }

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
    const validation = UpdateTopicSchema.safeParse(body);
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

    // Check if topic exists and user has permission
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('id, user_id, is_system_topic')
      .eq('id', id)
      .single();

    if (!existingTopic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Only allow editing user's own topics (not system topics)
    if (existingTopic.is_system_topic || existingTopic.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Permission denied. Cannot edit system topics or topics owned by others.',
        },
        { status: 403 }
      );
    }

    // Check if new name conflicts with existing topics
    if (name) {
      const { data: conflictingTopic } = await supabase
        .from('topics')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (conflictingTopic) {
        return NextResponse.json(
          {
            error: 'Topic name already exists',
            details: `A topic named "${conflictingTopic.name}" already exists`,
          },
          { status: 409 }
        );
      }
    }

    // Validate parent topic if provided
    if (parent_topic_id !== undefined) {
      // Prevent self-referencing
      if (parent_topic_id === id) {
        return NextResponse.json(
          { error: 'A topic cannot be its own parent' },
          { status: 400 }
        );
      }

      // If setting a parent, validate it exists and check depth
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

        // Check if this would create a circular reference
        let currentParentId = parent_topic_id;
        const visited = new Set([id]);

        while (currentParentId) {
          if (visited.has(currentParentId)) {
            return NextResponse.json(
              {
                error:
                  'Circular reference detected. This would create a loop in the topic hierarchy.',
              },
              { status: 400 }
            );
          }
          visited.add(currentParentId);

          const { data: parent } = await supabase
            .from('topics')
            .select('parent_topic_id')
            .eq('id', currentParentId)
            .single();

          if (!parent) break;
          currentParentId = parent.parent_topic_id;
        }

        // Check nesting depth
        const MAX_DEPTH = 3;
        if (visited.size >= MAX_DEPTH) {
          return NextResponse.json(
            {
              error: 'Maximum nesting depth exceeded',
              details: `Topics can only be nested up to ${MAX_DEPTH} levels deep`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update topic
    const updateData: {
      updated_at: string;
      name?: string;
      description?: string | null;
      parent_topic_id?: string | null;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (parent_topic_id !== undefined)
      updateData.parent_topic_id = parent_topic_id;

    const { data: updatedTopic, error: updateError } = await supabase
      .from('topics')
      .update(updateData)
      .eq('id', id)
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

    if (updateError) {
      // Error updating topic - details in response
      return NextResponse.json(
        { error: 'Failed to update topic' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Topic updated successfully',
      data: updatedTopic,
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json(
        { error: 'Invalid topic ID format' },
        { status: 400 }
      );
    }

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

    // Check if topic exists and user has permission
    const { data: existingTopic } = await supabase
      .from('topics')
      .select('id, user_id, is_system_topic, creator_count, content_count')
      .eq('id', id)
      .single();

    if (!existingTopic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    // Only allow deleting user's own topics (not system topics)
    if (existingTopic.is_system_topic || existingTopic.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Permission denied. Cannot delete system topics or topics owned by others.',
        },
        { status: 403 }
      );
    }

    // Check if topic is in use
    if (existingTopic.creator_count > 0 || existingTopic.content_count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete topic in use',
          details: `This topic is assigned to ${existingTopic.creator_count} creators and ${existingTopic.content_count} content items. Remove all associations before deleting.`,
        },
        { status: 409 }
      );
    }

    // Check if topic has child topics
    const { data: childTopics } = await supabase
      .from('topics')
      .select('id')
      .eq('parent_topic_id', id)
      .limit(1);

    if (childTopics && childTopics.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete topic with child topics',
          details: 'Please delete or reassign all child topics first.',
        },
        { status: 409 }
      );
    }

    // Delete the topic
    const { error: deleteError } = await supabase
      .from('topics')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // Error deleting topic - details in response
      return NextResponse.json(
        { error: 'Failed to delete topic' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Topic deleted successfully',
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
