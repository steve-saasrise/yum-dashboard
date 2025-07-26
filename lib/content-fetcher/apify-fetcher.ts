import { ApifyClient } from 'apify-client';
import type { CreateContentInput } from '@/types/content';

export interface ApifyConfig {
  apiKey: string;
}

export interface ApifyActorRunOptions {
  memory?: number;
  timeout?: number;
  build?: string;
}

export interface TwitterActorInput {
  startUrls?: string[];
  searchTerms?: string[];
  twitterHandles?: string[];
  conversationIds?: string[];
  maxItems?: number;
  tweetLanguage?: string;
  onlyVerifiedUsers?: boolean;
  onlyTwitterBlue?: boolean;
  onlyImage?: boolean;
  onlyVideo?: boolean;
  onlyQuote?: boolean;
  author?: string;
  inReplyTo?: string;
  mentioning?: string;
  minimumRetweets?: number;
  minimumFavorites?: number;
  minimumReplies?: number;
  start?: string;
  end?: string;
  includeSearchTerms?: boolean;
  customMapFunction?: string;
  sort?: string;
}

export interface ThreadsActorInput {
  urls: string[];
  postsPerSource?: number;
}

export interface LinkedInActorInput {
  username?: string;
  url?: string;
  page_number?: number;
  pagination_token?: string;
  total_posts_to_scrape?: number;
}

export class ApifyFetcher {
  private client: ApifyClient;

  // Actor IDs for the official Apify scrapers
  private static readonly ACTORS = {
    TWITTER: 'apidojo/tweet-scraper',
    THREADS: 'curious_coder/threads-scraper', // Updated to curious_coder actor
    LINKEDIN: 'apimaestro/linkedin-profile-posts', // Updated to apimaestro actor (pay-per-result)
  };

  constructor(config: ApifyConfig) {
    if (!config.apiKey) {
      throw new Error('Apify API key is required');
    }

    this.client = new ApifyClient({
      token: config.apiKey,
    });
  }

  async fetchTwitterContent(
    urls: string[],
    options?: { maxTweets?: number }
  ): Promise<CreateContentInput[]> {
    console.log(
      `[ApifyFetcher] Fetching Twitter content for ${urls.length} URLs`
    );

    // Convert URLs to search terms to exclude replies
    const searchTerms = urls.map((url) => {
      // If it's already a search term, add -filter:replies if not present
      if (url.includes('from:')) {
        return url.includes('-filter:replies') ? url : `${url} -filter:replies`;
      }

      // Extract username from URL
      const usernameMatch = url.match(/(?:x\.com|twitter\.com)\/(@?\w+)/);
      if (usernameMatch) {
        const username = usernameMatch[1].replace('@', '');
        return `from:${username} -filter:replies`;
      }

      // Fallback to original URL if pattern doesn't match
      return url;
    });

    console.log('[ApifyFetcher] Using search terms:', searchTerms);

    const input: TwitterActorInput = {
      searchTerms: searchTerms,
      maxItems: options?.maxTweets || 20,
      sort: 'Latest',
    };

    try {
      // Start the actor and wait for it to finish
      const run = await this.client
        .actor(ApifyFetcher.ACTORS.TWITTER)
        .call(input, {
          memory: 1024,
          timeout: 300, // 5 minutes
        });

      if (!run.defaultDatasetId) {
        console.error(
          '[ApifyFetcher] No dataset ID returned from Twitter actor'
        );
        return [];
      }

      // Fetch the results from the dataset
      const { items } = await this.client
        .dataset(run.defaultDatasetId)
        .listItems();

      // Transform Twitter data to ContentItem format
      return this.transformTwitterData(items);
    } catch (error) {
      console.error('[ApifyFetcher] Error fetching Twitter content:', error);
      throw error;
    }
  }

  async fetchThreadsContent(
    usernames: string[],
    options?: { resultsLimit?: number }
  ): Promise<CreateContentInput[]> {
    console.log(
      `[ApifyFetcher] Fetching Threads content for ${usernames.length} users`
    );

    // curious_coder/threads-scraper expects usernames with @ prefix
    const input: ThreadsActorInput = {
      urls: usernames.map((username) => {
        // Ensure username has @ prefix
        const cleanUsername = username
          .replace('https://www.threads.net/@', '')
          .replace('https://threads.net/@', '')
          .replace('@', '');
        return `@${cleanUsername}`;
      }),
      postsPerSource: options?.resultsLimit || 25,
    };

    console.log('[ApifyFetcher] Threads actor input:', input);

    try {
      const run = await this.client
        .actor(ApifyFetcher.ACTORS.THREADS)
        .call(input, {
          memory: 1024,
          timeout: 300,
        });

      if (!run.defaultDatasetId) {
        console.error(
          '[ApifyFetcher] No dataset ID returned from Threads actor'
        );
        return [];
      }

      const { items } = await this.client
        .dataset(run.defaultDatasetId)
        .listItems();

      return this.transformThreadsData(items);
    } catch (error) {
      console.error('[ApifyFetcher] Error fetching Threads content:', error);
      throw error;
    }
  }

  async fetchLinkedInContent(
    profileUrls: string[],
    options?: { maxResults?: number; published_after?: string }
  ): Promise<CreateContentInput[]> {
    console.log(
      `[ApifyFetcher] Fetching LinkedIn content for ${profileUrls.length} profiles`
    );

    // apimaestro/linkedin-profile-posts expects single profile per run
    const allContent: CreateContentInput[] = [];

    for (const profileUrl of profileUrls) {
      // Extract username from URL or use as-is if already username
      const username = profileUrl.includes('linkedin.com/in/')
        ? profileUrl.split('/in/')[1]?.split('/')[0]
        : profileUrl;

      const input: LinkedInActorInput = {
        username: username,
        page_number: 1,
        total_posts_to_scrape: options?.maxResults || 20,
      };

      console.log('[ApifyFetcher] LinkedIn actor input:', input);

      try {
        const run = await this.client
          .actor(ApifyFetcher.ACTORS.LINKEDIN)
          .call(input, {
            memory: 1024,
            timeout: 300,
          });

        if (!run.defaultDatasetId) {
          console.error(
            '[ApifyFetcher] No dataset ID returned from LinkedIn actor'
          );
          continue;
        }

        const { items } = await this.client
          .dataset(run.defaultDatasetId)
          .listItems();

        const transformedItems = this.transformLinkedInData(
          items,
          options?.published_after
        );
        allContent.push(...transformedItems);
      } catch (error) {
        console.error(
          `[ApifyFetcher] Error fetching LinkedIn content for ${profileUrl}:`,
          error
        );
        // Continue with other profiles instead of throwing
      }
    }

    return allContent;
  }

  private transformTwitterData(items: any[]): CreateContentInput[] {
    return items.map((tweet) => ({
      platform: 'twitter' as const,
      platform_content_id: tweet.id || tweet.url,
      creator_id: '', // Will be set by the content service
      url:
        tweet.url ||
        tweet.twitterUrl ||
        `https://twitter.com/i/status/${tweet.id}`,
      title: `Tweet by @${tweet.author?.userName || 'unknown'}`,
      description: tweet.text || '',
      published_at: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      media_urls: tweet.extendedEntities?.media
        ? tweet.extendedEntities.media.map((media: any) => ({
            url: media.media_url_https || media.url,
            type:
              media.type === 'video' || media.type === 'animated_gif'
                ? ('video' as const)
                : ('image' as const),
            width: media.sizes?.large?.w,
            height: media.sizes?.large?.h,
          }))
        : [],
      engagement_metrics: {
        likes: tweet.likeCount || 0,
        comments: tweet.replyCount || 0,
        shares: tweet.retweetCount || 0,
        views: tweet.viewCount || 0,
      },
    }));
  }

  private transformThreadsData(items: any[]): CreateContentInput[] {
    // curious_coder/threads-scraper returns posts directly without type field
    // Log the first post to see what fields are available
    if (items.length > 0) {
      console.log(
        '[ApifyFetcher] Sample Threads post data:',
        JSON.stringify(items[0], null, 2)
      );
    }

    return items.map((post) => {
      // Generate URL from the code field (Instagram-style URL structure)
      const postUrl = post.code
        ? `https://www.threads.net/@${post.user?.username}/post/${post.code}`
        : '';

      // Extract media URLs from different possible structures
      const mediaUrls: CreateContentInput['media_urls'] = [];

      // Check for image candidates in image_versions2
      if (
        post.image_versions2?.candidates &&
        Array.isArray(post.image_versions2.candidates)
      ) {
        post.image_versions2.candidates.forEach((c: any) => {
          if (c.url) {
            mediaUrls.push({
              url: c.url,
              type: 'image',
              width: c.width,
              height: c.height,
            });
          }
        });
      }

      // Check for video versions
      if (post.video_versions && Array.isArray(post.video_versions)) {
        post.video_versions.forEach((v: any) => {
          if (v.url) {
            mediaUrls.push({
              url: v.url,
              type: 'video',
              width: v.width,
              height: v.height,
            });
          }
        });
      }

      // Check for carousel media
      if (post.carousel_media && Array.isArray(post.carousel_media)) {
        post.carousel_media.forEach((media: any) => {
          if (media.image_versions2?.candidates) {
            media.image_versions2.candidates.forEach((c: any) => {
              if (c.url) {
                mediaUrls.push({
                  url: c.url,
                  type: 'image',
                  width: c.width,
                  height: c.height,
                });
              }
            });
          }
          if (media.video_versions) {
            media.video_versions.forEach((v: any) => {
              if (v.url) {
                mediaUrls.push({
                  url: v.url,
                  type: 'video',
                  width: v.width,
                  height: v.height,
                });
              }
            });
          }
        });
      }

      return {
        platform: 'threads' as const,
        platform_content_id: post.id || post.pk || '',
        creator_id: '', // Will be set by the content service
        url: postUrl,
        title: `Thread by @${post.user?.username || 'unknown'}`,
        description: post.caption?.text || '',
        // Use taken_at field which is a Unix timestamp in seconds
        published_at: post.taken_at
          ? new Date(post.taken_at * 1000).toISOString()
          : new Date().toISOString(),
        media_urls: mediaUrls,
        engagement_metrics: {
          likes: post.like_count || 0,
          comments: parseInt(post.reply_count) || 0, // reply_count is returned as string
          shares: 0, // Not available in the API response
          views: 0, // Not available in Threads API
        },
      };
    });
  }

  private transformLinkedInData(
    items: any[],
    publishedAfter?: string
  ): CreateContentInput[] {
    // apimaestro/linkedin-profile-posts returns a structured response
    const results: CreateContentInput[] = [];

    // Log the first item structure to understand the format
    if (items.length > 0) {
      console.log(
        '[ApifyFetcher] Sample LinkedIn response:',
        JSON.stringify(items[0], null, 2)
      );
    }

    for (const item of items) {
      // The actor returns data in a nested structure
      const response = item.data || item;
      const posts = response.posts || [response];

      for (const post of posts) {
        // Skip if post is older than publishedAfter date
        if (publishedAfter && post.posted_at?.timestamp) {
          const postDate = new Date(post.posted_at.timestamp);
          const filterDate = new Date(publishedAfter);
          if (postDate < filterDate) {
            continue;
          }
        }

        // Extract media URLs from various formats
        const mediaUrls: CreateContentInput['media_urls'] = [];

        // Handle single media
        if (post.media) {
          if (post.media.url) {
            mediaUrls.push({
              url: post.media.url,
              type: post.media.type === 'video' ? 'video' : 'image',
            });
          }
          // Handle multiple images
          if (post.media.images && Array.isArray(post.media.images)) {
            post.media.images.forEach((img: any) => {
              if (img.url) {
                mediaUrls.push({
                  url: img.url,
                  type: 'image',
                  width: img.width,
                  height: img.height,
                });
              }
            });
          }
        }

        // Handle article attachments
        if (post.article?.thumbnail) {
          mediaUrls.push({
            url: post.article.thumbnail,
            type: 'image',
          });
        }

        // Handle document thumbnails
        if (post.document?.thumbnail) {
          mediaUrls.push({
            url: post.document.thumbnail,
            type: 'image',
          });
        }

        results.push({
          platform: 'linkedin' as const,
          platform_content_id: post.urn || post.full_urn || '',
          creator_id: '', // Will be set by the content service
          url: post.url || '',
          title:
            `LinkedIn post by ${post.author?.first_name || ''} ${post.author?.last_name || ''}`.trim() ||
            'LinkedIn post',
          description: post.text || '',
          published_at: post.posted_at?.timestamp
            ? new Date(post.posted_at.timestamp).toISOString()
            : post.posted_at?.date || new Date().toISOString(),
          media_urls: mediaUrls,
          engagement_metrics: {
            likes: post.stats?.like || 0,
            comments: post.stats?.comments || 0,
            shares: post.stats?.reposts || 0,
            views: 0, // Not available
          },
        });
      }
    }

    return results;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Test the connection by fetching user info
      const user = await this.client.user().get();
      console.log(`[ApifyFetcher] Connected as ${user.username}`);
      return true;
    } catch (error) {
      console.error('[ApifyFetcher] Connection test failed:', error);
      return false;
    }
  }
}
