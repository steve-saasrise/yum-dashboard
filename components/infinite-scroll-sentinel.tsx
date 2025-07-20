'use client';

import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface InfiniteScrollSentinelProps {
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
}

export function InfiniteScrollSentinel({
  onLoadMore,
  hasMore,
  loading,
}: InfiniteScrollSentinelProps) {
  // Determine optimal rootMargin based on connection speed
  const getRootMargin = () => {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
      switch (connection?.effectiveType) {
        case '4g':
          return '800px'; // Load very early on fast connections
        case '3g':
          return '600px';
        case '2g':
          return '400px';
        default:
          return '600px';
      }
    }
    return '600px'; // Default to 600px (about 1.5 screens ahead)
  };

  const { ref, inView } = useInView({
    threshold: 0,
    rootMargin: getRootMargin(),
  });

  useEffect(() => {
    // Trigger immediately when in view and conditions are met
    if (inView && !loading && hasMore) {
      onLoadMore();
    }
  }, [inView, loading, hasMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="flex justify-center py-8">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading more content...
        </div>
      )}
    </div>
  );
}
