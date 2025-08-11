import { NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';

export async function GET() {
  try {
    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY!,
    });

    // Fetch from Gary Vaynerchuk - known for video content
    const content = await brightDataFetcher.fetchLinkedInContent(
      ['https://www.linkedin.com/in/garyvaynerchuk/'],
      {
        maxResults: 5,
        timeout: 300000, // 5 minutes
      }
    );

    // Check for video content
    const videoPosts = content.filter((post) =>
      post.media_urls?.some((m) => m.type === 'video')
    );

    return NextResponse.json({
      success: true,
      totalPosts: content.length,
      videoPosts: videoPosts.length,
      posts: content.map((p) => ({
        title: p.title,
        description: p.description?.substring(0, 100),
        media: p.media_urls?.map((m) => ({
          type: m.type,
          url: m.url?.substring(0, 50),
          thumbnail: m.thumbnail_url?.substring(0, 50),
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
