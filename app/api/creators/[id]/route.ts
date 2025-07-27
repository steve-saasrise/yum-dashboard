import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';

const updateCreatorSchema = z.object({
  display_name: z
    .string()
    .min(1, 'Display name is required')
    .max(100)
    .optional(),
  description: z.string().max(500).optional(),
  avatar_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Parse and validate request body
    const body = await request.json();
    const validation = updateCreatorSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Add updated timestamp
    const dataWithTimestamp = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Update creator - curators can update any creator
    const { data: updatedCreator, error: updateError } = await supabase
      .from('creators')
      .update(dataWithTimestamp)
      .eq('id', id)
      .select(
        `
        *,
        creator_topics (
          topics (
            id,
            name,
            color
          )
        )
      `
      )
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Creator not found' },
          { status: 404 }
        );
      }
      // Error updating creator - details in response
      return NextResponse.json(
        { error: 'Failed to update creator' },
        { status: 500 }
      );
    }

    if (!updatedCreator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Creator updated successfully',
      data: updatedCreator,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    // Delete creator - curators can delete any creator
    const { error: deleteError } = await supabase
      .from('creators')
      .delete()
      .eq('id', id);

    if (deleteError) {
      // Error deleting creator - details in response
      return NextResponse.json(
        { error: 'Failed to delete creator' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Creator deleted successfully',
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
