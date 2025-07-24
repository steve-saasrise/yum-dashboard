import { NextResponse } from 'next/server';
import { ApifyFetcher } from '@/lib/content-fetcher/apify-fetcher';

export async function GET() {
  try {
    if (!process.env.APIFY_API_KEY) {
      return NextResponse.json({
        error: 'APIFY_API_KEY not configured',
      });
    }

    const fetcher = new ApifyFetcher({
      apiKey: process.env.APIFY_API_KEY,
    });

    console.log(
      '[Test] Testing apimaestro/linkedin-profile-posts with satyanadella profile'
    );

    // Test with a LinkedIn profile URL
    const items = await fetcher.fetchLinkedInContent(
      ['https://www.linkedin.com/in/satyanadella/'],
      {
        maxResults: 5,
      }
    );

    return NextResponse.json({
      success: true,
      itemsCount: items.length,
      items: items,
      actorUsed: 'apimaestro/linkedin-profile-posts',
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
  }
}
