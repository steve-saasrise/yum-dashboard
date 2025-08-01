import {
  CreateContentInput,
  MediaUrl,
  NormalizeContentInput,
  Platform,
  calculateWordCount,
  calculateReadingTime,
  extractTextFromHTML,
} from '@/types/content';
import { RSSItem, RSSEnclosure } from '@/types/rss';

export class ContentNormalizer {
  /**
   * Normalize content from any platform into unified format
   */
  normalize(input: NormalizeContentInput): CreateContentInput {
    const { platform, platformData, creator_id, sourceUrl } = input;

    switch (platform) {
      case 'rss':
        return this.normalizeRSSContent(
          creator_id,
          platformData as RSSItem,
          sourceUrl
        );
      case 'youtube':
        return this.normalizeYouTubeContent(creator_id, platformData);
      case 'twitter':
        return this.normalizeTwitterContent(creator_id, platformData);
      case 'linkedin':
        return this.normalizeLinkedInContent(creator_id, platformData);
      case 'threads':
        return this.normalizeThreadsContent(creator_id, platformData);
      case 'website':
        return this.normalizeWebsiteContent(
          creator_id,
          platformData,
          sourceUrl
        );
      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Normalize RSS content
   */
  private normalizeRSSContent(
    creator_id: string,
    item: RSSItem,
    feedUrl?: string
  ): CreateContentInput {
    // Extract text content - prioritize full content over snippets
    const contentBody =
      item.content ||
      item.description ||
      item.summary ||
      item.contentSnippet ||
      '';
    const textContent = extractTextFromHTML(contentBody);

    // Extract media URLs
    const mediaUrls: MediaUrl[] = [];

    // Add enclosure if present (common for podcasts)
    if (item.enclosure) {
      mediaUrls.push(this.normalizeRSSEnclosure(item.enclosure));
    }

    // Extract images from content (basic implementation)
    const imageMatches = contentBody.match(/<img[^>]+src="([^">]+)"/g);
    if (imageMatches) {
      imageMatches.forEach((imgTag) => {
        const srcMatch = imgTag.match(/src="([^">]+)"/);
        if (srcMatch && srcMatch[1]) {
          mediaUrls.push({
            url: srcMatch[1],
            type: 'image',
          });
        }
      });
    }

    // Calculate metrics
    const word_count = calculateWordCount(textContent);
    const reading_time_minutes = calculateReadingTime(textContent);

    return {
      creator_id,
      platform: 'rss',
      platform_content_id:
        item.guid || item.link || `${feedUrl}_${item.pubDate}`,
      url: item.link || feedUrl || '',
      title: item.title || 'Untitled',
      description: item.contentSnippet || textContent.substring(0, 300),
      published_at: item.pubDate
        ? new Date(item.pubDate).toISOString()
        : new Date().toISOString(),
      content_body: contentBody,
      word_count,
      reading_time_minutes,
      media_urls: mediaUrls,
      engagement_metrics: {}, // RSS doesn't have engagement metrics
    };
  }

  /**
   * Normalize YouTube content (stub for future implementation)
   */
  private normalizeYouTubeContent(
    creator_id: string,
    data: {
      id?: string | { videoId?: string };
      snippet?: {
        title?: string;
        description?: string;
        publishedAt?: string;
        channelTitle?: string;
        tags?: string[];
        thumbnails?: {
          high?: { url?: string; width?: number; height?: number };
          default?: { url?: string; width?: number; height?: number };
        };
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
      contentDetails?: {
        duration?: string;
      };
    }
  ): CreateContentInput {
    // YouTube-specific normalization
    // This will be implemented when YouTube API integration is added
    return {
      creator_id,
      platform: 'youtube',
      platform_content_id:
        typeof data.id === 'string' ? data.id : data.id?.videoId || '',
      url: data.id
        ? `https://www.youtube.com/watch?v=${typeof data.id === 'string' ? data.id : data.id.videoId}`
        : '',
      title: data.snippet?.title || 'Untitled Video',
      description: data.snippet?.description || '',
      thumbnail_url:
        data.snippet?.thumbnails?.high?.url ||
        data.snippet?.thumbnails?.default?.url,
      published_at: data.snippet?.publishedAt || new Date().toISOString(),
      content_body: data.snippet?.description || '',
      word_count: calculateWordCount(data.snippet?.description || ''),
      reading_time_minutes: 0, // Videos don't have reading time
      media_urls:
        data.snippet?.thumbnails &&
        (data.snippet.thumbnails.high?.url ||
          data.snippet.thumbnails.default?.url)
          ? [
              {
                url:
                  data.snippet.thumbnails.high?.url ||
                  data.snippet.thumbnails.default?.url ||
                  '',
                type: 'image' as const,
                width: data.snippet.thumbnails.high?.width,
                height: data.snippet.thumbnails.high?.height,
              },
            ]
          : [],
      engagement_metrics: {
        views: data.statistics?.viewCount
          ? parseInt(data.statistics.viewCount)
          : undefined,
        likes: data.statistics?.likeCount
          ? parseInt(data.statistics.likeCount)
          : undefined,
        comments: data.statistics?.commentCount
          ? parseInt(data.statistics.commentCount)
          : undefined,
      },
    };
  }

  /**
   * Normalize Twitter content (stub for future implementation)
   */
  private normalizeTwitterContent(
    creator_id: string,
    data: {
      id?: string;
      text?: string;
      author_id?: string;
      created_at?: string;
      lang?: string;
      attachments?: { media_keys?: string[] };
      entities?: {
        hashtags?: Array<{ tag?: string }>;
        media?: Array<{
          type?: string;
          media_url?: string;
          media_url_https?: string;
          url?: string;
          display_url?: string;
          expanded_url?: string;
        }>;
      };
      includes?: {
        media?: Array<{
          type?: string;
          url?: string;
          preview_image_url?: string;
          media_key?: string;
          width?: number;
          height?: number;
          variants?: Array<{ url?: string }>;
        }>;
      };
      public_metrics?: {
        retweet_count?: number;
        reply_count?: number;
        like_count?: number;
        bookmark_count?: number;
        impression_count?: number;
      };
    }
  ): CreateContentInput {
    // Twitter-specific normalization
    // This will be implemented when Twitter API integration is added
    return {
      creator_id,
      platform: 'twitter',
      platform_content_id: data.id || '',
      url: data.id ? `https://twitter.com/i/status/${data.id}` : '',
      title: '', // Tweets don't have titles
      description: data.text || '',
      published_at: data.created_at
        ? new Date(data.created_at).toISOString()
        : new Date().toISOString(),
      content_body: data.text || '',
      word_count: calculateWordCount(data.text || ''),
      reading_time_minutes: calculateReadingTime(data.text || ''),
      media_urls: this.extractTwitterMedia(data),
      engagement_metrics: {
        likes: data.public_metrics?.like_count,
        retweets: data.public_metrics?.retweet_count,
        comments: data.public_metrics?.reply_count,
        bookmarks: data.public_metrics?.bookmark_count,
      },
    };
  }

  /**
   * Normalize LinkedIn content (stub for future implementation)
   */
  private normalizeLinkedInContent(
    creator_id: string,
    data: {
      id?: string;
      urn?: string;
      url?: string;
      title?: string;
      text?: string;
      image?: { url?: string };
      publishedAt?: string;
      images?: Array<{ url?: string; type?: string }>;
      numLikes?: number;
      numComments?: number;
      numShares?: number;
    }
  ): CreateContentInput {
    // LinkedIn-specific normalization
    // This will be implemented when LinkedIn scraping is added
    return {
      creator_id,
      platform: 'linkedin',
      platform_content_id: data.id || data.urn || '',
      url: data.url || '',
      title: data.title || '',
      description: data.text || '',
      thumbnail_url: data.image?.url,
      published_at: data.publishedAt || new Date().toISOString(),
      content_body: data.text || '',
      word_count: calculateWordCount(data.text || ''),
      reading_time_minutes: calculateReadingTime(data.text || ''),
      media_urls:
        data.images
          ?.filter((img: { url?: string; type?: string }) => img.url)
          .map((img: { url?: string; type?: string }) => ({
            url: img.url || '',
            type: 'image' as const,
          })) || [],
      engagement_metrics: {
        likes: data.numLikes,
        comments: data.numComments,
        shares: data.numShares,
      },
    };
  }

  /**
   * Normalize Threads content (stub for future implementation)
   */
  private normalizeThreadsContent(
    creator_id: string,
    data: {
      id?: string;
      url?: string;
      text?: string;
      publishedAt?: string;
      timestamp?: string;
      media?: Array<{ url?: string; type?: string }>;
      likeCount?: number;
      replyCount?: number;
      shareCount?: number;
    }
  ): CreateContentInput {
    // Threads-specific normalization
    // This will be implemented when Threads scraping is added
    return {
      creator_id,
      platform: 'threads',
      platform_content_id: data.id || '',
      url: data.url || '',
      title: '', // Threads posts don't have titles
      description: data.text || '',
      thumbnail_url: data.media?.[0]?.url,
      published_at: data.timestamp || new Date().toISOString(),
      content_body: data.text || '',
      word_count: calculateWordCount(data.text || ''),
      reading_time_minutes: calculateReadingTime(data.text || ''),
      media_urls:
        data.media
          ?.filter((media: { url?: string; type?: string }) => media.url)
          .map((media: { url?: string; type?: string }) => ({
            url: media.url || '',
            type: (media.type === 'video' ||
            media.type === 'audio' ||
            media.type === 'document'
              ? media.type
              : 'image') as 'image' | 'video' | 'audio' | 'document',
          })) || [],
      engagement_metrics: {
        likes: data.likeCount,
        comments: data.replyCount,
        shares: data.shareCount,
      },
    };
  }

  /**
   * Normalize generic website content (stub for future implementation)
   */
  private normalizeWebsiteContent(
    creator_id: string,
    data: {
      title?: string;
      url?: string;
      description?: string;
      published_at?: string;
      [key: string]: unknown;
    },
    sourceUrl?: string
  ): CreateContentInput {
    // Generic website content normalization
    // This will be implemented when web scraping is added
    return {
      creator_id,
      platform: 'website',
      platform_content_id: data.url || sourceUrl || '',
      url: data.url || sourceUrl || '',
      title: data.title || 'Untitled',
      description: (data.description || data.excerpt || '') as string,
      thumbnail_url: (data.image || data.thumbnail) as string | undefined,
      published_at:
        (data.publishDate as string) ||
        (data.datePublished as string) ||
        new Date().toISOString(),
      content_body: (data.content || data.body || '') as string,
      word_count: calculateWordCount(
        (data.content || data.body || '') as string
      ),
      reading_time_minutes: calculateReadingTime(
        (data.content || data.body || '') as string
      ),
      media_urls:
        (data.images as Array<{ url?: string; type?: string } | string>)
          ?.filter((img: { url?: string; type?: string } | string) =>
            typeof img === 'string' ? img : img.url
          )
          .map((img: { url?: string; type?: string } | string) => ({
            url: (typeof img === 'string' ? img : img.url) || '',
            type: 'image' as const,
          })) || [],
      engagement_metrics: {},
    };
  }

  /**
   * Normalize RSS enclosure to MediaUrl
   */
  private normalizeRSSEnclosure(enclosure: RSSEnclosure): MediaUrl {
    // Determine media type from MIME type
    let type: MediaUrl['type'] = 'document';
    const mimeType = enclosure.type.toLowerCase();

    if (mimeType.startsWith('image/')) {
      type = 'image';
    } else if (mimeType.startsWith('video/')) {
      type = 'video';
    } else if (mimeType.startsWith('audio/')) {
      type = 'audio';
    }

    return {
      url: enclosure.url,
      type,
      size: enclosure.length,
    };
  }

  /**
   * Extract media from Twitter data
   */
  private extractTwitterMedia(data: {
    attachments?: { media_keys?: string[] };
    entities?: {
      media?: Array<{
        type?: string;
        media_url?: string;
        media_url_https?: string;
        url?: string;
        display_url?: string;
        expanded_url?: string;
      }>;
    };
    includes?: {
      media?: Array<{
        type?: string;
        url?: string;
        preview_image_url?: string;
        media_key?: string;
        width?: number;
        height?: number;
        duration_ms?: number;
        variants?: Array<{ url?: string }>;
      }>;
    };
  }): MediaUrl[] {
    const mediaUrls: MediaUrl[] = [];

    // Handle attached media
    if (data.attachments?.media_keys && data.includes?.media) {
      data.includes.media.forEach(
        (media: {
          type?: string;
          url?: string;
          preview_image_url?: string;
          media_key?: string;
          width?: number;
          height?: number;
          duration_ms?: number;
          variants?: Array<{ url?: string }>;
        }) => {
          if (
            media.media_key &&
            data.attachments?.media_keys?.includes(media.media_key)
          ) {
            if (media.type === 'photo') {
              mediaUrls.push({
                url: media.url || media.preview_image_url || '',
                type: 'image',
                width: media.width,
                height: media.height,
              });
            } else if (
              media.type === 'video' ||
              media.type === 'animated_gif'
            ) {
              mediaUrls.push({
                url: media.preview_image_url || '', // Videos use preview image
                type: 'video',
                duration: media.duration_ms
                  ? media.duration_ms / 1000
                  : undefined,
                width: media.width,
                height: media.height,
              });
            }
          }
        }
      );
    }

    // Handle legacy media format
    if (data.entities?.media) {
      data.entities.media.forEach(
        (media: {
          type?: string;
          media_url?: string;
          media_url_https?: string;
          url?: string;
          display_url?: string;
          expanded_url?: string;
        }) => {
          mediaUrls.push({
            url: media.media_url_https || media.media_url || '',
            type: media.type === 'photo' ? 'image' : 'video',
          });
        }
      );
    }

    return mediaUrls;
  }

  /**
   * Batch normalize content from multiple items
   */
  normalizeMultiple(
    creator_id: string,
    platform: Platform,
    items: unknown[],
    sourceUrl?: string
  ): CreateContentInput[] {
    return items.map((item) =>
      this.normalize({
        creator_id,
        platform,
        platformData: item,
        sourceUrl,
      })
    );
  }
}
