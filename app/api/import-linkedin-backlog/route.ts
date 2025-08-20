import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { ContentService } from '@/lib/services/content-service';
import type { CreateContentInput } from '@/types/content';

export async function GET(request: NextRequest) {
  try {
    // Check if Bright Data API key is configured
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        {
          error: 'Bright Data API key not configured',
          message: 'Please add BRIGHTDATA_API_KEY to your environment variables',
        },
        { status: 500 }
      );
    }

    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const contentService = new ContentService(supabase);
    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    // Get all ready snapshots
    console.log('[Import] Getting existing BrightData snapshots...');
    const readySnapshots = await brightDataFetcher.getExistingSnapshots('ready');
    
    if (readySnapshots.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No ready snapshots found',
      });
    }

    console.log(`[Import] Found ${readySnapshots.length} ready snapshots`);

    // Get all LinkedIn creators from database
    const { data: linkedinCreators, error: creatorsError } = await supabase
      .from('creator_urls')
      .select('creator_id, url')
      .eq('platform', 'linkedin');

    if (creatorsError) {
      throw new Error(`Failed to fetch LinkedIn creators: ${creatorsError.message}`);
    }

    console.log(`[Import] Found ${linkedinCreators?.length || 0} LinkedIn creators`);

    // Create a map of LinkedIn username to creator_id
    const creatorMap = new Map<string, string>();
    linkedinCreators?.forEach((creator) => {
      const username = creator.url
        .toLowerCase()
        .replace('https://www.linkedin.com/in/', '')
        .replace('/', '');
      creatorMap.set(username, creator.creator_id);
    });

    const results = {
      snapshots_processed: 0,
      total_posts_found: 0,
      posts_imported: 0,
      posts_updated: 0,
      posts_skipped: 0,
      errors: [] as any[],
      creators_matched: new Set<string>(),
    };

    // Process each snapshot
    for (const snapshot of readySnapshots) {
      if (snapshot.dataset_size === 0) {
        console.log(`[Import] Skipping empty snapshot ${snapshot.id}`);
        continue;
      }

      console.log(
        `[Import] Processing snapshot ${snapshot.id} with ${snapshot.dataset_size} items`
      );

      try {
        // Fetch the actual data from the snapshot
        const endpoint = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot.id}?format=json`;
        
        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          },
        });
        
        if (!response.ok) {
          console.error(`[Import] Failed to fetch snapshot ${snapshot.id}: ${response.status}`);
          results.errors.push({
            snapshot_id: snapshot.id,
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const data = await response.json();
        const posts = Array.isArray(data) ? data : [data];
        results.total_posts_found += posts.length;

        console.log(`[Import] Retrieved ${posts.length} posts from snapshot ${snapshot.id}`);

        // Transform and store each post
        for (const post of posts) {
          try {
            // Extract username from post URL
            const postUrl = post.url || post.use_url || '';
            const username = post.user_id || 
              postUrl.match(/linkedin\.com\/in\/([^\/]+)/)?.[1] || 
              postUrl.match(/linkedin\.com\/posts\/([^_]+)_/)?.[1] || '';

            if (!username) {
              console.log('[Import] Could not extract username from post:', postUrl);
              results.posts_skipped++;
              continue;
            }

            // Find the creator_id for this username
            const creatorId = creatorMap.get(username.toLowerCase());
            
            if (!creatorId) {
              console.log(`[Import] No creator found for username: ${username}`);
              results.posts_skipped++;
              continue;
            }

            results.creators_matched.add(username);

            // Transform BrightData post to our format
            const contentInput: CreateContentInput = {
              creator_id: creatorId,
              platform: 'linkedin',
              platform_content_id: post.id || `linkedin_${post.user_id}_${Date.parse(post.date_posted || '')}`,
              url: postUrl,
              title: post.title || post.headline || null,
              description: post.post_text || null,
              thumbnail_url: post.images?.[0] || post.video_thumbnail || null,
              published_at: post.date_posted || new Date().toISOString(),
              content_body: post.post_text_html || post.post_text || null,
              media_urls: [],
              engagement_metrics: {
                likes: post.num_likes || 0,
                comments: post.num_comments || 0,
                shares: 0,
                views: 0,
              },
            };

            // Add images
            if (post.images && Array.isArray(post.images)) {
              post.images.forEach((imageUrl: string) => {
                if (imageUrl) {
                  contentInput.media_urls?.push({
                    url: imageUrl,
                    type: 'image',
                  });
                }
              });
            }

            // Add videos
            if (post.videos && Array.isArray(post.videos)) {
              post.videos.forEach((video: any) => {
                const videoUrl = typeof video === 'string' ? video : video?.url;
                if (videoUrl) {
                  contentInput.media_urls?.push({
                    url: videoUrl,
                    type: 'video',
                    thumbnail_url: post.video_thumbnail || (typeof video === 'object' ? video.thumbnail : undefined),
                  });
                }
              });
            }

            // Check if content exists
            const exists = await contentService.checkDuplicate(
              creatorId,
              contentInput.platform_content_id,
              'linkedin'
            );

            if (exists) {
              // Update existing content
              await contentService.updateContentByPlatformId(
                creatorId,
                contentInput.platform_content_id,
                'linkedin',
                {
                  title: contentInput.title,
                  description: contentInput.description,
                  thumbnail_url: contentInput.thumbnail_url,
                  content_body: contentInput.content_body,
                  media_urls: contentInput.media_urls,
                  engagement_metrics: contentInput.engagement_metrics,
                }
              );
              results.posts_updated++;
            } else {
              // Create new content
              await contentService.storeContent(contentInput);
              results.posts_imported++;
            }
          } catch (error) {
            console.error('[Import] Error processing post:', error);
            results.errors.push({
              post_url: post.url || post.use_url,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        results.snapshots_processed++;
      } catch (error) {
        console.error(`[Import] Error processing snapshot ${snapshot.id}:`, error);
        results.errors.push({
          snapshot_id: snapshot.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported LinkedIn backlog`,
      results: {
        ...results,
        creators_matched: Array.from(results.creators_matched),
      },
    });
  } catch (error) {
    console.error('[Import] Error importing LinkedIn backlog:', error);

    return NextResponse.json(
      {
        error: 'Failed to import LinkedIn backlog',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}