import type { CreateContentInput } from '@/types/content';

export interface BrightDataConfig {
  apiKey: string;
}

export interface BrightDataLinkedInPostInput {
  url: string;
  limit?: number; // Max number of posts to fetch
  start_date?: string; // YYYY-MM-DD format
  end_date?: string; // YYYY-MM-DD format
}

export interface BrightDataSnapshot {
  snapshot_id: string;
}

export interface BrightDataSnapshotStatus {
  status: 'running' | 'ready' | 'failed';
  snapshot_id: string;
  result_count?: number;
  error?: string;
}

export interface BrightDataLinkedInPost {
  id: string;
  url?: string;
  user_id?: string;
  use_url?: string; // Note: typo in API response
  post_type?: string;
  date_posted?: string;
  title?: string;
  headline?: string;
  post_text?: string;
  post_text_html?: string;
  hashtags?: string[] | null;
  embedded_links?: string[];
  images?: string[] | null;
  videos?: Array<{
    url?: string;
    thumbnail?: string;
  }> | null;
  video_duration?: number | null;
  video_thumbnail?: string | null;
  repost?: {
    repost_attachments?: any;
    repost_date?: string | null;
    repost_hangtags?: any;
    repost_id?: string | null;
    repost_text?: string | null;
    repost_url?: string | null;
    repost_user_id?: string | null;
    repost_user_name?: string | null;
    repost_user_title?: string | null;
    tagged_companies?: any;
    tagged_users?: any;
  };
  num_likes?: number;
  num_comments?: number;
  top_visible_comments?: Array<{
    comment?: string;
    comment_date?: string;
    num_reactions?: number;
    tagged_users?: any;
    use_url?: string;
    user_id?: string;
    user_name?: string;
    user_title?: string | null;
  }>;
  user_title?: string;
  author_profile_pic?: string;
  num_connections?: number | null;
  user_followers?: number;
  account_type?: string;
  more_articles_by_user?: any;
  more_relevant_posts?: any;
  user_posts?: number;
  user_articles?: number;
  tagged_companies?: any[];
  tagged_people?: any[];
  external_link_data?: any;
  document_cover_image?: string | null;
  document_page_count?: number | null;
}

export class BrightDataFetcher {
  private apiKey: string;
  private baseUrl = 'https://api.brightdata.com';

  // Dataset ID for LinkedIn Posts scraper
  private static readonly DATASET_ID = 'gd_lyy3tktm25m4avu764';

  constructor(config: BrightDataConfig) {
    if (!config.apiKey) {
      throw new Error('Bright Data API key is required');
    }
    this.apiKey = config.apiKey;
  }

  /**
   * Get existing snapshots for the dataset
   */
  async getExistingSnapshots(status: 'ready' | 'running' | 'failed' = 'ready'): Promise<any[]> {
    const endpoint = `${this.baseUrl}/datasets/v3/snapshots`;
    const queryParams = new URLSearchParams({
      dataset_id: BrightDataFetcher.DATASET_ID,
      status: status,
      limit: '10', // Get last 10 ready snapshots
    });

    const fullUrl = `${endpoint}?${queryParams.toString()}`;
    console.log(`[BrightDataFetcher] Getting existing snapshots: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[BrightDataFetcher] Failed to get snapshots: ${response.status} - ${errorText}`
      );
      throw new Error(`Failed to get snapshots: ${response.status}`);
    }

    const snapshots = await response.json();
    console.log(`[BrightDataFetcher] Found ${snapshots.length} existing snapshots`);
    return snapshots;
  }

  /**
   * Fetch LinkedIn posts for given profile URLs
   * First tries to use existing collected data, then falls back to triggering new collection
   */
  async fetchLinkedInContent(
    profileUrls: string[],
    options?: {
      maxResults?: number;
      startDate?: string; // YYYY-MM-DD
      endDate?: string; // YYYY-MM-DD
      timeout?: number; // Max time to wait for results in ms
      useExistingData?: boolean; // Try to use existing data first
    }
  ): Promise<CreateContentInput[]> {
    console.log(
      `[BrightDataFetcher] Fetching LinkedIn content for ${profileUrls.length} profiles`
    );

    const allContent: CreateContentInput[] = [];
    const timeout = options?.timeout || 300000; // Default 5 minutes (LinkedIn scraping can be slow)

    // Try to use existing data first if not explicitly disabled
    if (options?.useExistingData !== false) {
      try {
        console.log('[BrightDataFetcher] Checking for existing collected data...');
        const existingSnapshots = await this.getExistingSnapshots('ready');
        
        if (existingSnapshots.length > 0) {
          // Use the most recent ready snapshot
          const latestSnapshot = existingSnapshots[0];
          console.log(
            `[BrightDataFetcher] Using existing snapshot: ${latestSnapshot.id} from ${latestSnapshot.created}`
          );
          
          const results = await this.getSnapshotData(latestSnapshot.id);
          
          if (results && results.length > 0) {
            console.log(
              `[BrightDataFetcher] Retrieved ${results.length} posts from existing snapshot`
            );
            
            // Filter results by profile URLs if needed
            const filteredResults = results.filter((post: any) => {
              // Check if this post belongs to one of the requested profiles
              if (!post.url && !post.use_url) return false;
              const postUrl = post.url || post.use_url;
              return profileUrls.some(profileUrl => 
                postUrl.toLowerCase().includes(profileUrl.toLowerCase().replace('https://www.linkedin.com/in/', ''))
              );
            });
            
            const transformedContent = this.transformLinkedInData(
              filteredResults,
              options?.maxResults
            );
            return transformedContent;
          }
        }
      } catch (error) {
        console.error('[BrightDataFetcher] Error fetching existing data:', error);
        console.log('[BrightDataFetcher] Falling back to triggering new collection...');
      }
    }

    // Fall back to triggering new collection if no existing data or error
    // Process each profile URL
    for (const profileUrl of profileUrls) {
      try {
        // Step 1: Trigger the collection
        const snapshot = await this.triggerLinkedInCollection(profileUrl, {
          maxResults: options?.maxResults,
          startDate: options?.startDate,
          endDate: options?.endDate,
        });

        if (!snapshot.snapshot_id) {
          console.error(
            `[BrightDataFetcher] No snapshot ID returned for ${profileUrl}`
          );
          continue;
        }

        console.log(
          `[BrightDataFetcher] Collection triggered for ${profileUrl}, snapshot: ${snapshot.snapshot_id}`
        );

        // Step 2: Poll for results
        const results = await this.pollForResults(
          snapshot.snapshot_id,
          timeout
        );

        if (!results || results.length === 0) {
          console.log(`[BrightDataFetcher] No posts found for ${profileUrl}`);
          continue;
        }

        // Step 3: Transform results
        console.log(`[BrightDataFetcher] Raw results count: ${results.length}`);

        // Apply maxResults limit here since profile_url endpoint doesn't support limit
        const limitedResults = options?.maxResults
          ? results.slice(0, options.maxResults)
          : results;

        console.log(
          `[BrightDataFetcher] After limiting to ${options?.maxResults}: ${limitedResults.length} posts`
        );

        const transformedContent = this.transformLinkedInData(
          limitedResults,
          options?.maxResults
        );

        console.log(
          `[BrightDataFetcher] Transformed content count: ${transformedContent.length}`
        );

        allContent.push(...transformedContent);
      } catch (error) {
        console.error(
          `[BrightDataFetcher] Error fetching LinkedIn content for ${profileUrl}:`,
          error
        );
        // Continue with other profiles instead of throwing
      }
    }

    console.log(
      `[BrightDataFetcher] Total content to return: ${allContent.length} posts`
    );
    return allContent;
  }

  /**
   * Trigger a LinkedIn posts collection
   */
  private async triggerLinkedInCollection(
    profileUrl: string,
    options?: {
      maxResults?: number;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<BrightDataSnapshot> {
    const endpoint = `${this.baseUrl}/datasets/v3/trigger`;

    // Build the request body - profile_url endpoint only accepts url, start_date, and end_date
    // Note: limit is NOT supported for profile_url endpoint
    const body = [
      {
        url: profileUrl,
        ...(options?.startDate && { start_date: options.startDate }),
        ...(options?.endDate && { end_date: options.endDate }),
      },
    ];

    // Use the correct query parameters for profile-specific collection
    // Must use type: 'discover_new' with discover_by: 'profile_url' for profile URLs
    const queryParams = new URLSearchParams({
      dataset_id: BrightDataFetcher.DATASET_ID,
      include_errors: 'true',
      type: 'discover_new', // Required for discovery phase
      discover_by: 'profile_url', // Required to accept profile URLs instead of post URLs
    });

    const fullUrl = `${endpoint}?${queryParams.toString()}`;
    console.log(`[BrightDataFetcher] Triggering collection: ${fullUrl}`);
    console.log(`[BrightDataFetcher] Request body:`, JSON.stringify(body));

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[BrightDataFetcher] Trigger failed: ${response.status} - ${errorText}`
      );
      throw new Error(
        `Bright Data API error: ${response.status} - ${errorText}`
      );
    }

    const result = await response.json();
    console.log(`[BrightDataFetcher] Trigger response:`, result);
    return result;
  }

  /**
   * Poll for snapshot results
   */
  private async pollForResults(
    snapshotId: string,
    timeout: number
  ): Promise<BrightDataLinkedInPost[]> {
    const startTime = Date.now();
    const pollInterval = 5000; // Check every 5 seconds (less aggressive polling)
    let pollCount = 0;

    while (Date.now() - startTime < timeout) {
      pollCount++;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Check snapshot status
      const status = await this.getSnapshotStatus(snapshotId);

      if (status.status === 'ready') {
        console.log(
          `[BrightDataFetcher] Snapshot ready after ${elapsedSeconds} seconds`
        );
        // Fetch the results
        return this.getSnapshotData(snapshotId);
      } else if (status.status === 'failed') {
        throw new Error(`Snapshot failed: ${status.error || 'Unknown error'}`);
      }

      // Log progress every 30 seconds
      if (pollCount % 6 === 0) {
        console.log(
          `[BrightDataFetcher] Still waiting... (${elapsedSeconds}s elapsed)`
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
      `Timeout waiting for snapshot ${snapshotId} after ${timeout}ms`
    );
  }

  /**
   * Get snapshot status
   */
  private async getSnapshotStatus(
    snapshotId: string
  ): Promise<BrightDataSnapshotStatus> {
    const endpoint = `${this.baseUrl}/datasets/v3/progress/${snapshotId}`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[BrightDataFetcher] Status check failed: ${response.status} - ${errorText}`
      );
      throw new Error(`Failed to get snapshot status: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `[BrightDataFetcher] Snapshot ${snapshotId} status:`,
      data.status
    );
    return data;
  }

  /**
   * Get snapshot data
   */
  private async getSnapshotData(
    snapshotId: string
  ): Promise<BrightDataLinkedInPost[]> {
    // Correct endpoint verified: /datasets/v3/snapshot/{snapshot_id}
    const endpoint = `${this.baseUrl}/datasets/v3/snapshot/${snapshotId}?format=json`;

    console.log(`[BrightDataFetcher] Downloading data from: ${endpoint}`);

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[BrightDataFetcher] Failed to get data: ${response.status} - ${errorText.substring(0, 500)}`
      );
      throw new Error(`Failed to get snapshot data: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `[BrightDataFetcher] Retrieved ${Array.isArray(data) ? data.length : 1} posts from snapshot`
    );
    return Array.isArray(data) ? data : [data];
  }

  /**
   * Transform Bright Data LinkedIn posts to our content format
   */
  private transformLinkedInData(
    posts: BrightDataLinkedInPost[],
    maxResults?: number
  ): CreateContentInput[] {
    // Limit results if specified
    const postsToProcess = maxResults ? posts.slice(0, maxResults) : posts;

    return postsToProcess.map((post) => {
      // Extract media URLs
      const mediaUrls: CreateContentInput['media_urls'] = [];

      // Process images
      if (post.images && Array.isArray(post.images)) {
        post.images.forEach((imageUrl) => {
          if (imageUrl) {
            mediaUrls.push({
              url: imageUrl,
              type: 'image',
            });
          }
        });
      }

      // Process videos - check both videos array and video_thumbnail
      if (post.videos && Array.isArray(post.videos)) {
        post.videos.forEach((video) => {
          // Videos can be either strings (direct URLs) or objects with url property
          const videoUrl = typeof video === 'string' ? video : video?.url;
          if (videoUrl) {
            mediaUrls.push({
              url: videoUrl,
              type: 'video',
              thumbnail_url:
                post.video_thumbnail ||
                (typeof video === 'object' ? video.thumbnail : undefined),
              duration: post.video_duration, // Add video duration if available
            } as any);
          }
        });
      } else if (post.video_thumbnail) {
        // Sometimes video is indicated by thumbnail only
        mediaUrls.push({
          url: '', // No URL available, just thumbnail
          type: 'video',
          thumbnail_url: post.video_thumbnail,
          duration: post.video_duration, // Add video duration if available
        } as any);
      }

      // Process embedded links as link previews
      if (post.embedded_links && Array.isArray(post.embedded_links)) {
        post.embedded_links.forEach((link) => {
          if (link) {
            mediaUrls.push({
              type: 'link_preview',
              link_url: link,
              // Add external link data if available
              ...(post.external_link_data && {
                link_title: post.external_link_data.title,
                link_description: post.external_link_data.description,
              }),
            });
          }
        });
      }

      // Process document if present
      if (post.document_cover_image) {
        mediaUrls.push({
          type: 'link_preview',
          url: post.document_cover_image,
          link_title: 'Document',
          link_description: post.document_page_count
            ? `${post.document_page_count} pages`
            : undefined,
        });
      }

      // Handle reposts/reshares
      let referenceType: 'retweet' | undefined;
      let referencedContent: CreateContentInput['referenced_content'];

      if (post.repost && post.repost.repost_id) {
        referenceType = 'retweet';
        referencedContent = {
          id: post.repost.repost_id,
          platform_content_id: post.repost.repost_id,
          url: post.repost.repost_url || '',
          text: post.repost.repost_text || '',
          author: post.repost.repost_user_id
            ? {
                id: post.repost.repost_user_id,
                username: post.repost.repost_user_id,
                name: post.repost.repost_user_name || '',
              }
            : undefined,
          created_at: post.repost.repost_date || '',
        };
      }

      // Build the content object
      return {
        platform: 'linkedin' as const,
        platform_content_id: post.id || '',
        creator_id: '', // Will be set by the content service
        url: post.url || '',
        title: post.title || post.headline || 'LinkedIn post',
        description: post.post_text || '',
        content_body: post.post_text_html || post.post_text || '', // Prefer HTML for richer content
        published_at: post.date_posted
          ? new Date(post.date_posted).toISOString()
          : new Date().toISOString(),
        media_urls: mediaUrls,
        engagement_metrics: {
          likes: post.num_likes || 0,
          comments: post.num_comments || 0,
          shares: 0, // Not directly available, would need to count reposts
          views: 0, // Not available in this response
          // Store additional rich data here since metadata field doesn't exist in DB
          hashtags: post.hashtags || [],
          post_type: post.post_type || '',
          account_type: post.account_type || '',
          author_followers: post.user_followers || 0,
          author_avatar: post.author_profile_pic || '',
          author_title: post.user_title || '',
          tagged_companies: post.tagged_companies || [],
          tagged_people: post.tagged_people || [],
          top_comments: post.top_visible_comments || [],
        } as any,
        reference_type: referenceType,
        referenced_content: referencedContent,
      };
    });
  }

  /**
   * Test the connection to Bright Data API
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try a simple API call to verify the key works
      const response = await fetch(
        `${this.baseUrl}/datasets/v3/snapshot/test`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }
      );

      // 404 is expected for non-existent snapshot, but it means auth worked
      if (response.status === 404 || response.status === 200) {
        console.log('[BrightDataFetcher] Connection test successful');
        return true;
      }

      // 401/403 means auth failed
      if (response.status === 401 || response.status === 403) {
        console.error('[BrightDataFetcher] Authentication failed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[BrightDataFetcher] Connection test failed:', error);
      return false;
    }
  }
}
