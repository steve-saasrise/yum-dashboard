import { z } from 'zod';

// Core Topic interface matching database schema
export interface Topic {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  parent_topic_id?: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  is_system_topic: boolean;
  creator_count: number;
  content_count: number;
  // For UI: nested parent topic info
  parent_topic?: Topic;
  // For UI: child topics
  child_topics?: Topic[];
}

// Topic list response from API
export interface TopicListResponse {
  topics: Topic[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filtering and sorting options
export interface TopicFilters {
  search?: string;
  parent_topic_id?: string;
  is_system_topic?: boolean;
  has_creators?: boolean;
  sort?: 'name' | 'usage_count' | 'creator_count' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Zod schemas for validation
export const TopicSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Topic name is required').max(50),
  description: z.string().max(200).optional().nullable(),
  parent_topic_id: z.string().uuid().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  usage_count: z.number().int().min(0).default(0),
  is_system_topic: z.boolean().default(false),
  creator_count: z.number().int().min(0).default(0),
  content_count: z.number().int().min(0).default(0),
});

export const CreateTopicSchema = z.object({
  name: z.string().min(1, 'Topic name is required').max(50),
  description: z.string().max(200).optional(),
  parent_topic_id: z.string().uuid().optional(),
});

export const UpdateTopicSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  parent_topic_id: z.string().uuid().optional().nullable(),
});

export const TopicFiltersSchema = z.object({
  search: z.string().optional(),
  parent_topic_id: z.string().uuid().optional(),
  is_system_topic: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
  has_creators: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
  sort: z
    .enum(['name', 'usage_count', 'creator_count', 'created_at', 'updated_at'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
});

export const TopicListResponseSchema = z.object({
  topics: z.array(TopicSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Form data for creating/updating topics
export interface CreateTopicData {
  name: string;
  description?: string;
  parent_topic_id?: string;
}

export interface UpdateTopicData {
  name?: string;
  description?: string;
  parent_topic_id?: string;
}

// Component props interfaces (for Phase 2)
export interface TopicSelectorProps {
  selectedTopics?: string[];
  onChange: (topics: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  allowCreate?: boolean;
  onCreateTopic?: (name: string) => Promise<Topic>;
  disabled?: boolean;
  className?: string;
}

export interface TopicBadgeProps {
  topic: Topic;
  onRemove?: () => void;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

// Error types
export class TopicError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'TopicError';
  }
}

// Hook return types (for Phase 2)
export interface UseTopicsReturn {
  topics: Topic[];
  loading: boolean;
  error: string | null;
  createTopic: (data: CreateTopicData) => Promise<Topic>;
  updateTopic: (id: string, data: UpdateTopicData) => Promise<Topic>;
  deleteTopic: (id: string) => Promise<void>;
  refreshTopics: () => void;
}

// Constants
export const DEFAULT_TOPIC_FILTERS: TopicFilters = {
  page: 1,
  limit: 50,
  sort: 'name',
  order: 'asc',
};

export const MAX_TOPIC_NAME_LENGTH = 50;
export const MAX_TOPIC_DESCRIPTION_LENGTH = 200;
export const MAX_TOPIC_DEPTH = 3; // Maximum nesting depth for hierarchical topics

// Common system topics
export const SYSTEM_TOPICS = [
  'Technology',
  'Business',
  'Education',
  'Entertainment',
  'Health',
  'Science',
  'Politics',
  'Sports',
  'Lifestyle',
  'News',
] as const;

export type SystemTopic = (typeof SYSTEM_TOPICS)[number];
