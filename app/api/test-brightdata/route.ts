import { NextRequest, NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';

export async function GET(request: NextRequest) {
  try {
    // Get test URL from query params or use a default
    const searchParams = request.nextUrl.searchParams;
    const profileUrl =
      searchParams.get('url') || 'https://www.linkedin.com/in/satyanadella/';
    const testConnection = searchParams.get('test') === 'true';

    // Check if Bright Data API key is configured
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        {
          error: 'Bright Data API key not configured',
          message:
            'Please add BRIGHTDATA_API_KEY to your environment variables',
        },
        { status: 500 }
      );
    }

    // Initialize Bright Data fetcher
    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    // Test connection if requested
    if (testConnection) {
      console.log('[Test] Testing Bright Data connection...');
      const isConnected = await brightDataFetcher.testConnection();

      return NextResponse.json({
        connected: isConnected,
        message: isConnected
          ? 'Successfully connected to Bright Data API'
          : 'Failed to connect to Bright Data API. Please check your API key.',
      });
    }

    // Fetch LinkedIn content
    console.log(`[Test] Fetching LinkedIn content for: ${profileUrl}`);

    const startTime = Date.now();
    const items = await brightDataFetcher.fetchLinkedInContent([profileUrl], {
      maxResults: 3, // Just fetch 3 posts for testing
      timeout: 300000, // 5 minute timeout for testing
    });
    const duration = Date.now() - startTime;

    // Return results
    return NextResponse.json({
      success: true,
      profile: profileUrl,
      postsFound: items.length,
      duration: `${duration}ms`,
      posts: items.map((item, index) => ({
        index: index + 1,
        platform: item.platform,
        url: item.url,
        title: item.title,
        description: item.description?.substring(0, 100) + '...',
        published: item.published_at,
        media: item.media_urls?.length || 0,
        engagement: item.engagement_metrics,
      })),
      // Include first full post for detailed inspection
      firstPost: items[0] || null,
    });
  } catch (error) {
    console.error('[Test] Error testing Bright Data:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch LinkedIn content',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, maxResults = 5 } = body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Please provide an array of LinkedIn profile URLs',
        },
        { status: 400 }
      );
    }

    // Check if Bright Data API key is configured
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        {
          error: 'Bright Data API key not configured',
          message:
            'Please add BRIGHTDATA_API_KEY to your environment variables',
        },
        { status: 500 }
      );
    }

    // Initialize Bright Data fetcher
    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    // Fetch LinkedIn content for all URLs
    console.log(`[Test] Fetching LinkedIn content for ${urls.length} profiles`);

    const results = [];
    for (const url of urls) {
      try {
        const items = await brightDataFetcher.fetchLinkedInContent([url], {
          maxResults,
        });

        results.push({
          url,
          success: true,
          postsFound: items.length,
          posts: items,
        });
      } catch (error) {
        results.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      profilesProcessed: urls.length,
      results,
    });
  } catch (error) {
    console.error('[Test] Error testing Bright Data:', error);

    return NextResponse.json(
      {
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
