import { google, youtube_v3 } from 'googleapis';
import {
  YouTubeFetchOptions,
  YouTubeFetchResult,
  YouTubeFetchError,
  YouTubeErrorCode,
  YOUTUBE_ERROR_MESSAGES,
  DEFAULT_YOUTUBE_FETCH_OPTIONS,
  YouTubeVideo,
  YouTubeChannel,
  extractChannelId,
} from '@/types/youtube';
import { ContentService } from '@/lib/services/content-service';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ContentNormalizer } from '@/lib/services/content-normalizer';

/**
 * Parse YouTube ISO 8601 duration to seconds
 * @param duration - ISO 8601 duration string (e.g., 'PT1M30S', 'PT1H2M10S')
 * @returns Duration in seconds
 */
function parseYouTubeDuration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * YouTube Fetcher Service
 *
 * Handles fetching videos from YouTube channels using the YouTube Data API v3.
 * Supports both API key (public data) and OAuth2 (authenticated) access.
 */
export class YouTubeFetcher {
  private youtube: youtube_v3.Youtube;
  private options: YouTubeFetchOptions;

  constructor(options: YouTubeFetchOptions = {}) {
    this.options = { ...DEFAULT_YOUTUBE_FETCH_OPTIONS, ...options };

    // Initialize YouTube API client
    if (options.accessToken) {
      // OAuth2 authenticated access
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({ access_token: options.accessToken });
      this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    } else if (options.apiKey) {
      // API key access (public data only)
      this.youtube = google.youtube({ version: 'v3', auth: options.apiKey });
    } else {
      throw new YouTubeFetchError(
        'Either API key or access token must be provided',
        'INVALID_API_KEY'
      );
    }
  }

  /**
   * Fetch videos from a YouTube channel
   */
  async fetchChannelVideos(
    channelId: string,
    options?: Partial<YouTubeFetchOptions>
  ): Promise<YouTubeFetchResult> {
    const startTime = Date.now();
    const fetchOptions = { ...this.options, ...options };

    try {
      // First, get the channel's uploads playlist ID
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails', 'snippet', 'statistics'],
        id: [channelId],
        fields:
          'items(id,snippet(title,description,thumbnails,publishedAt),contentDetails(relatedPlaylists(uploads)),statistics)', // Optimize response size
      });

      if (
        !channelResponse.data.items ||
        channelResponse.data.items.length === 0
      ) {
        throw new YouTubeFetchError(
          YOUTUBE_ERROR_MESSAGES.CHANNEL_NOT_FOUND,
          'CHANNEL_NOT_FOUND',
          404,
          channelId
        );
      }

      const channel = channelResponse.data.items[0];
      const uploadsPlaylistId =
        channel.contentDetails?.relatedPlaylists?.uploads;

      if (!uploadsPlaylistId) {
        throw new YouTubeFetchError(
          'Channel has no uploads playlist',
          'PLAYLIST_NOT_FOUND',
          404,
          channelId
        );
      }

      // Fetch videos from the uploads playlist with date filtering
      const playlistParams: any = {
        part: ['snippet', 'contentDetails'],
        playlistId: uploadsPlaylistId,
        maxResults: fetchOptions.maxResults,
        pageToken: fetchOptions.pageToken,
        fields:
          'items(contentDetails(videoId),snippet(publishedAt)),nextPageToken,prevPageToken,pageInfo', // Optimize response size
      };

      // Note: playlistItems.list doesn't support publishedAfter directly
      // We'll need to filter after fetching, but we can limit the number of items
      const playlistResponse =
        await this.youtube.playlistItems.list(playlistParams);

      if (!playlistResponse.data.items) {
        return {
          success: true,
          videos: [],
          channel: this.normalizeChannel(channel),
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        };
      }

      // Filter by date BEFORE fetching detailed video info to save quota
      let filteredPlaylistItems = playlistResponse.data.items;
      if (fetchOptions.publishedAfter) {
        filteredPlaylistItems = playlistResponse.data.items.filter((item) => {
          const publishedAt = item.snippet?.publishedAt;
          if (!publishedAt) return true; // Include if no date info
          return new Date(publishedAt) > fetchOptions.publishedAfter!;
        });

        console.log(
          `[YouTube] Filtered ${playlistResponse.data.items.length} items to ${filteredPlaylistItems.length} based on publishedAfter`
        );
      }

      // Get video IDs for detailed information
      const videoIds = filteredPlaylistItems
        .map((item) => item.contentDetails?.videoId)
        .filter((id): id is string => !!id);

      if (videoIds.length === 0) {
        console.log(
          `[YouTube] No new videos found for channel ${channelId} after date filter`
        );
        return {
          success: true,
          videos: [],
          channel: this.normalizeChannel(channel),
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        };
      }

      // Fetch detailed video information with optimized fields
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics', 'status'],
        id: videoIds,
        fields:
          'items(id,snippet(publishedAt,channelId,title,description,thumbnails,channelTitle,tags),contentDetails(duration),statistics,status)', // Optimize response size
      });

      const videos = videosResponse.data.items || [];
      const normalizedVideos = videos.map((video) =>
        this.normalizeVideo(video)
      );

      // Apply date filters if specified
      let filteredVideos = normalizedVideos;
      if (fetchOptions.publishedAfter || fetchOptions.publishedBefore) {
        filteredVideos = normalizedVideos.filter((video) => {
          const publishedAt = new Date(video.snippet?.publishedAt || '');
          if (
            fetchOptions.publishedAfter &&
            publishedAt < fetchOptions.publishedAfter
          ) {
            return false;
          }
          if (
            fetchOptions.publishedBefore &&
            publishedAt > fetchOptions.publishedBefore
          ) {
            return false;
          }
          return true;
        });
      }

      // Filter out YouTube Shorts (videos 60 seconds or less)
      if (fetchOptions.excludeShorts !== false) {
        filteredVideos = filteredVideos.filter((video) => {
          if (video.contentDetails?.duration) {
            const durationInSeconds = parseYouTubeDuration(
              video.contentDetails.duration
            );
            return durationInSeconds > 60;
          }
          // If no duration info, include the video
          return true;
        });
      }

      const responseTime = Date.now() - startTime;

      // Store content if storage is enabled
      let storedContent = undefined;
      if (
        fetchOptions.storage?.enabled &&
        fetchOptions.storage.supabaseClient &&
        fetchOptions.storage.creator_id
      ) {
        storedContent = await this.storeContent(
          filteredVideos,
          fetchOptions.storage
        );
      }

      return {
        success: true,
        videos: filteredVideos,
        channel: this.normalizeChannel(channel),
        nextPageToken: playlistResponse.data.nextPageToken ?? undefined,
        prevPageToken: playlistResponse.data.prevPageToken ?? undefined,
        totalResults: playlistResponse.data.pageInfo?.totalResults ?? undefined,
        fetchedAt: new Date(),
        responseTime,
        storedContent,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const youtubeError = this.handleError(error, channelId);

      return {
        success: false,
        error: youtubeError.message,
        fetchedAt: new Date(),
        responseTime,
      };
    }
  }

  /**
   * Fetch videos by channel URL
   */
  async fetchChannelVideosByUrl(
    url: string,
    options?: Partial<YouTubeFetchOptions>
  ): Promise<YouTubeFetchResult> {
    const channelId = extractChannelId(url);
    if (!channelId) {
      return {
        success: false,
        error: 'Invalid YouTube channel URL',
        fetchedAt: new Date(),
        responseTime: 0,
      };
    }

    // If it's a handle (@username), we need to search for the channel
    if (url.includes('/@')) {
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: channelId,
        type: ['channel'],
        maxResults: 1,
      });

      if (
        searchResponse.data.items &&
        searchResponse.data.items.length > 0 &&
        searchResponse.data.items[0].snippet?.channelId
      ) {
        return this.fetchChannelVideos(
          searchResponse.data.items[0].snippet.channelId,
          options
        );
      } else {
        return {
          success: false,
          error: 'Channel not found',
          fetchedAt: new Date(),
          responseTime: 0,
        };
      }
    }

    return this.fetchChannelVideos(channelId, options);
  }

  /**
   * Search for videos
   */
  async searchVideos(
    query: string,
    options?: Partial<YouTubeFetchOptions>
  ): Promise<YouTubeFetchResult> {
    const startTime = Date.now();
    const fetchOptions = { ...this.options, ...options };

    try {
      const searchResponse = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: fetchOptions.maxResults,
        pageToken: fetchOptions.pageToken,
        order: fetchOptions.order,
        publishedAfter: fetchOptions.publishedAfter?.toISOString(),
        publishedBefore: fetchOptions.publishedBefore?.toISOString(),
        videoDuration: fetchOptions.videoDuration,
        videoDefinition: fetchOptions.videoDefinition,
      });

      if (
        !searchResponse.data.items ||
        searchResponse.data.items.length === 0
      ) {
        return {
          success: true,
          videos: [],
          fetchedAt: new Date(),
          responseTime: Date.now() - startTime,
        };
      }

      // Get video IDs for detailed information
      const videoIds = searchResponse.data.items
        .map((item) => item.id?.videoId)
        .filter((id): id is string => !!id);

      // Fetch detailed video information with optimized fields
      const videosResponse = await this.youtube.videos.list({
        part: ['snippet', 'contentDetails', 'statistics', 'status'],
        id: videoIds,
        fields:
          'items(id,snippet(publishedAt,channelId,title,description,thumbnails,channelTitle,tags),contentDetails(duration),statistics,status)', // Optimize response size
      });

      const videos = videosResponse.data.items || [];
      const normalizedVideos = videos.map((video) =>
        this.normalizeVideo(video)
      );

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        videos: normalizedVideos,
        nextPageToken: searchResponse.data.nextPageToken ?? undefined,
        prevPageToken: searchResponse.data.prevPageToken ?? undefined,
        totalResults: searchResponse.data.pageInfo?.totalResults ?? undefined,
        fetchedAt: new Date(),
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const youtubeError = this.handleError(error);

      return {
        success: false,
        error: youtubeError.message,
        fetchedAt: new Date(),
        responseTime,
      };
    }
  }

  /**
   * Normalize YouTube video data
   */
  private normalizeVideo(video: youtube_v3.Schema$Video): YouTubeVideo {
    return {
      id: video.id || '',
      snippet: video.snippet
        ? {
            publishedAt: video.snippet.publishedAt || '',
            channelId: video.snippet.channelId || '',
            title: video.snippet.title || '',
            description: video.snippet.description || '',
            thumbnails: this.normalizeThumbnails(video.snippet.thumbnails),
            channelTitle: video.snippet.channelTitle || undefined,
            tags: video.snippet.tags || undefined,
            categoryId: video.snippet.categoryId || undefined,
            liveBroadcastContent:
              video.snippet.liveBroadcastContent || undefined,
            localized: video.snippet.localized
              ? {
                  title: video.snippet.localized.title || '',
                  description: video.snippet.localized.description || '',
                }
              : undefined,
            defaultAudioLanguage:
              video.snippet.defaultAudioLanguage || undefined,
          }
        : undefined,
      contentDetails: video.contentDetails
        ? {
            duration: video.contentDetails.duration || '',
            dimension: video.contentDetails.dimension ?? undefined,
            definition: video.contentDetails.definition ?? undefined,
            caption: video.contentDetails.caption ?? undefined,
            licensedContent: video.contentDetails.licensedContent ?? undefined,
            projection: video.contentDetails.projection ?? undefined,
          }
        : undefined,
      statistics: video.statistics
        ? {
            viewCount: video.statistics.viewCount ?? undefined,
            likeCount: video.statistics.likeCount ?? undefined,
            dislikeCount: video.statistics.dislikeCount ?? undefined,
            favoriteCount: video.statistics.favoriteCount ?? undefined,
            commentCount: video.statistics.commentCount ?? undefined,
          }
        : undefined,
      status: video.status
        ? {
            uploadStatus: video.status.uploadStatus ?? undefined,
            privacyStatus: video.status.privacyStatus ?? undefined,
            license: video.status.license ?? undefined,
            embeddable: video.status.embeddable ?? undefined,
            publicStatsViewable: video.status.publicStatsViewable ?? undefined,
            madeForKids: video.status.madeForKids ?? undefined,
          }
        : undefined,
    };
  }

  /**
   * Normalize thumbnails from YouTube API
   */
  private normalizeThumbnails(
    thumbnails?: youtube_v3.Schema$ThumbnailDetails
  ): {
    default?: { url: string; width?: number; height?: number };
    medium?: { url: string; width?: number; height?: number };
    high?: { url: string; width?: number; height?: number };
    standard?: { url: string; width?: number; height?: number };
    maxres?: { url: string; width?: number; height?: number };
  } {
    const result: any = {};

    if (thumbnails?.default?.url) {
      result.default = {
        url: thumbnails.default.url,
        width: thumbnails.default.width ?? undefined,
        height: thumbnails.default.height ?? undefined,
      };
    }
    if (thumbnails?.medium?.url) {
      result.medium = {
        url: thumbnails.medium.url,
        width: thumbnails.medium.width ?? undefined,
        height: thumbnails.medium.height ?? undefined,
      };
    }
    if (thumbnails?.high?.url) {
      result.high = {
        url: thumbnails.high.url,
        width: thumbnails.high.width ?? undefined,
        height: thumbnails.high.height ?? undefined,
      };
    }
    if (thumbnails?.standard?.url) {
      result.standard = {
        url: thumbnails.standard.url,
        width: thumbnails.standard.width ?? undefined,
        height: thumbnails.standard.height ?? undefined,
      };
    }
    if (thumbnails?.maxres?.url) {
      result.maxres = {
        url: thumbnails.maxres.url,
        width: thumbnails.maxres.width ?? undefined,
        height: thumbnails.maxres.height ?? undefined,
      };
    }

    return result;
  }

  /**
   * Normalize YouTube channel data
   */
  private normalizeChannel(channel: youtube_v3.Schema$Channel): YouTubeChannel {
    return {
      id: channel.id || '',
      snippet: channel.snippet
        ? {
            title: channel.snippet.title || '',
            description: channel.snippet.description || '',
            customUrl: channel.snippet.customUrl || undefined,
            publishedAt: channel.snippet.publishedAt || '',
            thumbnails: this.normalizeThumbnails(channel.snippet.thumbnails),
            localized: channel.snippet.localized
              ? {
                  title: channel.snippet.localized.title || '',
                  description: channel.snippet.localized.description || '',
                }
              : undefined,
            country: channel.snippet.country || undefined,
          }
        : undefined,
      contentDetails: channel.contentDetails
        ? {
            relatedPlaylists: {
              likes:
                channel.contentDetails.relatedPlaylists?.likes || undefined,
              favorites:
                channel.contentDetails.relatedPlaylists?.favorites || undefined,
              uploads:
                channel.contentDetails.relatedPlaylists?.uploads || undefined,
            },
          }
        : undefined,
      statistics: channel.statistics
        ? {
            viewCount: channel.statistics.viewCount || undefined,
            subscriberCount: channel.statistics.subscriberCount || undefined,
            hiddenSubscriberCount:
              channel.statistics.hiddenSubscriberCount || undefined,
            videoCount: channel.statistics.videoCount || undefined,
          }
        : undefined,
    };
  }

  /**
   * Store YouTube videos to database
   */
  private async storeContent(
    videos: YouTubeVideo[],
    storageOptions: NonNullable<YouTubeFetchOptions['storage']>
  ): Promise<YouTubeFetchResult['storedContent']> {
    try {
      const contentService = new ContentService(
        storageOptions.supabaseClient as SupabaseClient
      );
      const normalizer = new ContentNormalizer();

      // Normalize all videos for storage
      const normalizedContent = normalizer.normalizeMultiple(
        storageOptions.creator_id,
        'youtube',
        videos
      );

      // Store content in batch
      const result =
        await contentService.storeMultipleContent(normalizedContent);

      return {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      };
    } catch (error) {
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [
          {
            error:
              error instanceof Error ? error.message : 'Unknown storage error',
          },
        ],
      };
    }
  }

  /**
   * Handle and categorize errors
   */
  private handleError(error: unknown, channelId?: string): YouTubeFetchError {
    let code: YouTubeErrorCode = 'UNKNOWN_ERROR';
    let message = YOUTUBE_ERROR_MESSAGES.UNKNOWN_ERROR;
    let statusCode: number | undefined;

    if (error instanceof YouTubeFetchError) {
      return error;
    }

    // Handle Google API errors
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      'message' in error
    ) {
      const apiError = error as { code: number; message: string };
      statusCode = apiError.code;

      switch (apiError.code) {
        case 400:
          if (apiError.message.includes('API key')) {
            code = 'INVALID_API_KEY';
            message = YOUTUBE_ERROR_MESSAGES.INVALID_API_KEY;
          }
          break;
        case 401:
          code = 'INVALID_ACCESS_TOKEN';
          message = YOUTUBE_ERROR_MESSAGES.INVALID_ACCESS_TOKEN;
          break;
        case 403:
          if (apiError.message.includes('quota')) {
            code = 'QUOTA_EXCEEDED';
            message = YOUTUBE_ERROR_MESSAGES.QUOTA_EXCEEDED;
          } else {
            code = 'FORBIDDEN';
            message = YOUTUBE_ERROR_MESSAGES.FORBIDDEN;
          }
          break;
        case 404:
          code = 'CHANNEL_NOT_FOUND';
          message = YOUTUBE_ERROR_MESSAGES.CHANNEL_NOT_FOUND;
          break;
      }
    }

    // Network errors
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')
    ) {
      code = 'NETWORK_ERROR';
      message = YOUTUBE_ERROR_MESSAGES.NETWORK_ERROR;
    }

    return new YouTubeFetchError(
      `${message}${error instanceof Error && error.message ? `: ${error.message}` : ''}`,
      code,
      statusCode,
      channelId
    );
  }

  /**
   * Update fetcher options
   */
  updateOptions(options: Partial<YouTubeFetchOptions>): void {
    this.options = { ...this.options, ...options };

    // Reinitialize YouTube client if auth changed
    if (options.accessToken || options.apiKey) {
      if (options.accessToken) {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: options.accessToken });
        this.youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      } else if (options.apiKey) {
        this.youtube = google.youtube({ version: 'v3', auth: options.apiKey });
      }
    }
  }

  /**
   * Get current options
   */
  getOptions(): YouTubeFetchOptions {
    return { ...this.options };
  }
}

// Export convenience functions
export const fetchYouTubeVideos = (
  channelId: string,
  options: YouTubeFetchOptions
) => {
  const fetcher = new YouTubeFetcher(options);
  return fetcher.fetchChannelVideos(channelId);
};

export const searchYouTubeVideos = (
  query: string,
  options: YouTubeFetchOptions
) => {
  const fetcher = new YouTubeFetcher(options);
  return fetcher.searchVideos(query);
};
