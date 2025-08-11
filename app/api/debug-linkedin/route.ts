import { NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    console.log('[Debug] Starting LinkedIn debug test');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY!,
    });

    // Test with a single profile
    const testProfile = 'https://www.linkedin.com/in/bernardmarr/';

    console.log(`[Debug] Fetching content for: ${testProfile}`);

    const content = await brightDataFetcher.fetchLinkedInContent(
      [testProfile],
      {
        maxResults: 2, // Just get 2 posts
        timeout: 300000,
      }
    );

    console.log(`[Debug] Retrieved ${content.length} posts`);

    if (content.length === 0) {
      return NextResponse.json({
        error: 'No content fetched',
        profile: testProfile,
      });
    }

    // Log the first post details
    const firstPost = content[0];
    console.log('[Debug] First post:', {
      title: firstPost.title,
      platform_content_id: firstPost.platform_content_id,
      url: firstPost.url,
      published_at: firstPost.published_at,
      has_media: !!firstPost.media_urls?.length,
      media_types: firstPost.media_urls?.map((m) => m.type),
    });

    // Find the creator
    const { data: creatorUrl, error: urlError } = await supabase
      .from('creator_urls')
      .select('creator_id')
      .eq('url', testProfile.replace(/\/$/, ''))
      .single();

    if (urlError || !creatorUrl) {
      console.log('[Debug] Creator not found, creating test creator');

      // Create a test creator
      const { data: newCreator, error: createError } = await supabase
        .from('creators')
        .insert({
          display_name: 'Bernard Marr (Test)',
          platform: 'linkedin',
        })
        .select()
        .single();

      if (createError) {
        return NextResponse.json({
          error: 'Failed to create test creator',
          details: createError,
        });
      }

      // Add creator URL
      await supabase.from('creator_urls').insert({
        creator_id: newCreator.id,
        url: testProfile.replace(/\/$/, ''),
        platform: 'linkedin',
      });

      // Add creator_id to content
      content.forEach((item) => {
        item.creator_id = newCreator.id;
      });
    } else {
      console.log('[Debug] Found creator:', creatorUrl.creator_id);
      content.forEach((item) => {
        item.creator_id = creatorUrl.creator_id;
      });
    }

    // Try to store the content directly
    console.log('[Debug] Attempting to store content...');

    const { data: stored, error: storeError } = await supabase
      .from('content')
      .insert(
        content.map((item) => ({
          ...item,
          platform: 'linkedin',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      )
      .select();

    if (storeError) {
      console.error('[Debug] Store error:', storeError);
      return NextResponse.json({
        error: 'Failed to store content',
        details: storeError,
        sample_content: content[0],
      });
    }

    console.log(`[Debug] Successfully stored ${stored?.length} posts`);

    return NextResponse.json({
      success: true,
      fetched: content.length,
      stored: stored?.length || 0,
      sample: {
        title: firstPost.title,
        description: firstPost.description?.substring(0, 100),
        media_count: firstPost.media_urls?.length || 0,
        media_types: firstPost.media_urls?.map((m) => m.type),
      },
      stored_ids: stored?.map((s) => s.id),
    });
  } catch (error) {
    console.error('[Debug] Error:', error);
    return NextResponse.json({
      error: 'Debug test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
