'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = useAuth();
  const { session } = state;

  const fetchTopics = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters?.search) params.append('search', filters.search);
      if (filters?.parent_topic_id)
        params.append('parent_topic_id', filters.parent_topic_id);
      if (filters?.is_system_topic !== undefined) {
        params.append('is_system_topic', String(filters.is_system_topic));
      }
      if (filters?.has_creators !== undefined) {
        params.append('has_creators', String(filters.has_creators));
      }
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order);
      if (filters?.page) params.append('page', String(filters.page));
      if (filters?.limit) params.append('limit', String(filters.limit));

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
    }
  }, [filters, session]);

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
    fetchTopics();
  }, [fetchTopics]);

  // Fetch topics on mount
  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

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
