'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import type { ContentWithCreator } from '@/types/content';

const ITEMS_PER_PAGE = 50; // Larger batch size for fewer loading interruptions

export interface ContentFilters {
  platforms?: Array<
    'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss' | 'website'
  >;
  creator_id?: string;
  lounge_id?: string;
  search?: string;
  sort_by?: 'published_at' | 'created_at';
  sort_order?: 'asc' | 'desc';
}

interface ContentResponse {
  content: ContentWithCreator[];
  hasMore: boolean;
  nextPage: number | null;
  total: number;
}

async function fetchContent({
  pageParam = 1,
  filters,
  signal,
}: {
  pageParam?: number;
  filters?: ContentFilters;
  signal?: AbortSignal;
}): Promise<ContentResponse> {
  const params = new URLSearchParams();
  params.append('page', String(pageParam));
  params.append('limit', String(ITEMS_PER_PAGE));

  if (filters?.platforms && filters.platforms.length > 0) {
    params.append('platforms', filters.platforms.join(','));
  }
  if (filters?.creator_id) {
    params.append('creator_id', filters.creator_id);
  }
  if (filters?.lounge_id) {
    params.append('lounge_id', filters.lounge_id);
  }
  if (filters?.search) {
    params.append('search', filters.search);
  }
  params.append('sort_by', filters?.sort_by || 'published_at');
  params.append('sort_order', filters?.sort_order || 'desc');

  const response = await fetch(`/api/content?${params.toString()}`, {
    signal,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch content');
  }

  const data = await response.json();

  return {
    content: data.content || [],
    hasMore: data.has_more ?? false,
    nextPage: data.has_more ? pageParam + 1 : null,
    total: data.total || 0,
  };
}

export function useInfiniteContent(filters?: ContentFilters) {
  const { state } = useAuth();
  const { session } = state;
  const prefetchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const queryKey = useMemo(() => ['content', 'infinite', filters], [filters]);

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam = 1, signal }) =>
      fetchContent({ pageParam, filters, signal }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!session,
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Prefetch next page automatically when current page is loaded
    placeholderData: (previousData) => previousData,
  });

  // Remove automatic prefetching - let IntersectionObserver handle it based on scroll position

  // Flatten all pages into a single array
  const allContent = useMemo(() => {
    return data?.pages.flatMap((page) => page.content) ?? [];
  }, [data]);

  // Total count from the first page
  const total = data?.pages[0]?.total ?? 0;

  // Save/unsave content functions with optimistic updates
  const saveContent = useCallback(async (contentId: string) => {
    try {
      const response = await fetch(`/api/content/${contentId}/save`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to save content');
      }

      toast.success('Content saved');
    } catch (error) {
      toast.error('Failed to save content');
      console.error('Error saving content:', error);
    }
  }, []);

  const unsaveContent = useCallback(async (contentId: string) => {
    try {
      const response = await fetch(`/api/content/${contentId}/save`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to unsave content');
      }

      toast.success('Content removed from saved');
    } catch (error) {
      toast.error('Failed to unsave content');
      console.error('Error unsaving content:', error);
    }
  }, []);

  // Delete/undelete content functions
  const deleteContent = useCallback(
    async (contentId: string) => {
      try {
        const params = new URLSearchParams({
          content_id: contentId,
          action: 'delete',
        });

        const response = await fetch(`/api/content?${params.toString()}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete content');
        }

        toast.success('Content deleted');
        // Refetch to update the list
        refetch();
      } catch (error) {
        toast.error('Failed to delete content');
        console.error('Error deleting content:', error);
      }
    },
    [refetch]
  );

  const undeleteContent = useCallback(
    async (contentId: string) => {
      try {
        const params = new URLSearchParams({
          content_id: contentId,
          action: 'undelete',
        });

        const response = await fetch(`/api/content?${params.toString()}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to restore content');
        }

        toast.success('Content restored');
        // Refetch to update the list
        refetch();
      } catch (error) {
        toast.error('Failed to restore content');
        console.error('Error restoring content:', error);
      }
    },
    [refetch]
  );

  return {
    content: allContent,
    loading: isLoading,
    error: error?.message ?? null,
    hasMore: hasNextPage ?? false,
    total,
    isFetchingNextPage,
    isFetching,
    saveContent,
    unsaveContent,
    deleteContent,
    undeleteContent,
    refreshContent: refetch,
    fetchNextPage,
  };
}
