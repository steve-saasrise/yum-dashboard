'use client';

import { useState, useEffect, useCallback } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { Creator, CreatorFilters } from '@/types/creator';
import { DEFAULT_FILTERS } from '@/types/creator';

export function useCreators(initialFilters: Partial<CreatorFilters> = {}) {
  const {
    state: { user, session, loading: authLoading },
  } = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CreatorFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  const fetchCreators = useCallback(async () => {
    // Skip if auth is still loading
    if (authLoading) {
      return;
    }

    // Handle authentication state properly
    if (!user || !session) {
      setLoading(false);
      setError('Please sign in to view your creators');
      setCreators([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createBrowserSupabaseClient();

      // Build query
      let query = supabase
        .from('creators')
        .select(
          `
          *,
          creator_urls (
            id,
            platform,
            url,
            validation_status
          ),
          creator_topics (
            topics (
              id,
              name
            )
          )
        `,
          { count: 'exact' }
        )
        .eq('user_id', user.id);

      // Apply filters
      if (filters.platform) {
        query = query.eq('creator_urls.platform', filters.platform);
      }

      if (filters.search) {
        query = query.or(
          `display_name.ilike.%${filters.search}%,bio.ilike.%${filters.search}%`
        );
      }

      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      // Apply sorting
      const orderColumn = filters.sort || 'created_at';
      const orderAscending = filters.order === 'asc';
      query = query.order(orderColumn, { ascending: orderAscending });

      // Apply pagination
      const from = ((filters.page || 1) - 1) * (filters.limit || 10);
      const to = from + (filters.limit || 10) - 1;
      query = query.range(from, to);

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Transform the data
      const transformedCreators =
        data?.map((creator) => {
          const primaryUrl = creator.creator_urls?.[0];
          return {
            ...creator,
            platform: primaryUrl?.platform || 'website',
            urls: creator.creator_urls,
            topics:
              creator.creator_topics
                ?.map((ct: any) => ct.topics?.name)
                .filter(Boolean) || [],
            is_active: creator.status === 'active',
          };
        }) || [];

      setCreators(transformedCreators);

      const totalPages = Math.ceil((count || 0) / (filters.limit || 10));
      setPagination({
        page: filters.page || 1,
        limit: filters.limit || 10,
        total: count || 0,
        totalPages,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load creators');
    } finally {
      setLoading(false);
    }
  }, [user, session, filters, authLoading]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
    } else {
      fetchCreators();
    }
  }, [fetchCreators, authLoading]);

  const updateFilters = useCallback((newFilters: Partial<CreatorFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  return {
    creators,
    loading,
    error,
    filters,
    pagination,
    updateFilters,
    clearFilters,
    refreshCreators: fetchCreators,
  };
}
