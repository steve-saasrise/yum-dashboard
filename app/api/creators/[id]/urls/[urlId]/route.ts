import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  PlatformDetector,
  PlatformDetectionError,
} from '@/lib/platform-detector';

const updateUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; urlId: string }> }
) {
  try {
    const { id: creatorId, urlId } = await params;

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
    const validation = updateUrlSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    // Get current URL with ownership check
    const { data: currentUrl, error: fetchError } = await supabase
      .from('creator_urls')
      .select(
        `
        *,
        creators!inner(
          id,
          user_id
        )
      `
      )
      .eq('id', urlId)
      .eq('creator_id', creatorId)
      .eq('creators.user_id', user.id)
      .single();

    if (fetchError || !currentUrl) {
      return NextResponse.json(
        { error: 'URL not found or access denied' },
        { status: 404 }
      );
    }

    // Detect platform for new URL
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

    // If platform changed, check if new platform already exists for this creator
    if (platformInfo.platform !== currentUrl.platform) {
      const { data: existingPlatform } = await supabase
        .from('creator_urls')
        .select('id')
        .eq('creator_id', creatorId)
        .eq('platform', platformInfo.platform)
        .neq('id', urlId)
        .single();

      if (existingPlatform) {
        return NextResponse.json(
          {
            error: `A ${platformInfo.platform} URL already exists for this creator`,
          },
          { status: 409 }
        );
      }
    }

    // Update the URL
    const { data: updatedUrl, error: updateError } = await supabase
      .from('creator_urls')
      .update({
        url: url,
        platform: platformInfo.platform,
        normalized_url: platformInfo.profileUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', urlId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update URL' },
        { status: 500 }
      );
    }

    // Update creator's updated_at timestamp
    await supabase
      .from('creators')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', creatorId);

    return NextResponse.json({
      success: true,
      message: 'URL updated successfully',
      data: updatedUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; urlId: string }> }
) {
  try {
    const { id: creatorId, urlId } = await params;

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

    // Check how many URLs the creator has
    const { data: urlCount, error: countError } = await supabase
      .from('creator_urls')
      .select('id', { count: 'exact' })
      .eq('creator_id', creatorId);

    if (countError) {
      return NextResponse.json(
        { error: 'Failed to check URL count' },
        { status: 500 }
      );
    }

    if (!urlCount || urlCount.length <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last URL. A creator must have at least one URL.' },
        { status: 400 }
      );
    }

    // First verify ownership
    const { data: urlToDelete, error: verifyError } = await supabase
      .from('creator_urls')
      .select(
        `
        id,
        creators!inner(
          user_id
        )
      `
      )
      .eq('id', urlId)
      .eq('creator_id', creatorId)
      .eq('creators.user_id', user.id)
      .single();

    if (verifyError || !urlToDelete) {
      return NextResponse.json(
        { error: 'URL not found or access denied' },
        { status: 404 }
      );
    }

    // Now delete the URL
    const { error: deleteError } = await supabase
      .from('creator_urls')
      .delete()
      .eq('id', urlId);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete URL' },
        { status: 500 }
      );
    }

    // Update creator's updated_at timestamp
    await supabase
      .from('creators')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', creatorId);

    return NextResponse.json({
      success: true,
      message: 'URL deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}