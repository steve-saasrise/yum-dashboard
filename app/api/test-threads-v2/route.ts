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

    console.log('[Test] Testing Threads actor with username: aaron.rupar');

    // Test with just the username
    const items = await fetcher.fetchThreadsContent(['aaron.rupar'], {
      resultsLimit: 5,
    });

    return NextResponse.json({
      success: true,
      itemsCount: items.length,
      items: items,
      actorUsed: 'red.cars/threads-scraper',
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
  }
}
