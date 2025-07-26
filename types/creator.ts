import { z } from 'zod';

// Platform types
export type Platform =
  | 'youtube'
  | 'twitter'
  | 'linkedin'
  | 'threads'
  | 'rss'
  | 'website';

// Creator URL interface matching creator_urls table
export interface CreatorUrl {
  id: string;
  platform: Platform;
  url: string;
  validation_status: 'valid' | 'invalid' | 'pending';
}

// Core Creator interface matching database schema
export interface Creator {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  // Legacy single platform field for backward compatibility
  platform?: Platform;
  platform_user_id?: string;
  profile_url?: string;
  avatar_url?: string;
  metadata?: Record<string, unknown>;
  status?: 'active' | 'inactive' | 'suspended';
  // Renamed from is_active for consistency with DB
  is_active?: boolean;
  created_at: string;
  updated_at: string;
  lounges?: string[];
  // New field for multiple URLs
  urls?: CreatorUrl[];
  creator_urls?: CreatorUrl[];
}

// Creator list response from API
export interface CreatorListResponse {
  creators: Creator[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filtering and sorting options
export interface CreatorFilters {
  search?: string;
  platform?: Platform;
  lounge?: string;
  status?: 'active' | 'inactive' | 'all';
  sort?: 'display_name' | 'platform' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Zod schemas for validation
export const PlatformSchema = z.enum([
  'youtube',
  'twitter',
  'linkedin',
  'threads',
  'rss',
  'website',
]);

export const CreatorSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  display_name: z.string().min(1, 'Display name is required'),
  description: z.string().optional(),
  platform: PlatformSchema,
  platform_user_id: z.string(),
  profile_url: z.string().url('Must be a valid URL'),
  avatar_url: z.string().url().optional().or(z.literal('')),
  metadata: z.record(z.unknown()).default({}),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string(),
  topics: z.array(z.string()).optional(),
});

export const CreatorFiltersSchema = z.object({
  search: z.string().optional(),
  platform: PlatformSchema.optional(),
  topic: z.string().optional(),
  status: z.enum(['active', 'inactive', 'all']).optional(),
  sort: z
    .enum(['display_name', 'platform', 'created_at', 'updated_at'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.number().min(1).optional(),
  limit: z.number().min(1).max(100).optional(),
});

export const CreatorListResponseSchema = z.object({
  creators: z.array(CreatorSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Form data for creating/updating creators
export interface CreateCreatorData {
  urls: string[];
  display_name: string;
  description?: string;
  topics?: string[];
}

export interface UpdateCreatorData {
  display_name?: string;
  description?: string;
  topics?: string[];
  is_active?: boolean;
}

// Component props interfaces
export interface CreatorListViewProps {
  initialFilters?: Partial<CreatorFilters>;
  onCreatorSelect?: (creator: Creator) => void;
  onCreatorEdit?: (creator: Creator) => void;
  onCreatorDelete?: (creatorId: string) => void;
  showBulkActions?: boolean;
  isSelectable?: boolean;
}

export interface CreatorCardProps {
  creator: Creator;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleStatus?: () => void;
  showActions?: boolean;
}

export interface CreatorTableRowProps extends CreatorCardProps {
  // Inherits all props from CreatorCardProps
}

export interface CreatorFiltersProps {
  filters: CreatorFilters;
  onFiltersChange: (filters: Partial<CreatorFilters>) => void;
  onClearFilters: () => void;
  availableTopics?: string[];
  isLoading?: boolean;
}

export interface CreatorSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}

// Bulk action types
export type BulkAction = 'delete' | 'activate' | 'deactivate' | 'export';

export interface BulkActionResult {
  success: boolean;
  message: string;
  affectedCount: number;
  errors?: string[];
}

// Hook return types
export interface UseCreatorListReturn {
  creators: Creator[];
  loading: boolean;
  error: string | null;
  filters: CreatorFilters;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  selectedCreators: Set<string>;
  updateFilters: (filters: Partial<CreatorFilters>) => void;
  clearFilters: () => void;
  selectCreator: (creatorId: string, selected: boolean) => void;
  selectAll: (selected: boolean) => void;
  performBulkAction: (
    action: BulkAction,
    creatorIds: string[]
  ) => Promise<BulkActionResult>;
  refreshCreators: () => void;
}

// Error types
export class CreatorError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'CreatorError';
  }
}

// Platform metadata interfaces
export interface YouTubeMetadata {
  channelId: string;
  subscriberCount?: number;
  videoCount?: number;
  customUrl?: string;
}

export interface TwitterMetadata {
  username: string;
  followersCount?: number;
  verified?: boolean;
  profileImageUrl?: string;
}

export interface LinkedInMetadata {
  profileId: string;
  connectionsCount?: number;
  industry?: string;
  company?: string;
}

export interface ThreadsMetadata {
  username: string;
  followersCount?: number;
  isVerified?: boolean;
}

export interface RSSMetadata {
  feedUrl: string;
  title: string;
  description?: string;
  lastBuildDate?: string;
  language?: string;
  generator?: string;
}

// Union type for platform-specific metadata
export type PlatformMetadata =
  | ({ platform: 'youtube' } & YouTubeMetadata)
  | ({ platform: 'twitter' } & TwitterMetadata)
  | ({ platform: 'linkedin' } & LinkedInMetadata)
  | ({ platform: 'threads' } & ThreadsMetadata)
  | ({ platform: 'rss' } & RSSMetadata);

// Utility types
export type CreatorSortField = keyof Pick<
  Creator,
  'display_name' | 'platform' | 'created_at' | 'updated_at'
>;
export type SortOrder = 'asc' | 'desc';

// Constants
export const PLATFORMS: Record<
  Platform,
  { label: string; icon: string; color: string }
> = {
  youtube: { label: 'YouTube', icon: 'Youtube', color: 'red' },
  twitter: { label: 'Twitter', icon: 'Twitter', color: 'blue' },
  linkedin: { label: 'LinkedIn', icon: 'Linkedin', color: 'blue' },
  threads: { label: 'Threads', icon: 'AtSign', color: 'purple' },
  rss: { label: 'RSS', icon: 'Rss', color: 'orange' },
  website: { label: 'Website', icon: 'Globe', color: 'gray' },
};

export const DEFAULT_FILTERS: CreatorFilters = {
  page: 1,
  limit: 10,
  sort: 'created_at',
  order: 'desc',
  status: 'all',
};

export const DEFAULT_CREATOR_LIST_LIMIT = 10;
export const MAX_CREATOR_LIST_LIMIT = 100;
