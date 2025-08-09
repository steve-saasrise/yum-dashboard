import { NextRequest, NextResponse } from 'next/server';
import { unfurl } from 'unfurl.js';

const CACHE_DURATION_SECONDS = 60 * 60 * 24; // 24 hours

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'A valid URL string is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const unfurlResponse = await unfurl(url);

    const response = {
      title: unfurlResponse.title || null,
      description: unfurlResponse.description || null,
      favicon: unfurlResponse.favicon || null,
      image: unfurlResponse.open_graph?.images?.[0]?.url || null,
      siteName: unfurlResponse.open_graph?.site_name || null,
      url: url,
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': `public, s-maxage=${CACHE_DURATION_SECONDS}, stale-while-revalidate`,
      },
    });
  } catch (error: any) {
    console.error('Error fetching OpenGraph data:', error);

    if (error?.code === 'ENOTFOUND') {
      return NextResponse.json({ error: 'URL not found' }, { status: 404 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}
