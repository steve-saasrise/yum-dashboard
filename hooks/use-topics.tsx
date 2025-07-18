'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from './use-auth';
import type {
  Topic,
  CreateTopicData,
  UpdateTopicData,
  TopicFilters,
  UseTopicsReturn,
} from '@/types/topic';

export function useTopics(filters?: TopicFilters): UseTopicsReturn {
  const [topics, setTopics] = useState<Topic[]>([]);
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

    const fetchTopics = async () => {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        const currentFilters = filtersRef.current;

        if (currentFilters?.search)
          params.append('search', currentFilters.search);
        if (currentFilters?.parent_topic_id)
          params.append('parent_topic_id', currentFilters.parent_topic_id);
        if (currentFilters?.is_system_topic !== undefined) {
          params.append(
            'is_system_topic',
            String(currentFilters.is_system_topic)
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

        const response = await fetch(`/api/topics?${params}`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch topics');
        }

        const result = await response.json();
        setTopics(result.data.topics);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load topics';
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
        isFetchingRef.current = false;
      }
    };

    fetchTopics();
  }, [session]); // Only depend on session, not filters

  const createTopic = useCallback(
    async (data: CreateTopicData): Promise<Topic> => {
      try {
        const response = await fetch('/api/topics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create topic');
        }

        const result = await response.json();
        const newTopic = result.data;

        // Add to local state
        setTopics((prevTopics) => [...prevTopics, newTopic]);

        return newTopic;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to create topic';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const updateTopic = useCallback(
    async (id: string, data: UpdateTopicData): Promise<Topic> => {
      try {
        const response = await fetch(`/api/topics/${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update topic');
        }

        const result = await response.json();
        const updatedTopic = result.data;

        // Update local state
        setTopics((prevTopics) =>
          prevTopics.map((topic) => (topic.id === id ? updatedTopic : topic))
        );

        return updatedTopic;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update topic';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const deleteTopic = useCallback(
    async (id: string): Promise<void> => {
      try {
        const response = await fetch(`/api/topics/${id}`, {
          method: 'DELETE',
          headers: {},
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete topic');
        }

        // Remove from local state
        setTopics((prevTopics) =>
          prevTopics.filter((topic) => topic.id !== id)
        );

        toast.success('Topic deleted successfully');
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to delete topic';
        toast.error(message);
        throw err;
      }
    },
    [session]
  );

  const refreshTopics = useCallback(() => {
    // Reset the fetching ref to allow a new fetch
    isFetchingRef.current = false;
    // Trigger a re-render by updating state
    setTopics((prev) => [...prev]);
  }, []);

  return {
    topics,
    loading,
    error,
    createTopic,
    updateTopic,
    deleteTopic,
    refreshTopics,
  };
}
