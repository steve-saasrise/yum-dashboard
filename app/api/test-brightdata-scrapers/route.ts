import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
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

    // Try to list available scrapers/datasets
    const apiKey = process.env.BRIGHTDATA_API_KEY;

    // Try the datasets endpoint
    console.log('[Test] Fetching available datasets...');
    const datasetsResponse = await fetch(
      'https://api.brightdata.com/datasets/v3',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    let datasets = null;
    if (datasetsResponse.ok) {
      datasets = await datasetsResponse.json();
    }

    // Try the scrapers endpoint (different API path)
    console.log('[Test] Fetching available scrapers...');
    const scrapersResponse = await fetch(
      'https://api.brightdata.com/scrapers/v1',
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    let scrapers = null;
    if (scrapersResponse.ok) {
      scrapers = await scrapersResponse.json();
    }

    // Return both results
    return NextResponse.json({
      success: true,
      datasets: datasets || 'No datasets found or endpoint not accessible',
      scrapers: scrapers || 'No scrapers found or endpoint not accessible',
      message:
        'Check the console for the actual scraper/dataset IDs you should use',
    });
  } catch (error) {
    console.error('[Test] Error listing Bright Data scrapers:', error);

    return NextResponse.json(
      {
        error: 'Failed to list scrapers',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
