'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Use a ref to track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);

  useEffect(() => {
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

    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      return;
    }

    const fetchCreators = async () => {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const supabase = createBrowserSupabaseClient();

        // Build base query - fetch creators only first
        let baseQuery = supabase
          .from('creators')
          .select('*', { count: 'exact' });

        // Apply search filter
        if (filters.search) {
          baseQuery = baseQuery.or(
            `display_name.ilike.%${filters.search}%,bio.ilike.%${filters.search}%`
          );
        }

        // Apply status filter
        if (filters.status && filters.status !== 'all') {
          baseQuery = baseQuery.eq('status', filters.status);
        }

        // Apply sorting
        const orderColumn = filters.sort || 'created_at';
        const orderAscending = filters.order === 'asc';
        baseQuery = baseQuery.order(orderColumn, { ascending: orderAscending });

        // Get all creators first (without pagination) to properly filter
        const { data: allCreators, error: fetchError, count } = await baseQuery;

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        let filteredCreators = allCreators || [];

        // If we have creators, fetch related data separately
        if (filteredCreators.length > 0) {
          const creatorIds = filteredCreators.map((c) => c.id);

          // Fetch URLs with optional platform filter
          let urlQuery = supabase
            .from('creator_urls')
            .select('id, creator_id, platform, url, validation_status')
            .in('creator_id', creatorIds);

          if (filters.platform) {
            urlQuery = urlQuery.eq('platform', filters.platform);
          }

          const { data: urls } = await urlQuery;
          const creatorUrls = urls || [];

          // If platform filtering is applied, filter creators that have URLs for that platform
          if (filters.platform && creatorUrls.length >= 0) {
            const creatorsWithPlatform = new Set(
              creatorUrls.map((url) => url.creator_id)
            );
            filteredCreators = filteredCreators.filter((creator) =>
              creatorsWithPlatform.has(creator.id)
            );
          }

          // Fetch lounges separately
          const { data: loungesData } = await supabase
            .from('creator_lounges')
            .select('creator_id, lounge_id, lounges(id, name)')
            .in(
              'creator_id',
              filteredCreators.map((c) => c.id)
            );

          const creatorLounges = loungesData || [];

          // If lounge filtering is applied, filter creators that have the selected lounge
          if (filters.lounge) {
            const creatorsWithLounge = new Set(
              creatorLounges
                .filter((cl: any) => cl.lounges?.id === filters.lounge)
                .map((cl) => cl.creator_id)
            );
            filteredCreators = filteredCreators.filter((creator) =>
              creatorsWithLounge.has(creator.id)
            );
          }

          // Apply pagination after all filtering
          const from = ((filters.page || 1) - 1) * (filters.limit || 10);
          const to = from + (filters.limit || 10);
          const paginatedCreators = filteredCreators.slice(from, to);

          // Transform creators to include related data
          const transformedCreators = paginatedCreators.map((creator) => {
            // Get URLs for this creator
            const creatorUrlsList = creatorUrls.filter(
              (url) => url.creator_id === creator.id
            );

            // Get lounges for this creator
            const creatorLoungesList = creatorLounges
              .filter((cl) => cl.creator_id === creator.id)
              .map((cl: any) => cl.lounges?.name)
              .filter(Boolean);

            // Also get lounge IDs for the edit modal
            const creatorLoungeIds = creatorLounges
              .filter((cl) => cl.creator_id === creator.id)
              .map((cl: any) => cl.lounges?.id)
              .filter(Boolean);

            // Get the primary platform from the first URL
            const primaryUrl = creatorUrlsList[0];

            return {
              ...creator,
              platform: primaryUrl?.platform || 'website',
              urls: creatorUrlsList,
              creator_urls: creatorUrlsList, // Keep for compatibility
              lounges: creatorLoungesList,
              lounge_ids: creatorLoungeIds, // Add lounge IDs for edit modal
              is_active: creator.status === 'active',
            };
          });

          setCreators(transformedCreators);

          const totalPages = Math.ceil(
            filteredCreators.length / (filters.limit || 10)
          );
          setPagination({
            page: filters.page || 1,
            limit: filters.limit || 10,
            total: filteredCreators.length,
            totalPages,
          });
        } else {
          setCreators([]);
          setPagination({
            page: 1,
            limit: filters.limit || 10,
            total: 0,
            totalPages: 0,
          });
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load creators'
        );
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchCreators();
  }, [authLoading, user, session, filters, refreshTrigger]);

  const updateFilters = useCallback((newFilters: Partial<CreatorFilters>) => {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
      // Only reset to page 1 if we're changing filters other than page
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const refreshCreators = useCallback(() => {
    // Increment the refresh trigger to force a new fetch
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  return {
    creators,
    loading,
    error,
    filters,
    pagination,
    updateFilters,
    clearFilters,
    refreshCreators,
  };
}
