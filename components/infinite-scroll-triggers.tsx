'use client';

import React, { useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface InfiniteScrollTriggersProps {
  onPrefetch: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function InfiniteScrollTriggers({
  onPrefetch,
  onLoadMore,
  hasMore,
  isLoading,
}: InfiniteScrollTriggersProps) {
  const { ref: prefetchRef, inView: shouldPrefetch } = useInView({
    threshold: 0,
    rootMargin: '800px',
  });

  const { ref: loadMoreRef, inView: shouldLoadMore } = useInView({
    threshold: 0,
    rootMargin: '200px',
  });

  useEffect(() => {
    if (shouldPrefetch && hasMore && !isLoading) {
      onPrefetch();
    }
  }, [shouldPrefetch, hasMore, isLoading, onPrefetch]);

  useEffect(() => {
    if (shouldLoadMore && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [shouldLoadMore, hasMore, isLoading, onLoadMore]);

  return (
    <>
      <div ref={prefetchRef} className="h-px" />
      <div ref={loadMoreRef} className="h-px" />
    </>
  );
}
