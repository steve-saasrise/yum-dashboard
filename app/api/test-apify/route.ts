import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';
import { ContentService } from '@/lib/services/content-service';
import type { CreateContentInput } from '@/types/content';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase server client
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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Apify is configured
    if (!process.env.APIFY_API_KEY) {
      return NextResponse.json(
        {
          error: 'Apify not configured',
          message: 'Please add APIFY_API_KEY to your environment variables',
        },
        { status: 500 }
      );
    }

    // Initialize Apify fetcher
    const apifyFetcher = new ApifyFetcher({
      apiKey: process.env.APIFY_API_KEY,
    });

    // Test connection
    const connected = await apifyFetcher.testConnection();
    if (!connected) {
      return NextResponse.json(
        {
          error: 'Failed to connect to Apify',
          message: 'Please check your APIFY_API_KEY',
        },
        { status: 500 }
      );
    }

    // Get test mode from query params
    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') || 'twitter';
    const testUrl = url.searchParams.get('url');
    const store = url.searchParams.get('store') === 'true';

    let results: any = {};

    // Test specific platform
    if (platform === 'twitter') {
      const twitterUrl = testUrl || 'https://twitter.com/elonmusk';
      console.log(`Testing Twitter fetch for: ${twitterUrl}`);

      const items = await apifyFetcher.fetchTwitterContent([twitterUrl], {
        maxTweets: 5,
      });

      results = {
        platform: 'twitter',
        url: twitterUrl,
        itemCount: items.length,
        items: items.slice(0, 3), // Show first 3 items
        sampleItem: items[0],
      };

      // Optionally store the content
      if (store && user) {
        // Get or create test creator
        const { data: creators } = await supabase
          .from('creators')
          .select('id')
          .eq('user_id', user.id)
          .eq('display_name', 'Test Twitter Creator')
          .single();

        let creatorId = creators?.id;

        if (!creatorId) {
          const { data: newCreator } = await supabase
            .from('creators')
            .insert({
              user_id: user.id,
              display_name: 'Test Twitter Creator',
              avatar_url: (items[0] as any)?.metadata?.author_avatar,
              bio: 'Test creator for Apify integration',
              is_active: true,
            })
            .select()
            .single();

          creatorId = newCreator?.id;

          // Add creator URL
          if (creatorId) {
            await supabase.from('creator_urls').insert({
              creator_id: creatorId,
              platform: 'twitter',
              url: twitterUrl,
              metadata: {
                username: (items[0] as any)?.metadata?.author_username,
              },
            });
          }
        }

        if (creatorId) {
          const contentService = new ContentService(supabase);
          const contentToStore: CreateContentInput[] = items.map((item) => ({
            ...item,
            creator_id: creatorId,
          }));

          const storeResult =
            await contentService.storeMultipleContent(contentToStore);
          results.storage = storeResult;
        }
      }
    } else if (platform === 'threads') {
      const username = testUrl ? testUrl.match(/@([^/]+)/)?.[1] : 'zuck';
      console.log(`Testing Threads fetch for: @${username}`);

      const items = await apifyFetcher.fetchThreadsContent(
        [username || 'zuck'],
        {
          resultsLimit: 5,
        }
      );

      results = {
        platform: 'threads',
        username: username,
        itemCount: items.length,
        items: items.slice(0, 3),
        sampleItem: items[0],
      };
    } else if (platform === 'linkedin') {
      // LinkedIn testing has been moved to test-brightdata route
      return NextResponse.json(
        {
          error: 'LinkedIn testing has been moved',
          message:
            'Please use /api/test-brightdata endpoint for LinkedIn testing with BrightData',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Apify test successful for ${platform}`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[test-apify] Error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
