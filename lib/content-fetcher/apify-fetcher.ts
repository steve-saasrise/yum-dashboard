import { ApifyClient } from 'apify-client';
import type { CreateContentInput, ReferencedContent } from '@/types/content';

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

    // Convert URLs to search terms - filter out replies and pure retweets, but keep quote tweets
    const searchTerms = urls.map((url) => {
      // If it's already a search term, add filters if not present
      if (url.includes('from:')) {
        let searchTerm = url;
        if (!searchTerm.includes('-filter:replies')) {
          searchTerm = `${searchTerm} -filter:replies`;
        }
        if (!searchTerm.includes('-filter:retweets')) {
          searchTerm = `${searchTerm} -filter:retweets`;
        }
        return searchTerm;
      }

      // Extract username from URL
      const usernameMatch = url.match(/(?:x\.com|twitter\.com)\/(@?\w+)/);
      if (usernameMatch) {
        const username = usernameMatch[1].replace('@', '');
        // Filter out replies and pure retweets (quote tweets will still come through)
        return `from:${username} -filter:replies -filter:retweets`;
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
    return items.map((tweet) => {
      // Prepare referenced content if this is a quote, retweet, or reply
      let referenceType: 'quote' | 'retweet' | 'reply' | undefined;
      let referencedContent: CreateContentInput['referenced_content'];

      if (tweet.isQuote && tweet.quote) {
        referenceType = 'quote';
        referencedContent = {
          id: tweet.quoteId || tweet.quote.id,
          platform_content_id: tweet.quote.id,
          url: tweet.quote.url || tweet.quote.twitterUrl,
          text: tweet.quote.text || tweet.quote.fullText,
          author: tweet.quote.author
            ? {
                id: tweet.quote.author.id,
                username: tweet.quote.author.userName,
                name: tweet.quote.author.name,
                avatar_url: tweet.quote.author.profilePicture,
                is_verified: tweet.quote.author.isBlueVerified,
              }
            : undefined,
          created_at: tweet.quote.createdAt,
          media_urls: tweet.quote.extendedEntities?.media
            ? tweet.quote.extendedEntities.media.map((media: any) => {
                if (media.type === 'video' || media.type === 'animated_gif') {
                  const mp4Variants = media.video_info?.variants?.filter(
                    (v: any) => v.content_type === 'video/mp4'
                  );
                  const bestVideo = mp4Variants?.reduce(
                    (best: any, current: any) => {
                      if (!best) return current;
                      return (current.bitrate || 0) > (best.bitrate || 0)
                        ? current
                        : best;
                    },
                    null
                  );
                  return {
                    url: bestVideo?.url || media.media_url_https || media.url,
                    type: 'video' as const,
                    thumbnail_url: media.media_url_https || media.url,
                    width: media.sizes?.large?.w,
                    height: media.sizes?.large?.h,
                    duration: media.video_info?.duration_millis,
                    bitrate: bestVideo?.bitrate,
                  };
                }
                return {
                  url: media.media_url_https || media.url,
                  type: 'image' as const,
                  width: media.sizes?.large?.w,
                  height: media.sizes?.large?.h,
                };
              })
            : [],
          engagement_metrics: {
            likes: tweet.quote.likeCount || 0,
            comments: tweet.quote.replyCount || 0,
            shares: tweet.quote.retweetCount || 0,
            views: tweet.quote.viewCount || 0,
          },
        };
      } else if (tweet.isReply && tweet.inReplyToId) {
        referenceType = 'reply';
        // For replies, we only have the ID, not full content
        referencedContent = {
          id: tweet.inReplyToId,
          platform_content_id: tweet.inReplyToId,
          author: tweet.inReplyToUsername
            ? {
                username: tweet.inReplyToUsername,
              }
            : undefined,
        };
      }
      // Note: For pure retweets, the Apify API typically doesn't return them
      // as they're filtered at the Twitter API level

      // Build media_urls array combining images/videos and link previews
      const mediaUrls: any[] = [];

      // First add regular media (images/videos)
      if (tweet.extendedEntities?.media) {
        tweet.extendedEntities.media.forEach((media: any) => {
          // For videos and GIFs, extract the actual video URL from variants
          if (media.type === 'video' || media.type === 'animated_gif') {
            // Get the best quality MP4 variant
            const mp4Variants = media.video_info?.variants?.filter(
              (v: any) => v.content_type === 'video/mp4'
            );
            const bestVideo = mp4Variants?.reduce((best: any, current: any) => {
              if (!best) return current;
              return (current.bitrate || 0) > (best.bitrate || 0)
                ? current
                : best;
            }, null);

            mediaUrls.push({
              url: bestVideo?.url || media.media_url_https || media.url,
              type: 'video' as const,
              thumbnail_url: media.media_url_https || media.url,
              width: media.sizes?.large?.w,
              height: media.sizes?.large?.h,
              duration: media.video_info?.duration_millis,
              bitrate: bestVideo?.bitrate,
            });
          } else {
            // For images
            mediaUrls.push({
              url: media.media_url_https || media.url,
              type: 'image' as const,
              width: media.sizes?.large?.w,
              height: media.sizes?.large?.h,
            });
          }
        });
      }

      // Add link preview from card data if available
      if (
        tweet.card &&
        tweet.card.name &&
        tweet.card.name.includes('summary')
      ) {
        // Twitter cards can be summary, summary_large_image, player, etc.
        const cardValues = tweet.card.binding_values || tweet.card.values || {};

        // Extract link preview data from card
        const linkPreview: any = {
          type: 'link_preview' as const,
          card_type: tweet.card.name,
        };

        // Get the URL
        if (cardValues.url || cardValues.website_url) {
          const urlValue = cardValues.url || cardValues.website_url;
          linkPreview.link_url =
            urlValue.string_value || urlValue.scribe_key || urlValue;
        }

        // Get the title
        if (cardValues.title) {
          linkPreview.link_title =
            cardValues.title.string_value || cardValues.title;
        }

        // Get the description
        if (cardValues.description) {
          linkPreview.link_description =
            cardValues.description.string_value || cardValues.description;
        }

        // Get the image (thumbnail)
        if (
          cardValues.thumbnail_image ||
          cardValues.thumbnail_image_large ||
          cardValues.photo_image_full_size
        ) {
          const imageValue =
            cardValues.thumbnail_image_large ||
            cardValues.photo_image_full_size ||
            cardValues.thumbnail_image;
          if (imageValue) {
            linkPreview.url =
              imageValue.image_value?.url ||
              imageValue.string_value ||
              imageValue;
            if (imageValue.image_value) {
              linkPreview.width = imageValue.image_value.width;
              linkPreview.height = imageValue.image_value.height;
            }
          }
        }

        // Get the domain/site name
        if (cardValues.domain || cardValues.vanity_url) {
          const domainValue = cardValues.domain || cardValues.vanity_url;
          linkPreview.link_domain = domainValue.string_value || domainValue;
        }

        // Only add the link preview if we have at least a URL and either title or image
        if (
          linkPreview.link_url &&
          (linkPreview.link_title || linkPreview.url)
        ) {
          mediaUrls.push(linkPreview);
        }
      }

      // Also check entities.urls for any URLs not captured by cards
      if (tweet.entities?.urls && Array.isArray(tweet.entities.urls)) {
        tweet.entities.urls.forEach((urlEntity: any) => {
          // Check if this URL is already captured in a card
          const alreadyCaptured = mediaUrls.some(
            (m) =>
              m.type === 'link_preview' && m.link_url === urlEntity.expanded_url
          );

          if (!alreadyCaptured && urlEntity.expanded_url) {
            // Add basic URL info even without OpenGraph data
            // The UI can attempt to fetch OpenGraph data client-side if needed
            mediaUrls.push({
              type: 'link_preview' as const,
              link_url: urlEntity.expanded_url,
              link_display_url: urlEntity.display_url,
              link_title: urlEntity.title || urlEntity.display_url,
              link_description: urlEntity.description,
            });
          }
        });
      }

      return {
        platform: 'twitter' as const,
        platform_content_id: tweet.id || tweet.url,
        creator_id: '', // Will be set by the content service
        url:
          tweet.url ||
          tweet.twitterUrl ||
          `https://twitter.com/i/status/${tweet.id}`,
        title: `Tweet by @${tweet.author?.userName || 'unknown'}`,
        description: tweet.text || '',
        content_body: tweet.text || '', // Add content_body for AI summaries
        published_at: tweet.createdAt
          ? new Date(tweet.createdAt).toISOString()
          : new Date().toISOString(),
        media_urls: mediaUrls,
        engagement_metrics: {
          likes: tweet.likeCount || 0,
          comments: tweet.replyCount || 0,
          shares: tweet.retweetCount || 0,
          views: tweet.viewCount || 0,
        },
        reference_type: referenceType,
        referenced_content: referencedContent,
      };
    });
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
      // Only take the first (highest quality) candidate as they're all the same image
      if (
        post.image_versions2?.candidates &&
        Array.isArray(post.image_versions2.candidates) &&
        post.image_versions2.candidates.length > 0
      ) {
        const bestCandidate = post.image_versions2.candidates[0];
        if (bestCandidate.url) {
          mediaUrls.push({
            url: bestCandidate.url,
            type: 'image',
            width: bestCandidate.width,
            height: bestCandidate.height,
          });
        }
      }

      // Check for video versions
      // Only take the first (highest quality) version as they're all the same video
      if (
        post.video_versions &&
        Array.isArray(post.video_versions) &&
        post.video_versions.length > 0
      ) {
        const bestVideo = post.video_versions[0];
        if (bestVideo.url) {
          mediaUrls.push({
            url: bestVideo.url,
            type: 'video',
            width: bestVideo.width,
            height: bestVideo.height,
          });
        }
      }

      // Check for carousel media (these are actually different images/videos)
      if (post.carousel_media && Array.isArray(post.carousel_media)) {
        post.carousel_media.forEach((media: any) => {
          // For each carousel item, only take the best quality version
          if (
            media.image_versions2?.candidates &&
            media.image_versions2.candidates.length > 0
          ) {
            const bestCandidate = media.image_versions2.candidates[0];
            if (bestCandidate.url) {
              mediaUrls.push({
                url: bestCandidate.url,
                type: 'image',
                width: bestCandidate.width,
                height: bestCandidate.height,
              });
            }
          }
          if (media.video_versions && media.video_versions.length > 0) {
            const bestVideo = media.video_versions[0];
            if (bestVideo.url) {
              mediaUrls.push({
                url: bestVideo.url,
                type: 'video',
                width: bestVideo.width,
                height: bestVideo.height,
              });
            }
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
        content_body: post.caption?.text || '', // Add content_body for AI summaries
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
        const addedUrls = new Set<string>(); // Track URLs to avoid duplicates

        // Handle single media and multiple images
        if (post.media) {
          // First check if there are multiple images
          if (
            post.media.images &&
            Array.isArray(post.media.images) &&
            post.media.images.length > 0
          ) {
            // Use the images array for multi-image posts
            post.media.images.forEach((img: any) => {
              if (img.url && !addedUrls.has(img.url)) {
                addedUrls.add(img.url);
                mediaUrls.push({
                  url: img.url,
                  type: 'image',
                  width: img.width,
                  height: img.height,
                });
              }
            });
          } else if (post.media.url && !addedUrls.has(post.media.url)) {
            // Fall back to single media URL if no images array
            addedUrls.add(post.media.url);
            mediaUrls.push({
              url: post.media.url,
              type: post.media.type === 'video' ? 'video' : 'image',
            });
          }
        }

        // Handle article attachments - store as link_preview type with article data
        if (post.article) {
          // Don't add article thumbnails as regular images
          // Instead, store them as link previews with full article data
          if (post.article.thumbnail && !addedUrls.has(post.article.thumbnail)) {
            addedUrls.add(post.article.thumbnail);
            mediaUrls.push({
              url: post.article.thumbnail,
              type: 'link_preview',
              // Store the actual article URL and metadata
              link_url: post.article.url || post.article.link || '',
              link_title: post.article.title || '',
              link_description: post.article.subtitle || post.article.description || '',
              link_domain: post.article.source || '',
            });
          }
        }

        // Handle document thumbnails
        if (
          post.document?.thumbnail &&
          !addedUrls.has(post.document.thumbnail)
        ) {
          addedUrls.add(post.document.thumbnail);
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
          content_body: post.text || '', // Add content_body for AI summaries
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
