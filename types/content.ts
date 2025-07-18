import { z } from 'zod';
import { Platform, PlatformSchema } from './creator';

// Re-export Platform for convenience
export type { Platform } from './creator';

// Content processing status enum
export type ContentProcessingStatus = 'pending' | 'processed' | 'failed';

// Base content interface matching the database schema
export interface Content {
  id: string;
  creator_id: string;
  platform: Platform;
  platform_content_id: string;
  url: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  published_at?: string;
  content_body?: string;
  ai_summary?: string;
  processing_status?: ContentProcessingStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
  word_count?: number;
  reading_time_minutes?: number;
  media_urls?: MediaUrl[];
  engagement_metrics?: EngagementMetrics;
}

// Content with creator information
export interface ContentWithCreator extends Content {
  creator?: {
    id: string;
    name: string;
    platform: Platform;
    avatar_url?: string;
    metadata?: Record<string, any>;
  };
  topics?: Array<{
    id: string;
    name: string;
    slug: string;
    color?: string;
    icon?: string;
  }>;
  is_saved?: boolean;
}

// Media URL structure for images, videos, etc.
export interface MediaUrl {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  title?: string;
  width?: number;
  height?: number;
  duration?: number; // For video/audio in seconds
  size?: number; // File size in bytes
}

// Platform-specific engagement metrics
export interface EngagementMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  retweets?: number;
  bookmarks?: number;
  reactions?: Record<string, number>;
  custom?: Record<string, any>;
}

// Content creation input
export interface CreateContentInput {
  creator_id: string;
  platform: Platform;
  platform_content_id: string;
  url: string;
  title?: string;
  description?: string;
  thumbnail_url?: string;
  published_at?: string;
  content_body?: string;
  word_count?: number;
  reading_time_minutes?: number;
  media_urls?: MediaUrl[];
  engagement_metrics?: EngagementMetrics;
}

// Content update input
export interface UpdateContentInput {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  content_body?: string;
  ai_summary?: string;
  processing_status?: ContentProcessingStatus;
  error_message?: string;
  word_count?: number;
  reading_time_minutes?: number;
  media_urls?: MediaUrl[];
  engagement_metrics?: EngagementMetrics;
}

// Content query filters
export interface ContentFilters {
  creator_id?: string;
  platform?: Platform;
  processing_status?: ContentProcessingStatus;
  from_date?: string;
  to_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: 'published_at' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

// Batch content operation result
export interface BatchContentResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{
    content_id?: string;
    platform_content_id?: string;
    error: string;
  }>;
}

// Content normalization input (for converting platform-specific data)
export interface NormalizeContentInput {
  creator_id: string;
  platform: Platform;
  platformData: any; // Platform-specific data (e.g., RSSItem, Tweet, YouTubeVideo)
  sourceUrl?: string;
}

// Zod schemas for validation
export const ContentProcessingStatusSchema = z.enum([
  'pending',
  'processed',
  'failed',
]);

export const MediaUrlSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video', 'audio', 'document']),
  title: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  size: z.number().positive().optional(),
});

export const EngagementMetricsSchema = z.object({
  views: z.number().nonnegative().optional(),
  likes: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(),
  shares: z.number().nonnegative().optional(),
  retweets: z.number().nonnegative().optional(),
  bookmarks: z.number().nonnegative().optional(),
  reactions: z.record(z.string(), z.number()).optional(),
  custom: z.record(z.any()).optional(),
});

export const CreateContentInputSchema = z.object({
  creator_id: z.string().uuid(),
  platform: PlatformSchema,
  platform_content_id: z.string().min(1).max(255),
  url: z.string().url().max(255),
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  thumbnail_url: z.string().url().max(255).optional(),
  published_at: z.string().datetime().optional(),
  content_body: z.string().optional(),
  word_count: z.number().nonnegative().optional(),
  reading_time_minutes: z.number().nonnegative().optional(),
  media_urls: z.array(MediaUrlSchema).optional(),
  engagement_metrics: EngagementMetricsSchema.optional(),
});

export const UpdateContentInputSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  thumbnail_url: z.string().url().max(255).optional(),
  content_body: z.string().optional(),
  ai_summary: z.string().optional(),
  processing_status: ContentProcessingStatusSchema.optional(),
  error_message: z.string().optional(),
  word_count: z.number().nonnegative().optional(),
  reading_time_minutes: z.number().nonnegative().optional(),
  media_urls: z.array(MediaUrlSchema).optional(),
  engagement_metrics: EngagementMetricsSchema.optional(),
});

export const ContentFiltersSchema = z.object({
  creator_id: z.string().uuid().optional(),
  platform: PlatformSchema.optional(),
  processing_status: ContentProcessingStatusSchema.optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().nonnegative().default(0).optional(),
  sort_by: z
    .enum(['published_at', 'created_at', 'updated_at'])
    .default('published_at')
    .optional(),
  sort_order: z.enum(['asc', 'desc']).default('desc').optional(),
});

// Error handling
export class ContentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'ContentError';
  }
}

export type ContentErrorCode =
  | 'DUPLICATE_CONTENT'
  | 'INVALID_PLATFORM'
  | 'CREATOR_NOT_FOUND'
  | 'CONTENT_NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR'
  | 'PROCESSING_ERROR';

// Utility functions
export const calculateReadingTime = (text?: string): number => {
  if (!text) return 0;
  const wordsPerMinute = 200;
  const wordCount = text.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
};

export const calculateWordCount = (text?: string): number => {
  if (!text) return 0;
  return text.split(/\s+/).length;
};

export const extractTextFromHTML = (html?: string): string => {
  if (!html) return '';
  // Basic HTML tag removal (consider using a proper HTML parser in production)
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Platform-specific content ID generators
export const generatePlatformContentId = (
  platform: Platform,
  data: any
): string => {
  switch (platform) {
    case 'youtube':
      return data.videoId || data.id || '';
    case 'twitter':
      return data.tweetId || data.id || '';
    case 'linkedin':
      return data.postId || data.id || '';
    case 'threads':
      return data.postId || data.id || '';
    case 'rss':
      return data.guid || data.link || '';
    case 'website':
      return data.url || data.link || '';
    default:
      return '';
  }
};

// Constants
export const DEFAULT_CONTENT_FILTERS: ContentFilters = {
  limit: 20,
  offset: 0,
  sort_by: 'published_at',
  sort_order: 'desc',
};

export const CONTENT_ERROR_MESSAGES: Record<ContentErrorCode, string> = {
  DUPLICATE_CONTENT: 'Content already exists for this platform and creator',
  INVALID_PLATFORM: 'Invalid platform specified',
  CREATOR_NOT_FOUND: 'Creator not found',
  CONTENT_NOT_FOUND: 'Content not found',
  STORAGE_ERROR: 'Failed to store content in database',
  VALIDATION_ERROR: 'Content validation failed',
  PROCESSING_ERROR: 'Failed to process content',
};

// Type guards
export const isValidPlatform = (platform: string): platform is Platform => {
  return [
    'youtube',
    'twitter',
    'linkedin',
    'threads',
    'rss',
    'website',
  ].includes(platform);
};

export const isProcessingStatus = (
  status: string
): status is ContentProcessingStatus => {
  return ['pending', 'processed', 'failed'].includes(status);
};
