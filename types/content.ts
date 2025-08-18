import { z } from 'zod';
import { Platform, PlatformSchema } from './creator';

// Re-export Platform for convenience
export type { Platform } from './creator';

// Content processing status enum
export type ContentProcessingStatus = 'pending' | 'processed' | 'failed';

// Summary generation status enum
export type SummaryStatus = 'pending' | 'processing' | 'completed' | 'error';

// Reference type for tweets that reference other content
export type ReferenceType = 'quote' | 'retweet' | 'reply';

// Base content interface matching the database schema
export interface Content {
  id: string;
  creator_id: string;
  platform: Platform;
  platform_content_id: string;
  url: string;
  title?: string | null;
  description?: string | null;
  thumbnail_url?: string | null;
  published_at?: string | null;
  content_body?: string | null;
  ai_summary?: string | null; // Deprecated - use ai_summary_short or ai_summary_long
  ai_summary_short?: string | null;
  ai_summary_long?: string | null;
  summary_generated_at?: string | null;
  summary_model?: string | null;
  summary_status?: SummaryStatus | null;
  summary_error_message?: string | null;
  summary_word_count_short?: number | null;
  summary_word_count_long?: number | null;
  processing_status?: ContentProcessingStatus | null;
  error_message?: string | null;
  created_at: string | null;
  updated_at: string | null;
  word_count?: number | null;
  reading_time_minutes?: number | null;
  media_urls?: MediaUrl[] | null;
  engagement_metrics?: EngagementMetrics | null;
  // Reference fields for quoted/retweeted/replied content
  reference_type?: ReferenceType | null;
  referenced_content_id?: string | null;
  referenced_content?: ReferencedContent | null;
  // Relevancy scoring fields
  relevancy_score?: number | null;
  relevancy_checked_at?: string | null;
  relevancy_reason?: string | null;
}

// Content with creator information
export interface ContentWithCreator extends Content {
  creator?: {
    id: string;
    name: string;
    platform: Platform;
    avatar_url?: string | null;
    metadata?: Record<string, any>;
    lounges?: Array<{ id: string; name: string }>;
  };
  topics?: Array<{
    id: string;
    name: string;
    slug: string;
    color?: string;
    icon?: string;
  }>;
  is_saved?: boolean;
  is_deleted?: boolean;
  deletion_reason?: string;
}

// Media URL structure for images, videos, etc.
export interface MediaUrl {
  url: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'link_preview';
  title?: string;
  width?: number;
  height?: number;
  duration?: number; // For video/audio in milliseconds
  size?: number; // File size in bytes
  thumbnail_url?: string; // For video thumbnails
  bitrate?: number; // For video/audio bitrate
  // Link preview specific fields
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_domain?: string;
  link_display_url?: string;
  card_type?: string;
}

// Referenced content structure (for quotes, retweets, replies)
export interface ReferencedContent {
  id: string;
  platform_content_id: string;
  url?: string;
  text?: string;
  author?: {
    id?: string;
    username?: string;
    name?: string;
    avatar_url?: string;
    is_verified?: boolean;
  };
  created_at?: string;
  media_urls?: MediaUrl[];
  engagement_metrics?: EngagementMetrics;
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
  // Reference fields for quoted/retweeted/replied content
  reference_type?: ReferenceType;
  referenced_content_id?: string;
  referenced_content?: ReferencedContent;
}

// Content update input
export interface UpdateContentInput {
  title?: string;
  description?: string;
  thumbnail_url?: string;
  content_body?: string;
  ai_summary?: string; // Deprecated
  ai_summary_short?: string;
  ai_summary_long?: string;
  summary_generated_at?: string;
  summary_model?: string;
  summary_status?: SummaryStatus;
  summary_error_message?: string;
  processing_status?: ContentProcessingStatus;
  error_message?: string;
  word_count?: number;
  reading_time_minutes?: number;
  media_urls?: MediaUrl[];
  engagement_metrics?: EngagementMetrics;
  // Reference fields for quoted/retweeted/replied content
  reference_type?: ReferenceType;
  referenced_content_id?: string;
  referenced_content?: ReferencedContent;
}

// Content query filters
export interface ContentFilters {
  creator_id?: string;
  platform?: Platform;
  processing_status?: ContentProcessingStatus;
  summary_status?: SummaryStatus;
  from_date?: string;
  to_date?: string;
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?:
    | 'published_at'
    | 'created_at'
    | 'updated_at'
    | 'summary_generated_at';
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

// AI Summary generation input
export interface GenerateSummaryInput {
  content_id: string;
  text: string; // Combined title, description, and content_body
  model?: string; // AI model to use (e.g., 'gpt-4', 'claude-3')
  generateShort?: boolean; // Generate short summary (default: true)
  generateLong?: boolean; // Generate long summary (default: true)
}

// AI Summary generation result
export interface GenerateSummaryResult {
  content_id: string;
  success: boolean;
  shortSummary?: string;
  longSummary?: string;
  error?: string;
}

// Zod schemas for validation
export const ContentProcessingStatusSchema = z.enum([
  'pending',
  'processed',
  'failed',
]);

export const SummaryStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'error',
]);

export const ReferenceTypeSchema = z.enum(['quote', 'retweet', 'reply']);

export const MediaUrlSchema = z.object({
  url: z.string().url(),
  type: z.enum(['image', 'video', 'audio', 'document', 'link_preview']),
  title: z.string().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  duration: z.number().positive().optional(),
  size: z.number().positive().optional(),
  thumbnail_url: z.string().optional(),
  bitrate: z.number().positive().optional(),
  // Link preview specific fields
  link_url: z.string().optional(),
  link_title: z.string().optional(),
  link_description: z.string().optional(),
  link_domain: z.string().optional(),
  link_display_url: z.string().optional(),
  card_type: z.string().optional(),
});

export const ReferencedContentSchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    id: z.string(),
    platform_content_id: z.string(),
    url: z.string().optional(),
    text: z.string().optional(),
    author: z
      .object({
        id: z.string().optional(),
        username: z.string().optional(),
        name: z.string().optional(),
        avatar_url: z.string().optional(),
        is_verified: z.boolean().optional(),
      })
      .optional(),
    created_at: z.string().optional(),
    media_urls: z.array(MediaUrlSchema).optional(),
    engagement_metrics: EngagementMetricsSchema.optional(),
  })
);

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
  reference_type: ReferenceTypeSchema.optional(),
  referenced_content_id: z.string().uuid().optional(),
  referenced_content: ReferencedContentSchema.optional(),
});

export const UpdateContentInputSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().optional(),
  thumbnail_url: z.string().url().max(255).optional(),
  content_body: z.string().optional(),
  ai_summary: z.string().optional(), // Deprecated
  ai_summary_short: z.string().max(300).optional(), // ~30 words max
  ai_summary_long: z.string().max(1000).optional(), // ~100 words max
  summary_generated_at: z.string().datetime().optional(),
  summary_model: z.string().max(50).optional(),
  summary_status: SummaryStatusSchema.optional(),
  summary_error_message: z.string().optional(),
  processing_status: ContentProcessingStatusSchema.optional(),
  error_message: z.string().optional(),
  word_count: z.number().nonnegative().optional(),
  reading_time_minutes: z.number().nonnegative().optional(),
  media_urls: z.array(MediaUrlSchema).optional(),
  engagement_metrics: EngagementMetricsSchema.optional(),
  reference_type: ReferenceTypeSchema.optional(),
  referenced_content_id: z.string().uuid().optional(),
  referenced_content: ReferencedContentSchema.optional(),
});

export const ContentFiltersSchema = z.object({
  creator_id: z.string().uuid().optional(),
  platform: PlatformSchema.optional(),
  processing_status: ContentProcessingStatusSchema.optional(),
  summary_status: SummaryStatusSchema.optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().nonnegative().default(0).optional(),
  sort_by: z
    .enum(['published_at', 'created_at', 'updated_at', 'summary_generated_at'])
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

export const isSummaryStatus = (status: string): status is SummaryStatus => {
  return ['pending', 'processing', 'completed', 'error'].includes(status);
};
