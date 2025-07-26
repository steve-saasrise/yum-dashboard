'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import type {
  Lounge,
  CreateLoungeData,
  UpdateLoungeData,
  LoungeFilters,
  UseLoungesReturn,
} from '@/types/lounge';

export function useLounges(filters?: LoungeFilters): UseLoungesReturn {
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { state } = useAuth();
  const { session } = state;

  // Use a ref to track if we're currently fetching
  const isFetchingRef = useRef(false);

  // Store filters in a ref to avoid dependency issues
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) {
      return;
    }

    const fetchLounges = async () => {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const currentFilters = filtersRef.current;

        if (currentFilters?.search)
          params.append('search', currentFilters.search);
        if (currentFilters?.parent_lounge_id)
          params.append('parent_lounge_id', currentFilters.parent_lounge_id);
        if (currentFilters?.is_system_lounge !== undefined) {
          params.append(
            'is_system_lounge',
            String(currentFilters.is_system_lounge)
          );
        }
        if (currentFilters?.has_creators !== undefined) {
          params.append('has_creators', String(currentFilters.has_creators));
        }
        if (currentFilters?.sort) params.append('sort', currentFilters.sort);
        if (currentFilters?.order) params.append('order', currentFilters.order);
        if (currentFilters?.page)
          params.append('page', String(currentFilters.page));
        if (currentFilters?.limit)
          params.append('limit', String(currentFilters.limit));

        const response = await fetch(`/api/lounges?${params}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch lounges');
        }

        const result = await response.json();
        setLounges(result.data.lounges);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load lounges';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchLounges();
  }, [session]); // Only depend on session, not filters

  const createLounge = useCallback(
    async (data: CreateLoungeData): Promise<Lounge> => {
      try {
        const response = await fetch('/api/lounges', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create lounge');
        }

        const result = await response.json();
        const newLounge = result.data;

        // Add to local state
        setLounges((prevLounges) => [...prevLounges, newLounge]);

        return newLounge;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create lounge';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const updateLounge = useCallback(
    async (id: string, data: UpdateLoungeData): Promise<Lounge> => {
      try {
        const response = await fetch(`/api/lounges/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update lounge');
        }

        const result = await response.json();
        const updatedLounge = result.data;

        // Update local state
        setLounges((prevLounges) =>
          prevLounges.map((lounge) =>
            lounge.id === id ? updatedLounge : lounge
          )
        );

        return updatedLounge;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update lounge';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const deleteLounge = useCallback(
    async (id: string): Promise<void> => {
      try {
        const response = await fetch(`/api/lounges/${id}`, {
          method: 'DELETE',
          headers: {},
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete lounge');
        }

        // Remove from local state
        setLounges((prevLounges) =>
          prevLounges.filter((lounge) => lounge.id !== id)
        );

        toast.success('Lounge deleted successfully');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete lounge';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const refreshLounges = useCallback(() => {
    // Reset the fetching ref to allow a new fetch
    isFetchingRef.current = false;
    // Trigger a re-render by updating state
    setLounges((prev) => [...prev]);
  }, []);

  return {
    lounges,
    loading,
    error,
    createLounge,
    updateLounge,
    deleteLounge,
    refreshLounges,
  };
}
