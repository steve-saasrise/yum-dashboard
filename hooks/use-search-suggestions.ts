'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';

export interface CreatorSuggestion {
  id: string;
  display_name: string;
  platform: string;
  avatar_url?: string;
  handle?: string;
}

export interface ContentSuggestion {
  id: string;
  title: string;
  creator_name: string;
  platform: string;
  published_at: string;
}

export interface SearchSuggestions {
  creators: CreatorSuggestion[];
  content: ContentSuggestion[];
  isLoading: boolean;
}

export function useSearchSuggestions(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<SearchSuggestions>({
    creators: [],
    content: [],
    isLoading: false,
  });

  const debouncedQuery = useDebounce(query, 300);

  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions({ creators: [], content: [], isLoading: false });
      return;
    }

    setSuggestions((prev) => ({ ...prev, isLoading: true }));

    try {
      // Fetch both creators and content in parallel
      const [creatorsRes, contentRes] = await Promise.all([
        fetch(`/api/creators?search=${encodeURIComponent(searchQuery)}&limit=5`),
        fetch(`/api/content?search=${encodeURIComponent(searchQuery)}&limit=5&sort_by=published_at&sort_order=desc`)
      ]);

      let creators: CreatorSuggestion[] = [];
      let content: ContentSuggestion[] = [];

      if (creatorsRes.ok) {
        const creatorsData = await creatorsRes.json();
        creators = (creatorsData.data?.creators || []).map((c: any) => ({
          id: c.id,
          display_name: c.display_name,
          platform: c.platform,
          avatar_url: c.avatar_url,
          handle: c.handle,
        }));
      }

      if (contentRes.ok) {
        const contentData = await contentRes.json();
        content = (contentData.data || []).map((item: any) => ({
          id: item.id,
          title: item.title,
          creator_name: item.creator?.display_name || item.creator?.name || 'Unknown',
          platform: item.platform,
          published_at: item.published_at,
        }));
      }

      setSuggestions({
        creators,
        content,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      setSuggestions({
        creators: [],
        content: [],
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSuggestions({ creators: [], content: [], isLoading: false });
      return;
    }

    fetchSuggestions(debouncedQuery);
  }, [debouncedQuery, enabled, fetchSuggestions]);

  return suggestions;
}