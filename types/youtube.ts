import { z } from 'zod';

/**
 * YouTube API Response Types
 */

// YouTube Video Schema
export const YouTubeVideoSchema = z.object({
  id: z.union([z.string(), z.object({ videoId: z.string() })]),
  snippet: z
    .object({
      publishedAt: z.string(),
      channelId: z.string(),
      title: z.string(),
      description: z.string(),
      thumbnails: z.object({
        default: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        medium: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        high: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        standard: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        maxres: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
      }),
      channelTitle: z.string().optional(),
      tags: z.array(z.string()).optional(),
      categoryId: z.string().optional(),
      liveBroadcastContent: z.string().optional(),
      localized: z
        .object({
          title: z.string(),
          description: z.string(),
        })
        .optional(),
      defaultAudioLanguage: z.string().optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      duration: z.string(),
      dimension: z.string().optional(),
      definition: z.string().optional(),
      caption: z.string().optional(),
      licensedContent: z.boolean().optional(),
      projection: z.string().optional(),
    })
    .optional(),
  statistics: z
    .object({
      viewCount: z.string().optional(),
      likeCount: z.string().optional(),
      dislikeCount: z.string().optional(),
      favoriteCount: z.string().optional(),
      commentCount: z.string().optional(),
    })
    .optional(),
  status: z
    .object({
      uploadStatus: z.string().optional(),
      privacyStatus: z.string().optional(),
      license: z.string().optional(),
      embeddable: z.boolean().optional(),
      publicStatsViewable: z.boolean().optional(),
      madeForKids: z.boolean().optional(),
    })
    .optional(),
});

export type YouTubeVideo = z.infer<typeof YouTubeVideoSchema>;

// YouTube Channel Schema
export const YouTubeChannelSchema = z.object({
  id: z.string(),
  snippet: z
    .object({
      title: z.string(),
      description: z.string(),
      customUrl: z.string().optional(),
      publishedAt: z.string(),
      thumbnails: z.object({
        default: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        medium: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        high: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
      }),
      localized: z
        .object({
          title: z.string(),
          description: z.string(),
        })
        .optional(),
      country: z.string().optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      relatedPlaylists: z.object({
        likes: z.string().optional(),
        favorites: z.string().optional(),
        uploads: z.string().optional(),
      }),
    })
    .optional(),
  statistics: z
    .object({
      viewCount: z.string().optional(),
      subscriberCount: z.string().optional(),
      hiddenSubscriberCount: z.boolean().optional(),
      videoCount: z.string().optional(),
    })
    .optional(),
});

export type YouTubeChannel = z.infer<typeof YouTubeChannelSchema>;

// YouTube Playlist Items Schema
export const YouTubePlaylistItemSchema = z.object({
  id: z.string(),
  snippet: z
    .object({
      publishedAt: z.string(),
      channelId: z.string(),
      title: z.string(),
      description: z.string(),
      thumbnails: z.object({
        default: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        medium: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        high: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        standard: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
        maxres: z
          .object({
            url: z.string(),
            width: z.number().optional(),
            height: z.number().optional(),
          })
          .optional(),
      }),
      channelTitle: z.string(),
      playlistId: z.string(),
      position: z.number(),
      resourceId: z.object({
        kind: z.string(),
        videoId: z.string(),
      }),
      videoOwnerChannelTitle: z.string().optional(),
      videoOwnerChannelId: z.string().optional(),
    })
    .optional(),
  contentDetails: z
    .object({
      videoId: z.string(),
      startAt: z.string().optional(),
      endAt: z.string().optional(),
      note: z.string().optional(),
      videoPublishedAt: z.string().optional(),
    })
    .optional(),
  status: z
    .object({
      privacyStatus: z.string(),
    })
    .optional(),
});

export type YouTubePlaylistItem = z.infer<typeof YouTubePlaylistItemSchema>;

// API Response Schemas
export const YouTubeListResponseSchema = <T extends z.ZodTypeAny>(
  itemSchema: T
) =>
  z.object({
    kind: z.string(),
    etag: z.string(),
    nextPageToken: z.string().optional(),
    prevPageToken: z.string().optional(),
    pageInfo: z
      .object({
        totalResults: z.number(),
        resultsPerPage: z.number(),
      })
      .optional(),
    items: z.array(itemSchema),
  });

export type YouTubeVideosListResponse = z.infer<
  ReturnType<typeof YouTubeListResponseSchema<typeof YouTubeVideoSchema>>
>;
export type YouTubeChannelsListResponse = z.infer<
  ReturnType<typeof YouTubeListResponseSchema<typeof YouTubeChannelSchema>>
>;
export type YouTubePlaylistItemsListResponse = z.infer<
  ReturnType<typeof YouTubeListResponseSchema<typeof YouTubePlaylistItemSchema>>
>;

// YouTube Fetch Options
export interface YouTubeFetchOptions {
  apiKey?: string;
  accessToken?: string;
  maxResults?: number;
  pageToken?: string;
  publishedAfter?: Date;
  publishedBefore?: Date;
  order?: 'date' | 'rating' | 'relevance' | 'title' | 'viewCount';
  videoDuration?: 'short' | 'medium' | 'long';
  videoDefinition?: 'high' | 'standard';
  storage?: {
    enabled: boolean;
    supabaseClient?: unknown;
    creator_id: string;
  };
}

// YouTube Fetch Result
export interface YouTubeFetchResult {
  success: boolean;
  videos?: YouTubeVideo[];
  channel?: YouTubeChannel;
  nextPageToken?: string;
  prevPageToken?: string;
  totalResults?: number;
  fetchedAt: Date;
  error?: string;
  responseTime: number;
  storedContent?: {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ error: string }>;
  };
}

// YouTube Error Codes
export type YouTubeErrorCode =
  | 'INVALID_API_KEY'
  | 'INVALID_ACCESS_TOKEN'
  | 'QUOTA_EXCEEDED'
  | 'CHANNEL_NOT_FOUND'
  | 'PLAYLIST_NOT_FOUND'
  | 'VIDEO_NOT_FOUND'
  | 'FORBIDDEN'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'UNKNOWN_ERROR';

// YouTube Error Messages
export const YOUTUBE_ERROR_MESSAGES: Record<YouTubeErrorCode, string> = {
  INVALID_API_KEY: 'Invalid YouTube API key',
  INVALID_ACCESS_TOKEN: 'Invalid or expired access token',
  QUOTA_EXCEEDED: 'YouTube API quota exceeded',
  CHANNEL_NOT_FOUND: 'YouTube channel not found',
  PLAYLIST_NOT_FOUND: 'YouTube playlist not found',
  VIDEO_NOT_FOUND: 'YouTube video not found',
  FORBIDDEN: 'Access forbidden - check API permissions',
  NETWORK_ERROR: 'Network error while fetching YouTube data',
  PARSE_ERROR: 'Failed to parse YouTube API response',
  TIMEOUT: 'YouTube API request timed out',
  UNKNOWN_ERROR: 'An unknown error occurred',
};

// YouTube Error Class
export class YouTubeFetchError extends Error {
  constructor(
    message: string,
    public code: YouTubeErrorCode,
    public statusCode?: number,
    public channelId?: string
  ) {
    super(message);
    this.name = 'YouTubeFetchError';
  }
}

// Default Options
export const DEFAULT_YOUTUBE_FETCH_OPTIONS: Partial<YouTubeFetchOptions> = {
  maxResults: 50,
  order: 'date',
};

// Helper function to extract channel ID from URL
export function extractChannelId(url: string): string | null {
  // Handle various YouTube URL formats
  const patterns = [
    /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/@([a-zA-Z0-9_-]+)/,
    /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

// Helper function to parse ISO 8601 duration
export function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  return hours * 3600 + minutes * 60 + seconds;
}
