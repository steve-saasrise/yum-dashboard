import { NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY!,
    });

    const contentService = new ContentService(supabase);

    // Test with creators that exist in our database
    const testProfiles = [
      'https://www.linkedin.com/in/bernardmarr/', // Bernard Marr - known for rich content
      'https://www.linkedin.com/in/neilkpatel', // Neil Patel - marketing videos
      'https://www.linkedin.com/in/dharmesh/', // Dharmesh Shah - tech content
    ];

    const results = [];

    for (const profile of testProfiles) {
      console.log(`[Test] Fetching LinkedIn content for: ${profile}`);

      const content = await brightDataFetcher.fetchLinkedInContent([profile], {
        maxResults: 5, // Just get 5 posts per profile
        timeout: 300000,
      });

      console.log(`[Test] Retrieved ${content.length} posts from ${profile}`);

      // Find a creator for this profile
      const { data: creatorData } = await supabase
        .from('creator_urls')
        .select('creator_id')
        .eq('url', profile.replace(/\/$/, '')) // Remove trailing slash if present
        .single();

      const creator = creatorData;

      if (creator) {
        // Add creator_id to content
        const contentToStore = content.map((item) => ({
          ...item,
          creator_id: creator.creator_id,
        }));

        // Store the content
        const storeResults =
          await contentService.storeMultipleContent(contentToStore);

        results.push({
          profile,
          fetched: content.length,
          stored: storeResults.created,
          updated: storeResults.updated,
          errors: storeResults.errors.length,
          mediaTypes: content
            .flatMap((c) => c.media_urls?.map((m) => m.type) || [])
            .filter((v, i, a) => a.indexOf(v) === i), // unique types
          sample: content[0]
            ? {
                title: content[0].title,
                hasVideo: content[0].media_urls?.some(
                  (m) => m.type === 'video'
                ),
                hasImage: content[0].media_urls?.some(
                  (m) => m.type === 'image'
                ),
                hasLink: content[0].media_urls?.some(
                  (m) => m.type === 'link_preview'
                ),
                hasRepost: !!content[0].reference_type,
              }
            : null,
        });
      } else {
        results.push({
          profile,
          error: 'Creator not found in database',
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalFetched: results.reduce((sum, r) => sum + (r.fetched || 0), 0),
        totalStored: results.reduce((sum, r) => sum + (r.stored || 0), 0),
      },
    });
  } catch (error) {
    console.error('[Test] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
