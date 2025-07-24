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

    console.log('[Test] Testing curious_coder/threads-scraper');

    // Test with Selena Gomez
    const items = await fetcher.fetchThreadsContent(['selenagomez'], {
      resultsLimit: 5,
    });

    return NextResponse.json({
      success: true,
      message: 'Threads actor is working!',
      actorUsed: 'curious_coder/threads-scraper',
      itemsCount: items.length,
      items: items.slice(0, 3), // Show first 3 items
      sampleItem: items[0],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Test] Error:', error);

    // Check if it's still a rental error
    const isRentalError = error?.message?.includes('rent a paid Actor');

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        isRentalError,
        details: error,
        actorUsed: 'curious_coder/threads-scraper',
      },
      { status: 500 }
    );
  }
}
