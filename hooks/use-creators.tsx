'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import type { Creator, CreatorFilters } from '@/types/creator';
import { DEFAULT_FILTERS } from '@/types/creator';

export function useCreators(initialFilters: Partial<CreatorFilters> = {}) {
  const {
    state: { user, session, loading: authLoading },
  } = useAuth();
  const [allCreatorsData, setAllCreatorsData] = useState<Creator[]>([]);
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
  const previousFiltersRef = useRef<CreatorFilters>(filters);

  // Fetch all creators data once (or when refresh is triggered)
  useEffect(() => {
    // Skip if auth is still loading
    if (authLoading) {
      return;
    }

    // Handle authentication state properly
    if (!user || !session) {
      setLoading(false);
      setError('Please sign in to view your creators');
      setAllCreatorsData([]);
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      return;
    }

    const fetchAllCreators = async () => {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const supabase = createBrowserSupabaseClient();

        // Fetch ALL creators without any filters (we'll filter client-side)
        const { data: allCreators, error: fetchError } = await supabase
          .from('creators')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        const creatorsData = allCreators || [];

        // If we have creators, fetch all related data at once
        if (creatorsData.length > 0) {
          const creatorIds = creatorsData.map((c) => c.id);

          // Fetch all URLs
          const { data: urls } = await supabase
            .from('creator_urls')
            .select('id, creator_id, platform, url, validation_status')
            .in('creator_id', creatorIds);

          const creatorUrls = urls || [];

          // Fetch all lounges
          const { data: loungesData } = await supabase
            .from('creator_lounges')
            .select('creator_id, lounge_id, lounges(id, name)')
            .in('creator_id', creatorIds);

          const creatorLounges = loungesData || [];

          // Transform creators to include all related data
          const transformedCreators = creatorsData.map((creator) => {
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

          setAllCreatorsData(transformedCreators);
        } else {
          setAllCreatorsData([]);
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

    fetchAllCreators();
  }, [authLoading, user, session, refreshTrigger]); // Remove filters from dependencies

  // Filter and paginate creators on the client side
  const { creators, totalCount } = useMemo(() => {
    let filtered = [...allCreatorsData];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (creator) =>
          creator.display_name?.toLowerCase().includes(searchLower) ||
          creator.bio?.toLowerCase().includes(searchLower)
      );
    }

    // Platform filter
    if (filters.platform) {
      filtered = filtered.filter(
        (creator) => creator.platform === filters.platform
      );
    }

    // Lounge filter
    if (filters.lounge) {
      filtered = filtered.filter((creator) =>
        creator.lounge_ids?.includes(filters.lounge!)
      );
    }

    // Status filter
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'active') {
        filtered = filtered.filter((creator) => creator.is_active);
      } else if (filters.status === 'inactive') {
        filtered = filtered.filter((creator) => !creator.is_active);
      }
    }

    // Sorting
    const sortField = filters.sort || 'created_at';
    const sortOrder = filters.order || 'desc';

    filtered.sort((a, b) => {
      let aVal = a[sortField as keyof Creator];
      let bVal = b[sortField as keyof Creator];

      // Handle null/undefined values
      if (aVal == null) return sortOrder === 'asc' ? 1 : -1;
      if (bVal == null) return sortOrder === 'asc' ? -1 : 1;

      // Compare values
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const total = filtered.length;

    // Pagination
    const page = filters.page || 1;
    const limit = filters.limit || 10;
    const from = (page - 1) * limit;
    const to = from + limit;
    const paginated = filtered.slice(from, to);

    return { creators: paginated, totalCount: total };
  }, [allCreatorsData, filters]);

  // Update pagination when filtered results change
  useEffect(() => {
    setPagination({
      page: filters.page || 1,
      limit: filters.limit || 10,
      total: totalCount,
      totalPages: Math.ceil(totalCount / (filters.limit || 10)),
    });
  }, [totalCount, filters.page, filters.limit]);

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
