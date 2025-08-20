import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ContentService } from '@/lib/services/content-service';
import type { CreateContentInput } from '@/types/content';

export async function GET(request: NextRequest) {
  try {
    // Initialize services
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const contentService = new ContentService(supabase);

    // Get all LinkedIn creators from database
    const { data: linkedinCreators, error: creatorsError } = await supabase
      .from('creator_urls')
      .select('creator_id, url')
      .eq('platform', 'linkedin');

    if (creatorsError) {
      throw new Error(
        `Failed to fetch LinkedIn creators: ${creatorsError.message}`
      );
    }

    console.log(
      `[ImportAll] Found ${linkedinCreators?.length || 0} LinkedIn creators`
    );

    // Create a map of LinkedIn username to creator_id
    const creatorMap = new Map<string, string>();
    linkedinCreators?.forEach((creator) => {
      const username = creator.url
        .toLowerCase()
        .replace('https://www.linkedin.com/in/', '')
        .replace('https://linkedin.com/in/', '')
        .replace('/', '');
      creatorMap.set(username, creator.creator_id);
      console.log(
        `[ImportAll] Mapped username: ${username} to creator: ${creator.creator_id}`
      );
    });

    // Get ALL snapshots (not just ready ones, and not limited to 10)
    const snapshotsUrl = `https://api.brightdata.com/datasets/v3/snapshots?dataset_id=gd_lyy3tktm25m4avu764&status=ready&limit=100`;

    console.log(`[ImportAll] Fetching snapshots from: ${snapshotsUrl}`);

    const snapshotsResponse = await fetch(snapshotsUrl, {
      headers: {
        Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
      },
    });

    if (!snapshotsResponse.ok) {
      throw new Error(`Failed to get snapshots: ${snapshotsResponse.status}`);
    }

    const snapshots = await snapshotsResponse.json();
    console.log(`[ImportAll] Found ${snapshots.length} total snapshots`);

    const results = {
      snapshots_processed: 0,
      total_posts_found: 0,
      posts_imported: 0,
      posts_updated: 0,
      posts_skipped: 0,
      posts_no_creator: 0,
      errors: [] as any[],
      creators_matched: new Set<string>(),
      sample_posts: [] as any[],
    };

    // Process each snapshot
    for (const snapshot of snapshots) {
      if (snapshot.dataset_size === 0) {
        console.log(`[ImportAll] Skipping empty snapshot ${snapshot.id}`);
        continue;
      }

      console.log(
        `[ImportAll] Processing snapshot ${snapshot.id} (created: ${snapshot.created}, size: ${snapshot.dataset_size})`
      );

      try {
        // Download the FULL snapshot data (no batching for now)
        const dataUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot.id}?format=json`;

        console.log(`[ImportAll] Downloading from: ${dataUrl}`);

        const dataResponse = await fetch(dataUrl, {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          },
        });

        if (!dataResponse.ok) {
          console.error(
            `[ImportAll] Failed to fetch snapshot ${snapshot.id}: ${dataResponse.status}`
          );
          results.errors.push({
            snapshot_id: snapshot.id,
            error: `HTTP ${dataResponse.status}`,
          });
          continue;
        }

        const data = await dataResponse.json();
        const posts = Array.isArray(data) ? data : [data];
        results.total_posts_found += posts.length;

        console.log(
          `[ImportAll] Retrieved ${posts.length} posts from snapshot ${snapshot.id}`
        );

        // Keep track of sample posts for debugging
        if (results.sample_posts.length < 5 && posts.length > 0) {
          results.sample_posts.push({
            snapshot_id: snapshot.id,
            post_user: posts[0].user_id,
            post_url: posts[0].url || posts[0].use_url,
            date_posted: posts[0].date_posted,
          });
        }

        // Process each post
        for (const post of posts) {
          try {
            // Extract username from post
            const postUrl = post.url || post.use_url || '';
            const username =
              post.user_id ||
              postUrl.match(/linkedin\.com\/in\/([^\/]+)/)?.[1] ||
              postUrl.match(/linkedin\.com\/posts\/([^_]+)_/)?.[1] ||
              '';

            if (!username) {
              console.log(
                '[ImportAll] Could not extract username from post:',
                postUrl.substring(0, 100)
              );
              results.posts_skipped++;
              continue;
            }

            // Find the creator_id for this username
            const creatorId = creatorMap.get(username.toLowerCase());

            if (!creatorId) {
              // Track posts without matching creators
              results.posts_no_creator++;
              continue;
            }

            results.creators_matched.add(username);

            // Transform BrightData post to our format
            const contentInput: CreateContentInput = {
              creator_id: creatorId,
              platform: 'linkedin',
              platform_content_id:
                post.id ||
                `linkedin_${username}_${Date.parse(post.date_posted || '')}`,
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
                    thumbnail_url:
                      post.video_thumbnail ||
                      (typeof video === 'object' ? video.thumbnail : undefined),
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
              results.posts_updated++;
            } else {
              // Create new content
              await contentService.storeContent(contentInput);
              results.posts_imported++;
            }
          } catch (error) {
            // Don't log individual post errors to avoid spam, just count them
            results.errors.push({
              post_url: (post.url || post.use_url || '').substring(0, 100),
              error:
                error instanceof Error
                  ? error.message.substring(0, 100)
                  : 'Unknown',
            });
          }
        }

        results.snapshots_processed++;
      } catch (error) {
        console.error(
          `[ImportAll] Error processing snapshot ${snapshot.id}:`,
          error
        );
        results.errors.push({
          snapshot_id: snapshot.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Get final LinkedIn count
    const { count: finalCount } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .eq('platform', 'linkedin');

    return NextResponse.json({
      success: true,
      message: `Import completed`,
      summary: {
        snapshots_found: snapshots.length,
        snapshots_processed: results.snapshots_processed,
        total_posts_in_brightdata: results.total_posts_found,
        posts_imported: results.posts_imported,
        posts_updated: results.posts_updated,
        posts_without_matching_creator: results.posts_no_creator,
        posts_skipped: results.posts_skipped,
        creators_matched: Array.from(results.creators_matched).length,
        total_linkedin_posts_in_db: finalCount || 0,
      },
      creators_matched: Array.from(results.creators_matched).sort(),
      sample_posts: results.sample_posts,
      errors: results.errors.slice(0, 10), // Only show first 10 errors
    });
  } catch (error) {
    console.error('[ImportAll] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to import all BrightData posts',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
