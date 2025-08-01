import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get lounge_id from query params if provided
    const { searchParams } = request.nextUrl;
    const loungeId = searchParams.get('lounge_id');

    // Get all creator URLs to count creators by platform
    let creatorUrlsQuery = supabase
      .from('creator_urls')
      .select('creator_id, platform');

    // If lounge_id is provided, filter by creators in that lounge
    if (loungeId) {
      // Get creator IDs for the lounge
      const { data: creatorLounges } = await supabase
        .from('creator_lounges')
        .select('creator_id')
        .eq('lounge_id', loungeId);

      const creatorIds = creatorLounges?.map((cl) => cl.creator_id) || [];
      
      if (creatorIds.length === 0) {
        // No creators in this lounge, return empty platforms
        return NextResponse.json({
          platforms: [
            { name: 'YouTube', platform: 'youtube', count: 0 },
            { name: 'X', platform: 'twitter', count: 0 },
            { name: 'LinkedIn', platform: 'linkedin', count: 0 },
            { name: 'Threads', platform: 'threads', count: 0 },
            { name: 'RSS', platform: 'rss', count: 0 },
          ]
        });
      }

      creatorUrlsQuery = creatorUrlsQuery.in('creator_id', creatorIds);
    }

    const { data: creatorUrls, error: urlsError } = await creatorUrlsQuery;

    if (urlsError) {
      console.error('Error fetching creator URLs:', urlsError);
      return NextResponse.json(
        { error: 'Failed to fetch platform data' },
        { status: 500 }
      );
    }

    // Count unique creators by platform
    const platformCreators = new Map<string, Set<string>>();
    creatorUrls?.forEach((url) => {
      // Normalize platform names (e.g., 'x' to 'twitter')
      let platform = url.platform;
      if (platform === 'x') platform = 'twitter';
      
      if (!platformCreators.has(platform)) {
        platformCreators.set(platform, new Set());
      }
      platformCreators.get(platform)!.add(url.creator_id);
    });

    // Convert to counts
    const platformCounts = new Map<string, number>();
    platformCreators.forEach((creators, platform) => {
      platformCounts.set(platform, creators.size);
    });

    // Transform to array format with proper names
    const platforms = [
      { name: 'YouTube', platform: 'youtube', count: platformCounts.get('youtube') || 0 },
      { name: 'X', platform: 'twitter', count: platformCounts.get('twitter') || 0 },
      { name: 'LinkedIn', platform: 'linkedin', count: platformCounts.get('linkedin') || 0 },
      { name: 'Threads', platform: 'threads', count: platformCounts.get('threads') || 0 },
      { name: 'RSS', platform: 'rss', count: platformCounts.get('rss') || 0 },
    ];

    return NextResponse.json({ platforms });
  } catch (error) {
    console.error('Error in platforms API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}