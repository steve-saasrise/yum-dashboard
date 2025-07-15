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

interface RouteContext {
  params: {
    id: string;
  };
}

export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;

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

    // Update creator (RLS policies ensure user can only update their own creators)
    const { data: updatedCreator, error: updateError } = await supabase
      .from('creators')
      .update(dataWithTimestamp)
      .eq('id', id)
      .eq('user_id', user.id) // Extra safety check
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Error updating creator:', updateError);
      }
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
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in PUT /api/creators/[id]:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = context.params;

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

    // Delete creator (RLS policies ensure user can only delete their own creators)
    const { error: deleteError } = await supabase
      .from('creators')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id); // Extra safety check

    if (deleteError) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error deleting creator:', deleteError);
      }
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
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error in DELETE /api/creators/[id]:', error);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
