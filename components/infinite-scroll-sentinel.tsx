'use client';

import React, { useEffect, useRef, useCallback } from 'react';
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
  const lastLoadTime = useRef(0);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  // Determine optimal rootMargin based on connection speed
  const getRootMargin = () => {
    if (typeof window !== 'undefined' && 'connection' in navigator) {
      const connection = (
        navigator as Navigator & { connection?: { effectiveType?: string } }
      ).connection;
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

  // Use IntersectionObserver with fallback for Safari iOS
  const { ref, inView, entry } = useInView({
    threshold: 0,
    rootMargin: getRootMargin(),
    // Force root to be null for better Safari compatibility
    root: null,
  });

  // Debounced load more to prevent multiple rapid calls
  const loadMoreDebounced = useCallback(() => {
    const now = Date.now();
    if (now - lastLoadTime.current < 500) {
      return; // Prevent loading if called within 500ms
    }
    lastLoadTime.current = now;
    onLoadMore();
  }, [onLoadMore]);

  // Safari iOS fallback check
  const checkSafariVisibility = useCallback(() => {
    if (!elementRef.current || loading || !hasMore) return;

    const element = elementRef.current;
    const rect = element.getBoundingClientRect();

    // Check if element is near viewport
    const viewportHeight = window.innerHeight;
    const threshold = 800; // Load when within 800px of viewport

    if (rect.top <= viewportHeight + threshold && rect.bottom >= -threshold) {
      loadMoreDebounced();
    }
  }, [loading, hasMore, loadMoreDebounced]);

  // Main effect for triggering loads
  useEffect(() => {
    // Clear any existing timeout
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }

    if (inView && !loading && hasMore) {
      loadMoreDebounced();
    } else if (!loading && hasMore) {
      // Safari iOS fallback - check visibility after a delay
      checkTimeoutRef.current = setTimeout(() => {
        checkSafariVisibility();
      }, 100);
    }

    return () => {
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }
    };
  }, [inView, loading, hasMore, loadMoreDebounced, checkSafariVisibility]);

  // Additional Safari iOS scroll listener as last resort
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Only add scroll listener on iOS devices
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isIOS) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          checkSafariVisibility();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    checkSafariVisibility();

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [checkSafariVisibility]);

  if (!hasMore) return null;

  return (
    <div 
      ref={(node) => {
        // Set both refs
        elementRef.current = node;
        ref(node);
      }} 
      className="flex justify-center py-8"
    >
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Loading more content...
        </div>
      )}
    </div>
  );
}
