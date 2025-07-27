import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import {
  PlatformDetector,
  PlatformDetectionError,
} from '@/lib/platform-detector';

const addUrlSchema = z.object({
  url: z.string().url('Invalid URL format'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: creatorId } = await params;

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

    // Verify creator exists
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', creatorId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = addUrlSchema.safeParse(body);
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

    // Detect platform
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

    // Check if this URL already exists for this creator
    const { data: existingUrl, error: checkError } = await supabase
      .from('creator_urls')
      .select('id')
      .eq('creator_id', creatorId)
      .eq('normalized_url', platformInfo.profileUrl)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to check existing URLs' },
        { status: 500 }
      );
    }

    if (existingUrl) {
      return NextResponse.json(
        { error: 'This URL is already added to this creator' },
        { status: 409 }
      );
    }

    // Check if this platform already exists for this creator
    const { data: existingPlatform, error: platformCheckError } = await supabase
      .from('creator_urls')
      .select('id, url')
      .eq('creator_id', creatorId)
      .eq('platform', platformInfo.platform)
      .single();

    if (platformCheckError && platformCheckError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to check platform' },
        { status: 500 }
      );
    }

    if (existingPlatform) {
      return NextResponse.json(
        {
          error: `A ${platformInfo.platform} URL already exists for this creator`,
          existingUrl: existingPlatform.url,
        },
        { status: 409 }
      );
    }

    // Add the new URL
    const { data: newUrl, error: insertError } = await supabase
      .from('creator_urls')
      .insert({
        creator_id: creatorId,
        platform: platformInfo.platform,
        url: url,
        normalized_url: platformInfo.profileUrl,
        validation_status: 'valid',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to add URL' }, { status: 500 });
    }

    // Update creator's updated_at timestamp
    await supabase
      .from('creators')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', creatorId);

    return NextResponse.json({
      success: true,
      message: 'URL added successfully',
      data: newUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// GET endpoint to list all URLs for a creator
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: creatorId } = await params;

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

    // Get URLs for the creator (curators can see all creators)
    const { data: urls, error: fetchError } = await supabase
      .from('creator_urls')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      return NextResponse.json(
        { error: 'Failed to fetch URLs' },
        { status: 500 }
      );
    }

    if (!urls || urls.length === 0) {
      return NextResponse.json(
        { error: 'No URLs found for this creator' },
        { status: 404 }
      );
    }

    // No need to clean up the response since we're not joining with creators
    const cleanUrls = urls;

    return NextResponse.json({
      success: true,
      data: cleanUrls,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
