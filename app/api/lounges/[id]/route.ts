import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { UpdateLoungeSchema } from '@/types/lounge';

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
        { error: 'Invalid lounge ID format' },
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

    // Fetch lounge with parent and child lounges
    const { data: lounge, error: fetchError } = await supabase
      .from('lounges')
      .select(
        `
        *,
        parent_lounge:lounges!parent_lounge_id (
          id,
          name,
          description
        ),
        child_lounges:lounges!parent_lounge_id (
          id,
          name,
          description,
          creator_count,
          content_count
        )
      `
      )
      .eq('id', id)
      .or(`user_id.eq.${user.id},is_system_lounge.eq.true`)
      .single();

    if (fetchError || !lounge) {
      return NextResponse.json(
        { error: 'Lounge not found or not accessible' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: lounge,
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
        { error: 'Invalid lounge ID format' },
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
    const validation = UpdateLoungeSchema.safeParse(body);
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

    // Check if lounge exists and user has permission
    const { data: existingLounge } = await supabase
      .from('lounges')
      .select('id, user_id, is_system_lounge')
      .eq('id', id)
      .single();

    if (!existingLounge) {
      return NextResponse.json({ error: 'Lounge not found' }, { status: 404 });
    }

    // Only allow editing user's own lounges (not system lounges)
    if (existingLounge.is_system_lounge || existingLounge.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Permission denied. Cannot edit system lounges or lounges owned by others.',
        },
        { status: 403 }
      );
    }

    // Check if new name conflicts with existing lounges
    if (name) {
      const { data: conflictingLounge } = await supabase
        .from('lounges')
        .select('id, name')
        .eq('user_id', user.id)
        .ilike('name', name)
        .neq('id', id)
        .single();

      if (conflictingLounge) {
        return NextResponse.json(
          {
            error: 'Lounge name already exists',
            details: `A lounge named "${conflictingLounge.name}" already exists`,
          },
          { status: 409 }
        );
      }
    }

    // Validate parent lounge if provided
    if (parent_lounge_id !== undefined) {
      // Prevent self-referencing
      if (parent_lounge_id === id) {
        return NextResponse.json(
          { error: 'A lounge cannot be its own parent' },
          { status: 400 }
        );
      }

      // If setting a parent, validate it exists and check depth
      if (parent_lounge_id) {
        const { data: parentLounge } = await supabase
          .from('lounges')
          .select('id, name')
          .eq('id', parent_lounge_id)
          .or(`user_id.eq.${user.id},is_system_lounge.eq.true`)
          .single();

        if (!parentLounge) {
          return NextResponse.json(
            { error: 'Parent lounge not found or not accessible' },
            { status: 404 }
          );
        }

        // Check if this would create a circular reference
        let currentParentId = parent_lounge_id;
        const visited = new Set([id]);

        while (currentParentId) {
          if (visited.has(currentParentId)) {
            return NextResponse.json(
              {
                error:
                  'Circular reference detected. This would create a loop in the lounge hierarchy.',
              },
              { status: 400 }
            );
          }
          visited.add(currentParentId);

          const { data: parent } = await supabase
            .from('lounges')
            .select('parent_lounge_id')
            .eq('id', currentParentId)
            .single();

          if (!parent) break;
          currentParentId = parent.parent_lounge_id;
        }

        // Check nesting depth
        const MAX_DEPTH = 3;
        if (visited.size >= MAX_DEPTH) {
          return NextResponse.json(
            {
              error: 'Maximum nesting depth exceeded',
              details: `Lounges can only be nested up to ${MAX_DEPTH} levels deep`,
            },
            { status: 400 }
          );
        }
      }
    }

    // Update lounge
    const updateData: {
      updated_at: string;
      name?: string;
      description?: string | null;
      parent_lounge_id?: string | null;
    } = {
      updated_at: new Date().toISOString(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined)
      updateData.description = description?.trim() || null;
    if (parent_lounge_id !== undefined)
      updateData.parent_lounge_id = parent_lounge_id;

    const { data: updatedLounge, error: updateError } = await supabase
      .from('lounges')
      .update(updateData)
      .eq('id', id)
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

    if (updateError) {
      // Error updating lounge - details in response
      return NextResponse.json(
        { error: 'Failed to update lounge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lounge updated successfully',
      data: updatedLounge,
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
        { error: 'Invalid lounge ID format' },
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

    // Check if lounge exists and user has permission
    const { data: existingLounge } = await supabase
      .from('lounges')
      .select('id, user_id, is_system_lounge, creator_count, content_count')
      .eq('id', id)
      .single();

    if (!existingLounge) {
      return NextResponse.json({ error: 'Lounge not found' }, { status: 404 });
    }

    // Only allow deleting user's own lounges (not system lounges)
    if (existingLounge.is_system_lounge || existingLounge.user_id !== user.id) {
      return NextResponse.json(
        {
          error:
            'Permission denied. Cannot delete system lounges or lounges owned by others.',
        },
        { status: 403 }
      );
    }

    // Check if lounge is in use
    if (existingLounge.creator_count > 0 || existingLounge.content_count > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete lounge in use',
          details: `This lounge is assigned to ${existingLounge.creator_count} creators and ${existingLounge.content_count} content items. Remove all associations before deleting.`,
        },
        { status: 409 }
      );
    }

    // Check if lounge has child lounges
    const { data: childLounges } = await supabase
      .from('lounges')
      .select('id')
      .eq('parent_lounge_id', id)
      .limit(1);

    if (childLounges && childLounges.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete lounge with child lounges',
          details: 'Please delete or reassign all child lounges first.',
        },
        { status: 409 }
      );
    }

    // Delete the lounge
    const { error: deleteError } = await supabase
      .from('lounges')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // Error deleting lounge - details in response
      return NextResponse.json(
        { error: 'Failed to delete lounge' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Lounge deleted successfully',
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
