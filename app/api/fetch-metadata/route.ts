import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Use Bright Data to fetch the page
    const brightDataUrl = process.env.BRIGHTDATA_SCRAPING_URL;
    if (!brightDataUrl) {
      // Fallback to basic fetch if Bright Data is not configured
      return await fetchBasicMetadata(url);
    }

    // Fetch via Bright Data
    const response = await fetch(brightDataUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      },
      body: JSON.stringify({
        url,
        format: 'json',
        extract_metadata: true,
      }),
    });

    if (!response.ok) {
      console.error('Bright Data fetch failed:', response.status);
      return await fetchBasicMetadata(url);
    }

    const data = await response.json();

    // Extract OpenGraph data
    const metadata = {
      title: data.og_title || data.title,
      description: data.og_description || data.description,
      imageUrl: data.og_image || data.image,
      siteName: data.og_site_name || data.site_name,
      url,
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}

// Fallback basic metadata fetching
async function fetchBasicMetadata(url: string) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DailyNewsBot/1.0; +https://dailynews.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();

    // Basic regex to extract OpenGraph tags
    const ogImage = html.match(
      /<meta\s+property="og:image"\s+content="([^"]+)"/i
    )?.[1];
    const ogTitle = html.match(
      /<meta\s+property="og:title"\s+content="([^"]+)"/i
    )?.[1];
    const ogDescription = html.match(
      /<meta\s+property="og:description"\s+content="([^"]+)"/i
    )?.[1];
    const ogSiteName = html.match(
      /<meta\s+property="og:site_name"\s+content="([^"]+)"/i
    )?.[1];

    // Fallback to regular title tag
    const title = ogTitle || html.match(/<title>([^<]+)<\/title>/i)?.[1];

    // Fallback to meta description
    const description =
      ogDescription ||
      html.match(/<meta\s+name="description"\s+content="([^"]+)"/i)?.[1];

    return NextResponse.json({
      title,
      description,
      imageUrl: ogImage,
      siteName: ogSiteName,
      url,
    });
  } catch (error) {
    console.error('Error in basic metadata fetch:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metadata' },
      { status: 500 }
    );
  }
}
