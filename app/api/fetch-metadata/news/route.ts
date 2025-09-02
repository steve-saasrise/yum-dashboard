import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { fetchOpenGraphMetadata } from '@/lib/services/opengraph-fetcher';

// Request schema
const requestSchema = z.object({
  url: z.string().url(),
});

/**
 * API endpoint for fetching OpenGraph metadata from news and blog sites
 * This endpoint is kept for potential client-side usage, but server-side code
 * should use fetchOpenGraphMetadata directly to avoid HTTP overhead
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url } = requestSchema.parse(body);

    // Use the shared function
    const metadata = await fetchOpenGraphMetadata(url);
    return NextResponse.json(metadata);
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
