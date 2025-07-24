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
  maxPosts?: number;
  includeComments?: boolean;
  onlyVerified?: boolean;
  minEngagement?: number;
  proxyConfiguration?: {
    useApifyProxy: boolean;
  };
}

export interface LinkedInActorInput {
  urls: string[];
  limit?: number;
  published_before?: string;
  published_after?: string;
}

export class ApifyFetcher {
  private client: ApifyClient;

  // Actor IDs for the official Apify scrapers
  private static readonly ACTORS = {
    TWITTER: 'apidojo/tweet-scraper',
    THREADS: 'red.cars/threads-scraper', // Switched to rented actor
    LINKEDIN: 'riceman/linkedin-posts-scraper',
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

    const input: TwitterActorInput = {
      startUrls: urls,
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

    const input: ThreadsActorInput = {
      urls: usernames.map((username) =>
        username.replace('@', '').replace('https://www.threads.net/@', '')
      ),
      maxPosts: options?.resultsLimit || 50,
      includeComments: false,
      onlyVerified: false,
      minEngagement: 0,
      proxyConfiguration: {
        useApifyProxy: true,
      },
    };

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
    options?: { maxResults?: number }
  ): Promise<CreateContentInput[]> {
    console.log(
      `[ApifyFetcher] Fetching LinkedIn content for ${profileUrls.length} profiles`
    );

    const input: LinkedInActorInput = {
      urls: profileUrls,
      limit: options?.maxResults || 20,
    };

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
        return [];
      }

      const { items } = await this.client
        .dataset(run.defaultDatasetId)
        .listItems();

      return this.transformLinkedInData(items);
    } catch (error) {
      console.error('[ApifyFetcher] Error fetching LinkedIn content:', error);
      throw error;
    }
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
      content_url:
        tweet.url ||
        tweet.twitterUrl ||
        `https://twitter.com/i/status/${tweet.id}`,
      published_at: tweet.createdAt
        ? new Date(tweet.createdAt).toISOString()
        : new Date().toISOString(),
      media_urls: tweet.extendedEntities?.media
        ? tweet.extendedEntities.media.map(
            (media: any) => media.media_url_https || media.url
          )
        : [],
      engagement_metrics: {
        likes: tweet.likeCount || 0,
        comments: tweet.replyCount || 0,
        shares: tweet.retweetCount || 0,
        views: tweet.viewCount || 0,
      },
      metadata: {
        author_username: tweet.author?.userName,
        author_name: tweet.author?.name,
        author_avatar: tweet.author?.profilePicture,
        is_reply: tweet.isReply || false,
        is_retweet: tweet.isRetweet || false,
        is_quote: tweet.isQuote || false,
        quoted_tweet_id: tweet.quoteId,
        language: tweet.lang,
      },
    }));
  }

  private transformThreadsData(items: any[]): CreateContentInput[] {
    // red.cars/threads-scraper returns a flat array with type field
    // Filter for post type items (skip profile items)
    const posts = items.filter((item) => item.type === 'post');

    return posts.map((post) => ({
      platform: 'threads' as const,
      platform_content_id: post.postId || post.id || '',
      creator_id: '', // Will be set by the content service
      url: post.postUrl || '',
      title: `Thread by @${post.username || 'unknown'}`,
      description: post.postText || '',
      content_url: post.postUrl || '',
      published_at: post.timestamp
        ? new Date(post.timestamp).toISOString()
        : new Date().toISOString(),
      media_urls: [
        ...(post.imageUrls || []),
        ...(post.videoUrls || []),
        ...(post.mediaUrls || []),
      ].filter(Boolean),
      engagement_metrics: {
        likes: post.likes || 0,
        comments: post.replies || 0,
        shares: post.reposts || post.quotes || 0,
        views: 0, // Not available in Threads API
      },
      metadata: {
        author_username: post.username,
        author_name: post.displayName || post.username,
        author_avatar: post.profilePicUrl,
        is_verified: post.isVerified || false,
        hashtags: post.hashtags || [],
        mentions: post.mentions || [],
      },
    }));
  }

  private transformLinkedInData(items: any[]): CreateContentInput[] {
    return items.map((post) => ({
      platform: 'linkedin' as const,
      platform_content_id: post.urn || post.url,
      creator_id: '', // Will be set by the content service
      url: post.url || '',
      title: `LinkedIn post by ${post.author_name || 'unknown'}`,
      description: post.text || '',
      content_url: post.url || '',
      published_at: post.posted_at || new Date().toISOString(),
      media_urls: [
        ...(post.media_images || []),
        ...(post.media_url ? [post.media_url] : []),
      ],
      engagement_metrics: {
        likes: post.total_reactions_count || 0,
        comments: post.comments_count || 0,
        shares: post.reposts_count || 0,
        views: 0, // Not available
      },
      metadata: {
        author_name: post.author_name,
        author_headline: post.author_headline,
        author_avatar: post.author_profile_picture,
        author_username: post.author_username,
        author_profile_url: post.author_profile_url,
        post_type: post.post_type,
        media_type: post.media_type,
        reactions: {
          like: post.like_count || 0,
          celebrate: post.celebrate_count || 0,
          support: post.support_count || 0,
          love: post.love_count || 0,
          insightful: post.insightful_count || 0,
          funny: post.funny_count || 0,
        },
      },
    }));
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
