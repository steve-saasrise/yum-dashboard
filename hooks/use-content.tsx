'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { ContentWithCreator } from '@/types/content';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface ContentFilters {
  platform?: 'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss' | 'website';
  creator_id?: string;
  topic_id?: string;
  search?: string;
  sort_by?: 'published_at' | 'created_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UseContentReturn {
  content: ContentWithCreator[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  saveContent: (contentId: string) => Promise<void>;
  unsaveContent: (contentId: string) => Promise<void>;
  refreshContent: () => void;
  loadMore: () => void;
}

export function useContent(filters?: ContentFilters): UseContentReturn {
  const [content, setContent] = useState<ContentWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const { state } = useAuth();
  const { session } = state;

  const supabase = createBrowserSupabaseClient();
  const isFetchingRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  // Store filters in a ref to avoid dependency issues
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Fetch content from API
  const fetchContent = useCallback(
    async (pageNumber: number = 1, append: boolean = false) => {
      if (!session || isFetchingRef.current) {
        setLoading(false);
        return;
      }

      isFetchingRef.current = true;
      if (!append) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const currentFilters = filtersRef.current;

        params.append('page', String(pageNumber));
        params.append('limit', String(currentFilters?.limit || 20));

        if (currentFilters?.platform)
          params.append('platform', currentFilters.platform);
        if (currentFilters?.creator_id)
          params.append('creator_id', currentFilters.creator_id);
        if (currentFilters?.topic_id)
          params.append('topic_id', currentFilters.topic_id);
        if (currentFilters?.search)
          params.append('search', currentFilters.search);
        if (currentFilters?.sort_by)
          params.append('sort_by', currentFilters.sort_by);
        if (currentFilters?.sort_order)
          params.append('sort_order', currentFilters.sort_order);

        const response = await fetch(`/api/content?${params}`, {
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies in the request
        });

        if (!response.ok) {
          throw new Error('Failed to fetch content');
        }

        const result = await response.json();

        if (append) {
          setContent((prev) => [...prev, ...result.content]);
        } else {
          setContent(result.content);
        }

        setHasMore(result.has_more);
        setTotal(result.total);
        setPage(pageNumber);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load content';
        setError(message);
        if (!append) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    },
    [session]
  );

  // Initial fetch and refetch when filters change
  useEffect(() => {
    fetchContent(1, false);
  }, [
    fetchContent,
    filters?.platform,
    filters?.creator_id,
    filters?.topic_id,
    filters?.search,
    filters?.sort_by,
    filters?.sort_order,
  ]);

  // Set up real-time subscription for new content
  useEffect(() => {
    if (!session) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Get user's creator IDs for filtering real-time updates
    const fetchCreatorIds = async () => {
      const { data: creators } = await supabase
        .from('creators')
        .select('id')
        .eq('user_id', session.user.id);

      const creatorIds = creators?.map((c) => c.id) || [];

      // Subscribe to content changes for user's creators
      subscriptionRef.current = supabase
        .channel('content-changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'content',
            filter: `creator_id=in.(${creatorIds.join(',')})`,
          },
          async (payload: RealtimePostgresChangesPayload<any>) => {
            // Only process content that is marked as processed
            if (payload.new.processing_status !== 'processed') {
              return;
            }
            
            // Fetch the complete content with creator info
            const { data: newContent } = await supabase
              .from('content')
              .select(
                `
                *,
                creator:creators!inner(
                  id,
                  display_name,
                  avatar_url,
                  metadata
                )
              `
              )
              .eq('id', payload.new.id)
              .eq('processing_status', 'processed')
              .single();

            if (newContent) {
              const transformedContent: ContentWithCreator = {
                ...newContent,
                topics: [], // No topics for now since content_topics table doesn't exist
                creator: newContent.creator
                  ? {
                      ...newContent.creator,
                      name: newContent.creator.display_name, // Map display_name to name
                      platform: newContent.platform, // Get platform from content
                    }
                  : undefined,
              };

              // Add to the beginning of the content list
              setContent((prev) => [transformedContent, ...prev]);
              setTotal((prev) => prev + 1);

              // Show toast notification
              toast.success(
                `New content from ${transformedContent.creator?.name || 'Unknown'}`
              );
            }
          }
        )
        .subscribe();
    };

    fetchCreatorIds();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, [session, supabase]);

  // Save content
  const saveContent = useCallback(
    async (contentId: string) => {
      if (!session) {
        toast.error('Please sign in to save content');
        return;
      }

      try {
        const response = await fetch('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies in the request
          body: JSON.stringify({
            content_id: contentId,
            action: 'save',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save content');
        }

        // Update local state
        setContent((prev) =>
          prev.map((item) =>
            item.id === contentId ? { ...item, is_saved: true } : item
          )
        );

        toast.success('Content saved');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to save content';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  // Unsave content
  const unsaveContent = useCallback(
    async (contentId: string) => {
      if (!session) {
        toast.error('Please sign in to manage saved content');
        return;
      }

      try {
        const response = await fetch('/api/content', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies in the request
          body: JSON.stringify({
            content_id: contentId,
            action: 'unsave',
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to unsave content');
        }

        // Update local state
        setContent((prev) =>
          prev.map((item) =>
            item.id === contentId ? { ...item, is_saved: false } : item
          )
        );

        toast.success('Content removed from saved');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to unsave content';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  // Refresh content
  const refreshContent = useCallback(async () => {
    // First, trigger manual RSS fetch
    let toastId: string | number | undefined;
    try {
      toastId = toast.loading('Fetching new content...');

      const response = await fetch('/api/content/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        toast.dismiss(toastId);
        if (result.stats.new > 0) {
          toast.success(`Added ${result.stats.new} new items`);
        } else {
          toast.info('No new content found');
        }
      } else {
        toast.dismiss(toastId);
        toast.error('Failed to fetch new content');
      }
    } catch (error) {
      console.error('Error refreshing content:', error);
      if (toastId) toast.dismiss(toastId);
      toast.error('Failed to fetch new content');
    }

    // Then refresh the display
    fetchContent(1, false);
  }, [fetchContent]);

  // Load more content (pagination)
  const loadMore = useCallback(() => {
    if (!hasMore || isFetchingRef.current) return;
    fetchContent(page + 1, true);
  }, [fetchContent, hasMore, page]);

  return {
    content,
    loading,
    error,
    hasMore,
    total,
    saveContent,
    unsaveContent,
    refreshContent,
    loadMore,
  };
}
