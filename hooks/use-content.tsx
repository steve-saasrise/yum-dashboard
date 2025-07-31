'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { ContentWithCreator } from '@/types/content';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useViewportInfo } from './use-viewport-info';

export interface ContentFilters {
  platform?: 'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss' | 'website';
  creator_id?: string;
  lounge_id?: string;
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
  refreshDisplay: () => void;
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
  const { batchSize } = useViewportInfo();

  const supabase = createBrowserSupabaseClient();
  const isFetchingRef = useRef(false);
  const subscriptionRef = useRef<any>(null);

  // Store filters in a ref to avoid dependency issues
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // Store session and batchSize in refs to access current values without causing re-renders
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const batchSizeRef = useRef(batchSize);
  batchSizeRef.current = batchSize;

  // Track if we've done the initial load
  const hasInitialLoadRef = useRef(false);

  // Fetch content from API
  const fetchContent = useCallback(
    async (pageNumber: number = 1, append: boolean = false) => {
      if (!sessionRef.current || isFetchingRef.current) {
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
        params.append('limit', String(currentFilters?.limit || batchSizeRef.current));

        if (currentFilters?.platform)
          params.append('platform', currentFilters.platform);
        if (currentFilters?.creator_id)
          params.append('creator_id', currentFilters.creator_id);
        if (currentFilters?.lounge_id)
          params.append('lounge_id', currentFilters.lounge_id);
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
    [] // No dependencies - using refs instead
  );

  // Handle initial session load
  useEffect(() => {
    if (session && !hasInitialLoadRef.current) {
      hasInitialLoadRef.current = true;
      fetchContent(1, false);
    }
  }, [session, fetchContent]);

  // Initial fetch and refetch when filters change
  useEffect(() => {
    // Only fetch if we have a session and filters have changed after initial load
    if (hasInitialLoadRef.current) {
      fetchContent(1, false);
    }
  }, [
    fetchContent,
    filters?.platform,
    filters?.creator_id,
    filters?.lounge_id,
    filters?.search,
    filters?.sort_by,
    filters?.sort_order,
    // Removed batchSize to prevent refetch on tab focus
  ]);

  // Set up real-time subscription for new content
  useEffect(() => {
    if (!session) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    // Get creator IDs based on lounge filter or all user lounges
    const fetchCreatorIds = async () => {
      let creatorIds: string[] = [];

      if (filtersRef.current?.lounge_id) {
        // Get creators for specific lounge
        const { data: creators } = await supabase
          .from('creators')
          .select('id')
          .eq('lounge_id', filtersRef.current.lounge_id);

        creatorIds = creators?.map((c) => c.id) || [];
      } else {
        // Get all creators from user's lounges
        const { data: userLounges } = await supabase
          .from('user_lounges')
          .select('lounge_id')
          .eq('user_id', session.user.id);

        const loungeIds = userLounges?.map((ul) => ul.lounge_id) || [];

        if (loungeIds.length > 0) {
          const { data: creators } = await supabase
            .from('creators')
            .select('id')
            .in('lounge_id', loungeIds);

          creatorIds = creators?.map((c) => c.id) || [];
        }
      }

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
  }, [session, supabase, filters?.lounge_id]);

  // Save content
  const saveContent = useCallback(
    async (contentId: string) => {
      if (!sessionRef.current) {
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
    [] // No dependencies - using refs instead
  );

  // Unsave content
  const unsaveContent = useCallback(
    async (contentId: string) => {
      if (!sessionRef.current) {
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
    [] // No dependencies - using refs instead
  );

  // Refresh content
  const refreshContent = useCallback(async () => {
    // First, trigger manual RSS fetch
    let toastId: string | number | undefined;
    try {
      toastId = toast.loading('Checking for new content...');

      const response = await fetch('/api/content/refresh-service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        toast.dismiss(toastId);

        // Check if any creators were skipped
        const skippedCreators =
          result.stats.creators?.filter((c: any) =>
            c.urls.some((u: any) => u.status === 'skipped')
          ) || [];

        if (skippedCreators.length > 0) {
          const skipMessage = skippedCreators[0].urls[0].message;
          toast.warning(`Some creators were skipped: ${skipMessage}`);
        }

        if (result.stats.new > 0) {
          toast.success(`Added ${result.stats.new} new items`);
        } else if (skippedCreators.length === 0) {
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

  // Refresh display without fetching new content from external sources
  const refreshDisplay = useCallback(() => {
    fetchContent(1, false);
  }, [fetchContent]);

  return {
    content,
    loading,
    error,
    hasMore,
    total,
    saveContent,
    unsaveContent,
    refreshContent,
    refreshDisplay,
    loadMore,
  };
}
