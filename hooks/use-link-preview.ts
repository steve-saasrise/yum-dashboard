import { useState, useEffect } from 'react';

export interface LinkPreviewData {
  title: string | null;
  description: string | null;
  favicon: string | null;
  image: string | null;
  siteName: string | null;
  url: string;
}

interface UseLinkPreviewResult {
  data: LinkPreviewData | null;
  isLoading: boolean;
  error: Error | null;
}

const cache = new Map<string, LinkPreviewData>();

export function useLinkPreview(url: string | null): UseLinkPreviewResult {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!url) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Check cache first
    const cached = cache.get(url);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    const fetchMetadata = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/opengraph?url=${encodeURIComponent(url)}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch metadata: ${response.statusText}`);
        }

        const metadata = await response.json();

        // Cache the result
        cache.set(url, metadata);
        setData(metadata);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetadata();
  }, [url]);

  return { data, isLoading, error };
}
