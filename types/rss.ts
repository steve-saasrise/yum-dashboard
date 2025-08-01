import { z } from 'zod';

// Core RSS feed interfaces based on rss-parser output
export interface RSSFeed {
  /** URL of the RSS feed */
  feedUrl: string;
  /** Title of the RSS feed */
  title: string;
  /** Description of the RSS feed */
  description?: string;
  /** Link to the website */
  link?: string;
  /** Language of the feed */
  language?: string;
  /** Copyright information */
  copyright?: string;
  /** Last build date of the feed */
  lastBuildDate?: Date;
  /** Publication date */
  pubDate?: Date;
  /** Time to live (TTL) in minutes */
  ttl?: number;
  /** Generator that created the feed */
  generator?: string;
  /** Managing editor */
  managingEditor?: string;
  /** Web master */
  webMaster?: string;
  /** Image associated with the feed */
  image?: RSSImage;
  /** iTunes specific metadata */
  itunes?: RSSItunesMetadata;
  /** Array of feed items */
  items: RSSItem[];
  /** Custom fields that may be present */
  custom?: Record<string, any>;
}

export interface RSSItem {
  /** Title of the item */
  title?: string;
  /** Link to the item */
  link?: string;
  /** Publication date */
  pubDate?: Date;
  /** Creator/author of the item */
  creator?: string;
  /** Content of the item (HTML) */
  content?: string;
  /** Description of the item (HTML/text) */
  description?: string;
  /** Summary of the item (HTML/text) */
  summary?: string;
  /** Content snippet (plain text) */
  contentSnippet?: string;
  /** Unique identifier */
  guid?: string;
  /** Categories/tags */
  categories?: string[];
  /** Comments URL */
  comments?: string;
  /** Enclosure (for podcasts) */
  enclosure?: RSSEnclosure;
  /** iTunes specific metadata */
  itunes?: RSSItemItunesMetadata;
  /** Custom fields that may be present */
  custom?: Record<string, any>;
}

export interface RSSImage {
  url: string;
  title?: string;
  link?: string;
  width?: number;
  height?: number;
}

export interface RSSEnclosure {
  url: string;
  type: string;
  length?: number;
}

export interface RSSItunesMetadata {
  author?: string;
  block?: boolean;
  categories?: string[];
  image?: string;
  explicit?: boolean;
  keywords?: string[];
  owner?: {
    name?: string;
    email?: string;
  };
  summary?: string;
  subtitle?: string;
}

export interface RSSItemItunesMetadata {
  author?: string;
  block?: boolean;
  duration?: string;
  explicit?: boolean;
  image?: string;
  keywords?: string[];
  subtitle?: string;
  summary?: string;
}

// Fetcher result interfaces
export interface RSSFetchResult {
  success: boolean;
  feed?: RSSFeed;
  error?: string;
  fetchedAt: Date;
  responseTime?: number;
  creatorContext?: {
    creator_id: string;
    creator_name: string;
    url: string;
  };
  storedContent?: {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{
      platform_content_id?: string;
      error: string;
    }>;
  };
}

export interface RSSFetchOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Custom user agent */
  userAgent?: string;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Maximum number of items to return */
  maxItems?: number;
  /** Custom field mappings */
  customFields?: {
    feed?: string[];
    item?: string[];
  };
  /** Storage options for persisting fetched content */
  storage?: {
    enabled: boolean;
    creator_id: string;
    supabaseClient?: any; // Will be SupabaseClient when used
  };
}

// Error handling
export class RSSFetchError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public feedUrl?: string
  ) {
    super(message);
    this.name = 'RSSFetchError';
  }
}

export type RSSErrorCode =
  | 'INVALID_URL'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'TIMEOUT'
  | 'NOT_FOUND'
  | 'INVALID_FEED'
  | 'CORS_ERROR'
  | 'UNKNOWN_ERROR';

// Zod validation schemas
export const RSSImageSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  link: z.string().url().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export const RSSEnclosureSchema = z.object({
  url: z.string().url(),
  type: z.string(),
  length: z.number().optional(),
});

export const RSSItunesMetadataSchema = z.object({
  author: z.string().optional(),
  block: z.boolean().optional(),
  categories: z.array(z.string()).optional(),
  image: z.string().url().optional(),
  explicit: z.boolean().optional(),
  keywords: z.array(z.string()).optional(),
  owner: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  summary: z.string().optional(),
  subtitle: z.string().optional(),
});

export const RSSItemItunesMetadataSchema = z.object({
  author: z.string().optional(),
  block: z.boolean().optional(),
  duration: z.string().optional(),
  explicit: z.boolean().optional(),
  image: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
  subtitle: z.string().optional(),
  summary: z.string().optional(),
});

export const RSSItemSchema = z.object({
  title: z.string().optional(),
  link: z.string().url().optional(),
  pubDate: z.date().optional(),
  creator: z.string().optional(),
  content: z.string().optional(),
  contentSnippet: z.string().optional(),
  guid: z.string().optional(),
  categories: z.array(z.string()).optional(),
  comments: z.string().url().optional(),
  enclosure: RSSEnclosureSchema.optional(),
  itunes: RSSItemItunesMetadataSchema.optional(),
  custom: z.record(z.any()).optional(),
});

export const RSSFeedSchema = z.object({
  feedUrl: z.string().url(),
  title: z.string(),
  description: z.string().optional(),
  link: z.string().url().optional(),
  language: z.string().optional(),
  copyright: z.string().optional(),
  lastBuildDate: z.date().optional(),
  pubDate: z.date().optional(),
  ttl: z.number().optional(),
  generator: z.string().optional(),
  managingEditor: z.string().optional(),
  webMaster: z.string().optional(),
  image: RSSImageSchema.optional(),
  itunes: RSSItunesMetadataSchema.optional(),
  items: z.array(RSSItemSchema),
  custom: z.record(z.any()).optional(),
});

export const RSSFetchOptionsSchema = z.object({
  timeout: z.number().min(1000).max(60000).optional(),
  userAgent: z.string().optional(),
  headers: z.record(z.string()).optional(),
  maxItems: z.number().min(1).max(1000).optional(),
  customFields: z
    .object({
      feed: z.array(z.string()).optional(),
      item: z.array(z.string()).optional(),
    })
    .optional(),
});

export const RSSFetchResultSchema = z.object({
  success: z.boolean(),
  feed: RSSFeedSchema.optional(),
  error: z.string().optional(),
  fetchedAt: z.date(),
  responseTime: z.number().optional(),
});

// Default values and constants
export const DEFAULT_RSS_FETCH_OPTIONS: RSSFetchOptions = {
  timeout: 10000, // 10 seconds
  maxItems: 100,
  userAgent: 'Daily News RSS Fetcher/1.0',
};

export const RSS_ERROR_MESSAGES: Record<RSSErrorCode, string> = {
  INVALID_URL: 'The provided URL is not valid',
  NETWORK_ERROR: 'Failed to fetch the RSS feed due to network error',
  PARSE_ERROR: 'Failed to parse the RSS feed content',
  TIMEOUT: 'Request timed out while fetching the RSS feed',
  NOT_FOUND: 'RSS feed not found at the provided URL',
  INVALID_FEED: 'The content is not a valid RSS feed',
  CORS_ERROR: 'Cross-origin request blocked',
  UNKNOWN_ERROR: 'An unknown error occurred while fetching the RSS feed',
};

// Utility functions for working with RSS data
export const isValidRSSUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const normalizeRSSDate = (dateString?: string): Date | undefined => {
  if (!dateString) return undefined;

  try {
    return new Date(dateString);
  } catch {
    return undefined;
  }
};

export const truncateContent = (
  content?: string,
  maxLength: number = 500
): string => {
  if (!content) return '';

  if (content.length <= maxLength) return content;

  return content.substring(0, maxLength).trim() + '...';
};

// Platform-specific RSS feed helpers
export const getYouTubeRSSUrl = (channelId: string): string => {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
};

export const getYouTubeRSSUrlFromUsername = (username: string): string => {
  return `https://www.youtube.com/feeds/videos.xml?user=${username}`;
};

export const isYouTubeRSSUrl = (url: string): boolean => {
  return url.includes('youtube.com/feeds/videos.xml');
};

export const extractChannelIdFromYouTubeRSS = (url: string): string | null => {
  const match = url.match(/channel_id=([^&]+)/);
  return match ? match[1] : null;
};
