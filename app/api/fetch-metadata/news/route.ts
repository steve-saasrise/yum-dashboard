import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Request schema
const requestSchema = z.object({
  url: z.string().url(),
});

interface OpenGraphData {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  url: string;
}

/**
 * Fetch OpenGraph metadata from news and blog sites
 * This endpoint uses regular HTTP fetch and is suitable for public websites
 * that don't require authentication or special handling
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = requestSchema.parse(body);

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; DailyNewsBot/1.0; +https://dailynews.app)',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.status}`);
        return NextResponse.json({ url, imageUrl: null });
      }

      const html = await response.text();

      // Extract OpenGraph metadata using multiple patterns for better compatibility
      // Try different meta tag formats since sites vary in their implementation
      const ogImageMatch =
        html.match(
          /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i
        ) ||
        html.match(/<meta\s+name=["']og:image["']\s+content=["']([^"']+)["']/i);

      const ogTitleMatch =
        html.match(
          /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+property=["']og:title["']/i
        );

      const ogDescMatch =
        html.match(
          /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i
        );

      const ogSiteMatch =
        html.match(
          /<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+property=["']og:site_name["']/i
        );

      // Also try Twitter Card images as fallback
      const twitterImageMatch =
        html.match(
          /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i
        ) ||
        html.match(
          /<meta\s+content=["']([^"']+)["']\s+name=["']twitter:image["']/i
        ) ||
        html.match(
          /<meta\s+property=["']twitter:image["']\s+content=["']([^"']+)["']/i
        );

      // Try to find any image in article/main content as last resort
      const articleImageMatch =
        html.match(/<article[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i) ||
        html.match(/<main[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);

      let imageUrl =
        ogImageMatch?.[1] ||
        twitterImageMatch?.[1] ||
        articleImageMatch?.[1] ||
        null;

      // Make relative URLs absolute
      if (imageUrl && !imageUrl.startsWith('http')) {
        const baseUrl = new URL(url);
        if (imageUrl.startsWith('//')) {
          imageUrl = `${baseUrl.protocol}${imageUrl}`;
        } else if (imageUrl.startsWith('/')) {
          imageUrl = `${baseUrl.origin}${imageUrl}`;
        } else {
          imageUrl = `${baseUrl.origin}/${imageUrl}`;
        }
      }

      // Validate image URL is actually an image
      if (imageUrl && !isLikelyImageUrl(imageUrl)) {
        imageUrl = null;
      }

      const metadata: OpenGraphData = {
        url,
        imageUrl: imageUrl || undefined,
        title:
          ogTitleMatch?.[1] || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1],
        description:
          ogDescMatch?.[1] ||
          html.match(
            /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
          )?.[1],
        siteName: ogSiteMatch?.[1],
      };

      return NextResponse.json(metadata);
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
        console.error(`Timeout fetching metadata for ${url}`);
      } else {
        console.error(`Error fetching metadata for ${url}:`, fetchError);
      }
      return NextResponse.json({ url, imageUrl: null });
    }
  } catch (error) {
    console.error('Error in news metadata endpoint:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Return empty metadata on error (don't fail the whole email generation)
    return NextResponse.json({
      url: '',
      imageUrl: null,
    });
  }
}

// Helper function to check if URL is likely an image
function isLikelyImageUrl(url: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i;
  const imagePatterns = /\/(image|img|photo|picture|media|assets|static)\//i;

  return imageExtensions.test(url) || imagePatterns.test(url);
}
