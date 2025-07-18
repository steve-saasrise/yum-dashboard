import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { RSSFetchOptionsSchema } from '@/types/rss';

// Request schemas
const testFetchUrlSchema = z.object({
  url: z.string().url('Invalid RSS URL'),
  options: RSSFetchOptionsSchema.optional(),
  store: z.boolean().optional().describe('Store fetched content to database'),
  creator_id: z
    .string()
    .uuid()
    .optional()
    .describe('Creator ID for storage (required if store=true)'),
});

const testFetchCreatorSchema = z.object({
  creator_id: z.string().uuid('Invalid creator ID'),
  options: RSSFetchOptionsSchema.optional(),
  store: z.boolean().optional().describe('Store fetched content to database'),
});

const testFetchCreatorsSchema = z.object({
  platform: z.literal('rss').optional(),
  limit: z.number().min(1).max(10).optional(),
  options: RSSFetchOptionsSchema.optional(),
  store: z.boolean().optional().describe('Store fetched content to database'),
});

/**
 * Test RSS Fetching Endpoint
 *
 * This endpoint provides three modes:
 * 1. Test any RSS URL directly
 * 2. Fetch from a specific RSS creator in the database
 * 3. Fetch from all RSS creators for the authenticated user
 */
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
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'url';

    let result;

    switch (mode) {
      case 'url': {
        // Test fetching from a direct URL
        const validation = testFetchUrlSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Invalid input',
              details: validation.error.errors.map((e) => e.message),
            },
            { status: 400 }
          );
        }

        const { url, options, store, creator_id } = validation.data;

        // If storing, validate creator_id is provided and belongs to user
        if (store) {
          if (!creator_id) {
            return NextResponse.json(
              { error: 'creator_id is required when store=true' },
              { status: 400 }
            );
          }

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

        const fetchOptions = {
          ...options,
          storage: store
            ? {
                enabled: true,
                creator_id: creator_id!,
                supabaseClient: supabase,
              }
            : undefined,
        };

        const fetcher = new RSSFetcher(fetchOptions);
        result = await fetcher.parseURL(url, fetchOptions);
        break;
      }

      case 'creator': {
        // Test fetching from a specific creator
        const validation = testFetchCreatorSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Invalid input',
              details: validation.error.errors.map((e) => e.message),
            },
            { status: 400 }
          );
        }

        const { creator_id, options, store } = validation.data;

        // Get creator's RSS URLs
        const { data: creatorUrls, error: urlError } = await supabase
          .from('creator_urls')
          .select('url, creators!inner(display_name, user_id)')
          .eq('creators.user_id', user.id)
          .eq('creator_id', creator_id)
          .eq('platform', 'rss');

        if (urlError) {
          return NextResponse.json(
            { error: 'Failed to fetch creator URLs' },
            { status: 500 }
          );
        }

        if (!creatorUrls || creatorUrls.length === 0) {
          return NextResponse.json(
            { error: 'No RSS URLs found for this creator' },
            { status: 404 }
          );
        }

        // Prepare fetch options with storage if enabled
        const fetchOptions = {
          ...options,
          storage: store
            ? {
                enabled: true,
                creator_id,
                supabaseClient: supabase,
              }
            : undefined,
        };

        // Fetch from the first RSS URL (creators can have multiple URLs)
        const fetcher = new RSSFetcher(fetchOptions);
        result = await fetcher.parseURL(creatorUrls[0].url, fetchOptions);

        // Add creator context to the result
        result.creatorContext = {
          creator_id,
          creator_name: (creatorUrls[0] as any).creators.display_name,
          url: creatorUrls[0].url,
        };
        break;
      }

      case 'creators': {
        // Test fetching from all user's RSS creators
        const validation = testFetchCreatorsSchema.safeParse(body);
        if (!validation.success) {
          return NextResponse.json(
            {
              error: 'Invalid input',
              details: validation.error.errors.map((e) => e.message),
            },
            { status: 400 }
          );
        }

        const { limit = 5, options, store } = validation.data;

        // Get user's RSS creators
        const { data: rssCreators, error: creatorsError } = await supabase
          .from('creator_urls')
          .select(
            `
            url,
            creator_id,
            creators!inner(display_name, user_id)
          `
          )
          .eq('creators.user_id', user.id)
          .eq('platform', 'rss')
          .limit(limit);

        if (creatorsError) {
          return NextResponse.json(
            { error: 'Failed to fetch RSS creators' },
            { status: 500 }
          );
        }

        if (!rssCreators || rssCreators.length === 0) {
          return NextResponse.json(
            {
              error: 'No RSS creators found',
              suggestion:
                'Add some RSS feeds using the "Add Creator" button in your dashboard',
            },
            { status: 404 }
          );
        }

        // Fetch from all RSS URLs with storage if enabled
        const results = await Promise.all(
          rssCreators.map(async (creator) => {
            const fetchOptions = {
              ...options,
              storage: store
                ? {
                    enabled: true,
                    creator_id: creator.creator_id,
                    supabaseClient: supabase,
                  }
                : undefined,
            };

            const fetcher = new RSSFetcher(fetchOptions);
            return fetcher.parseURL(creator.url, fetchOptions);
          })
        );

        // Add creator context to each result
        result = {
          success: true,
          results: results.map((fetchResult, index) => ({
            ...fetchResult,
            creatorContext: {
              creator_id: rssCreators[index].creator_id,
              creator_name: (rssCreators[index] as any).creators.display_name,
              url: rssCreators[index].url,
            },
          })),
          summary: {
            total: results.length,
            successful: results.filter((r) => r.success).length,
            failed: results.filter((r) => !r.success).length,
            stored: store
              ? {
                  total: results.reduce(
                    (acc, r) =>
                      acc +
                      (r.storedContent?.created || 0) +
                      (r.storedContent?.updated || 0),
                    0
                  ),
                  created: results.reduce(
                    (acc, r) => acc + (r.storedContent?.created || 0),
                    0
                  ),
                  updated: results.reduce(
                    (acc, r) => acc + (r.storedContent?.updated || 0),
                    0
                  ),
                  errors: results.reduce(
                    (acc, r) => acc + (r.storedContent?.errors?.length || 0),
                    0
                  ),
                }
              : undefined,
          },
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use: url, creator, or creators' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      mode,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      route: 'POST /api/test-fetch',
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('Error in test-fetch endpoint:', errorDetails);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
          details: errorDetails,
        }),
      },
      { status: 500 }
    );
  }
}

/**
 * Get available RSS creators for testing
 */
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

    // Get user's RSS creators
    const { data: rssCreators, error: creatorsError } = await supabase
      .from('creator_urls')
      .select(
        `
        url,
        creator_id,
        validation_status,
        creators!inner(
          id,
          display_name,
          bio,
          user_id,
          created_at
        )
      `
      )
      .eq('creators.user_id', user.id)
      .eq('platform', 'rss')
      .order('creators.created_at', { ascending: false });

    if (creatorsError) {
      return NextResponse.json(
        { error: 'Failed to fetch RSS creators' },
        { status: 500 }
      );
    }

    const creators =
      rssCreators?.map((item) => ({
        creator_id: item.creator_id,
        display_name: (item as any).creators.display_name,
        bio: (item as any).creators.bio,
        url: item.url,
        validation_status: item.validation_status,
        created_at: (item as any).creators.created_at,
      })) || [];

    return NextResponse.json({
      success: true,
      data: {
        rss_creators: creators,
        total: creators.length,
        examples: {
          test_url: {
            description: 'Test any RSS URL directly',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=url',
            body: {
              url: 'https://feeds.bbci.co.uk/news/rss.xml',
              options: { maxItems: 5 },
            },
          },
          test_url_with_storage: {
            description: 'Test URL and store content to database',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=url',
            body: {
              url: 'https://feeds.bbci.co.uk/news/rss.xml',
              options: { maxItems: 5 },
              store: true,
              creator_id: 'creator-uuid-here',
            },
          },
          test_creator: {
            description: 'Test fetching from a specific creator',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=creator',
            body: {
              creator_id: 'creator-uuid-here',
              options: { maxItems: 3 },
            },
          },
          test_creator_with_storage: {
            description: 'Test creator and store content to database',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=creator',
            body: {
              creator_id: 'creator-uuid-here',
              options: { maxItems: 3 },
              store: true,
            },
          },
          test_all: {
            description: 'Test fetching from all your RSS creators',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=creators',
            body: {
              limit: 3,
              options: { maxItems: 2 },
            },
          },
          test_all_with_storage: {
            description: 'Test all creators and store content to database',
            method: 'POST',
            endpoint: '/api/test-fetch?mode=creators',
            body: {
              limit: 3,
              options: { maxItems: 2 },
              store: true,
            },
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
      route: 'GET /api/test-fetch',
    };

    if (process.env.NODE_ENV === 'development') {
      console.error('Error in test-fetch GET endpoint:', errorDetails);
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && {
          details: errorDetails,
        }),
      },
      { status: 500 }
    );
  }
}
