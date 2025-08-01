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

    // Delete all associated data in the correct order to avoid foreign key constraints

    // 0. Get creator to find avatar URL before deletion
    const { data: creatorData } = await supabase
      .from('creators')
      .select('avatar_url')
      .eq('id', id)
      .single();

    // 1. Delete all content for this creator
    const { error: contentDeleteError } = await supabase
      .from('content')
      .delete()
      .eq('creator_id', id);

    if (contentDeleteError) {
      console.error('Failed to delete creator content:', contentDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete creator content' },
        { status: 500 }
      );
    }

    // 2. Delete creator URLs
    const { error: urlsDeleteError } = await supabase
      .from('creator_urls')
      .delete()
      .eq('creator_id', id);

    if (urlsDeleteError) {
      console.error('Failed to delete creator URLs:', urlsDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete creator URLs' },
        { status: 500 }
      );
    }

    // 3. Delete creator-lounge relationships
    const { error: loungesDeleteError } = await supabase
      .from('creator_lounges')
      .delete()
      .eq('creator_id', id);

    if (loungesDeleteError) {
      console.error('Failed to delete creator lounges:', loungesDeleteError);
      return NextResponse.json(
        { error: 'Failed to delete creator lounge relationships' },
        { status: 500 }
      );
    }

    // 4. Finally, delete the creator record itself
    const { error: deleteError } = await supabase
      .from('creators')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Failed to delete creator:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete creator' },
        { status: 500 }
      );
    }

    // 5. Clean up avatar from storage if it exists
    if (creatorData?.avatar_url) {
      try {
        const avatarPath = creatorData.avatar_url.split('/creators/')[1];
        if (avatarPath) {
          await supabase.storage.from('creators').remove([avatarPath]);
        }
      } catch (error) {
        // Failed to delete avatar - not critical, log and continue
        console.error('Failed to delete creator avatar:', error);
      }
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
