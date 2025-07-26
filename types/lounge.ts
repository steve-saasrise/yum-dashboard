import { z } from 'zod';

// Core Lounge interface matching database schema
export interface Lounge {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  parent_lounge_id?: string;
  created_at: string;
  updated_at: string;
  usage_count: number;
  is_system_lounge: boolean;
  creator_count: number;
  content_count: number;
  // For UI: nested parent lounge info
  parent_lounge?: Lounge;
  // For UI: child lounges
  child_lounges?: Lounge[];
}

// Lounge list response from API
export interface LoungeListResponse {
  lounges: Lounge[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Filtering and sorting options
export interface LoungeFilters {
  search?: string;
  parent_lounge_id?: string;
  is_system_lounge?: boolean;
  has_creators?: boolean;
  sort?: 'name' | 'usage_count' | 'creator_count' | 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

// Zod schemas for validation
export const LoungeSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional().nullable(),
  name: z.string().min(1, 'Lounge name is required').max(50),
  description: z.string().max(200).optional().nullable(),
  parent_lounge_id: z.string().uuid().optional().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  usage_count: z.number().int().min(0).default(0),
  is_system_lounge: z.boolean().default(false),
  creator_count: z.number().int().min(0).default(0),
  content_count: z.number().int().min(0).default(0),
});

export const CreateLoungeSchema = z.object({
  name: z.string().min(1, 'Lounge name is required').max(50),
  description: z.string().max(200).optional(),
  parent_lounge_id: z.string().uuid().optional(),
});

export const UpdateLoungeSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(200).optional().nullable(),
  parent_lounge_id: z.string().uuid().optional().nullable(),
});

export const LoungeFiltersSchema = z.object({
  search: z.string().optional(),
  parent_lounge_id: z.string().uuid().optional(),
  is_system_lounge: z
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

export const LoungeListResponseSchema = z.object({
  lounges: z.array(LoungeSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// Form data for creating/updating lounges
export interface CreateLoungeData {
  name: string;
  description?: string;
  parent_lounge_id?: string;
}

export interface UpdateLoungeData {
  name?: string;
  description?: string;
  parent_lounge_id?: string;
}

// Component props interfaces (for Phase 2)
export interface LoungeSelectorProps {
  selectedLounges?: string[];
  onChange: (lounges: string[]) => void;
  placeholder?: string;
  maxSelections?: number;
  allowCreate?: boolean;
  onCreateLounge?: (name: string) => Promise<Lounge>;
  disabled?: boolean;
  className?: string;
}

export interface LoungeBadgeProps {
  lounge: Lounge;
  onRemove?: () => void;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
}

// Error types
export class LoungeError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LoungeError';
  }
}

// Hook return types (for Phase 2)
export interface UseLoungesReturn {
  lounges: Lounge[];
  loading: boolean;
  error: string | null;
  createLounge: (data: CreateLoungeData) => Promise<Lounge>;
  updateLounge: (id: string, data: UpdateLoungeData) => Promise<Lounge>;
  deleteLounge: (id: string) => Promise<void>;
  refreshLounges: () => void;
}

// Constants
export const DEFAULT_LOUNGE_FILTERS: LoungeFilters = {
  page: 1,
  limit: 50,
  sort: 'name',
  order: 'asc',
};

export const MAX_LOUNGE_NAME_LENGTH = 50;
export const MAX_LOUNGE_DESCRIPTION_LENGTH = 200;
export const MAX_LOUNGE_DEPTH = 3; // Maximum nesting depth for hierarchical lounges

// Common system lounges
export const SYSTEM_LOUNGES = [
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

export type SystemLounge = (typeof SYSTEM_LOUNGES)[number];
