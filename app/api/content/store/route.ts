import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import {
  Platform,
  ContentProcessingStatus,
  isValidPlatform,
} from '@/types/content';

// Schema for single content storage
const storeContentSchema = z.object({
  creator_id: z.string().uuid('Invalid creator ID'),
  platform: z.string().refine(isValidPlatform, 'Invalid platform'),
  platform_content_id: z.string().min(1, 'Platform content ID is required'),
  url: z.string().url('Invalid URL'),
  title: z.string().optional(),
  description: z.string().optional(),
  thumbnail_url: z.string().url().optional(),
  published_at: z.string().datetime().optional(),
  content_body: z.string().optional(),
  media_urls: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['image', 'video', 'audio', 'document']),
        title: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
        duration: z.number().optional(),
        size: z.number().optional(),
      })
    )
    .optional(),
  engagement_metrics: z
    .object({
      views: z.number().optional(),
      likes: z.number().optional(),
      comments: z.number().optional(),
      shares: z.number().optional(),
      retweets: z.number().optional(),
      bookmarks: z.number().optional(),
      reactions: z.record(z.number()).optional(),
      custom: z.record(z.any()).optional(),
    })
    .optional(),
});

// Schema for batch content storage
const batchStoreContentSchema = z.object({
  contents: z.array(storeContentSchema).min(1).max(100),
});

// Schema for normalization request
const normalizeAndStoreSchema = z.object({
  creator_id: z.string().uuid('Invalid creator ID'),
  platform: z.string().refine(isValidPlatform, 'Invalid platform'),
  platform_data: z.any(), // Platform-specific data
  source_url: z.string().url().optional(),
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

    // Parse request body
    const body = await request.json();

    // Determine request type
    const isBatch = Array.isArray(body.contents);
    const isNormalize = body.platform_data !== undefined;

    // Initialize services
    const contentService = new ContentService(supabase);
    const normalizer = new ContentNormalizer();

    // Handle normalization request
    if (isNormalize) {
      const validation = normalizeAndStoreSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            details: validation.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      const { creator_id, platform, platform_data, source_url } =
        validation.data;

      // Verify creator ownership
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('id')
        .eq('id', creator_id)
        .eq('user_id', user.id)
        .single();

      if (creatorError || !creator) {
        return NextResponse.json(
          { error: 'Creator not found or access denied' },
          { status: 404 }
        );
      }

      // Normalize and store content
      try {
        const normalized = normalizer.normalize({
          creator_id,
          platform: platform as Platform,
          platformData: platform_data,
          sourceUrl: source_url,
        });

        const stored = await contentService.storeContent(normalized);

        return NextResponse.json({
          success: true,
          content: stored,
          normalized_from: 'platform_data',
        });
      } catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'DUPLICATE_CONTENT') {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }
        throw error;
      }
    }

    // Handle batch storage
    if (isBatch) {
      const validation = batchStoreContentSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Invalid batch input',
            details: validation.error.errors.map((e) => ({
              path: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      // Verify all creators belong to user
      const creatorIds = [
        ...new Set(validation.data.contents.map((c) => c.creator_id)),
      ];
      const { data: creators, error: creatorsError } = await supabase
        .from('creators')
        .select('id')
        .in('id', creatorIds)
        .eq('user_id', user.id);

      if (creatorsError || creators?.length !== creatorIds.length) {
        return NextResponse.json(
          { error: 'One or more creators not found or access denied' },
          { status: 404 }
        );
      }

      // Store batch content
      const result = await contentService.storeMultipleContent(
        validation.data.contents
      );

      return NextResponse.json(
        {
          success: result.success,
          batch_result: result,
        },
        { status: result.success ? 200 : 207 }
      ); // 207 Multi-Status for partial success
    }

    // Handle single content storage
    const validation = storeContentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    // Verify creator ownership
    const { data: creator, error: creatorError } = await supabase
      .from('creators')
      .select('id')
      .eq('id', validation.data.creator_id)
      .eq('user_id', user.id)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json(
        { error: 'Creator not found or access denied' },
        { status: 404 }
      );
    }

    // Store single content
    try {
      const content = await contentService.storeContent(validation.data);

      return NextResponse.json(
        {
          success: true,
          content,
        },
        { status: 201 }
      );
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'DUPLICATE_CONTENT') {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    // Content storage error - details in response
    return NextResponse.json(
      {
        error: 'Failed to store content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve content
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const creator_id = searchParams.get('creator_id');
    const platform = searchParams.get('platform');
    const processing_status = searchParams.get('processing_status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    // If creator_id is provided, verify ownership
    if (creator_id) {
      const { data: creator, error: creatorError } = await supabase
        .from('creators')
        .select('id')
        .eq('id', creator_id)
        .eq('user_id', user.id)
        .single();

      if (creatorError || !creator) {
        return NextResponse.json(
          { error: 'Creator not found or access denied' },
          { status: 404 }
        );
      }
    }

    // Get all user's creators if no specific creator_id
    const { data: userCreators } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id);

    const creatorIds = creator_id
      ? [creator_id]
      : userCreators?.map((c) => c.id) || [];

    if (creatorIds.length === 0) {
      return NextResponse.json({
        content: [],
        total: 0,
      });
    }

    // Initialize content service and fetch content
    const contentService = new ContentService(supabase);
    const result = await contentService.getContentList({
      creator_id: creator_id || undefined,
      platform: platform as Platform | undefined,
      processing_status: processing_status as ContentProcessingStatus | undefined,
      limit,
      offset,
    });

    // Filter results to only include user's content
    const filteredContent = result.content.filter((c) =>
      creatorIds.includes(c.creator_id)
    );

    return NextResponse.json({
      content: filteredContent,
      total: filteredContent.length,
      pagination: {
        limit,
        offset,
        has_more: filteredContent.length === limit,
      },
    });
  } catch (error) {
    // Content retrieval error - details in response
    return NextResponse.json(
      {
        error: 'Failed to retrieve content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
