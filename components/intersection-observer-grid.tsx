'use client';

import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ContentCard } from './daily-news-dashboard';
import { ContentListItem } from './content-list-item';
import { ContentSkeletonGrid } from './enhanced-content-skeleton';
import type { ContentWithCreator } from '@/types/content';
import type { Creator } from '@/types/creator';

interface IntersectionObserverGridProps {
  items: ContentWithCreator[];
  creators: Creator[];
  view: 'grid' | 'list';
  columns: number;
  hasMore: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  saveContent: (id: string) => Promise<void>;
  unsaveContent: (id: string) => Promise<void>;
  deleteContent: (id: string) => Promise<void>;
  undeleteContent: (id: string) => Promise<void>;
  canManageCreators: boolean;
}

// Maximum items to keep in DOM (Twitter uses ~200-300)
const MAX_ITEMS_IN_DOM = 200;

export function IntersectionObserverGrid({
  items,
  creators,
  view,
  columns,
  hasMore,
  isFetchingNextPage,
  fetchNextPage,
  saveContent,
  unsaveContent,
  deleteContent,
  undeleteContent,
  canManageCreators,
}: IntersectionObserverGridProps) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const earlyTriggerRef = useRef<HTMLDivElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const hasFetchedRef = useRef(false);

  // Limit items to prevent memory issues with very large datasets
  const displayItems = items.slice(-MAX_ITEMS_IN_DOM);

  // Common item renderer
  const renderItem = useCallback(
    (item: ContentWithCreator) => ({
      id: item.id,
      title: item.title || '',
      description: item.description,
      ai_summary: item.ai_summary,
      ai_summary_short: item.ai_summary_short,
      ai_summary_long: item.ai_summary_long,
      summary_generated_at: item.summary_generated_at,
      summary_model: item.summary_model,
      summary_status: item.summary_status,
      summary_error_message: item.summary_error_message,
      url: item.url,
      platform: item.platform,
      creator_id: item.creator_id,
      creator: item.creator,
      published_at: item.published_at || item.created_at,
      is_saved: item.is_saved,
      is_deleted: item.is_deleted,
      topics: item.topics,
    }),
    []
  );

  // Set up intersection observers for smooth loading
  useEffect(() => {
    // Main observer for the bottom trigger
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        setIsIntersecting(isVisible);

        // Show skeletons immediately when trigger becomes visible
        if (isVisible && hasMore && !isFetchingNextPage) {
          setShowSkeletons(true);
        }
      },
      {
        threshold: 0,
        rootMargin: '300% 0px', // Trigger 3 viewports before reaching the end
      }
    );

    // Early trigger observer - placed higher up in the content
    const earlyObserver = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMore &&
          !isFetchingNextPage &&
          !hasFetchedRef.current
        ) {
          // Start loading early without showing skeletons yet
          hasFetchedRef.current = true;
          fetchNextPage();
        }
      },
      {
        threshold: 0,
        rootMargin: '400% 0px', // Trigger 4 viewports before reaching the end
      }
    );

    const currentTarget = observerTarget.current;
    const earlyTrigger = earlyTriggerRef.current;

    if (currentTarget) {
      observer.observe(currentTarget);
    }
    if (earlyTrigger) {
      earlyObserver.observe(earlyTrigger);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
      if (earlyTrigger) {
        earlyObserver.unobserve(earlyTrigger);
      }
    };
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  // Trigger loading when intersecting
  useEffect(() => {
    if (
      isIntersecting &&
      hasMore &&
      !isFetchingNextPage &&
      !hasFetchedRef.current
    ) {
      hasFetchedRef.current = true;
      fetchNextPage();
    }
  }, [isIntersecting, hasMore, isFetchingNextPage, fetchNextPage]);

  // Reset fetch flag when intersection changes
  useEffect(() => {
    if (!isIntersecting) {
      hasFetchedRef.current = false;
    }
  }, [isIntersecting]);

  // Keep skeletons visible while fetching
  useEffect(() => {
    if (!isFetchingNextPage && showSkeletons) {
      // Add small delay before hiding skeletons to prevent flicker
      const timeout = setTimeout(() => {
        setShowSkeletons(false);
      }, 200);
      return () => clearTimeout(timeout);
    }
  }, [isFetchingNextPage, showSkeletons]);

  if (view === 'grid') {
    return (
      <div className="space-y-6">
        <div
          className={`grid gap-6 ${
            columns === 1
              ? 'grid-cols-1'
              : columns === 2
                ? 'grid-cols-1 lg:grid-cols-2'
                : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
          }`}
        >
          {displayItems.map((item) => (
            <ContentCard
              key={item.id}
              item={renderItem(item)}
              creators={creators}
              onSave={saveContent}
              onUnsave={unsaveContent}
              onDelete={deleteContent}
              onUndelete={undeleteContent}
              canDelete={canManageCreators}
            />
          ))}
        </div>

        {/* Early loading trigger - invisible element placed before skeletons */}
        {hasMore && displayItems.length >= 20 && (
          <div ref={earlyTriggerRef} className="h-0 w-0" aria-hidden="true" />
        )}

        {/* Skeleton placeholders for smooth loading */}
        {showSkeletons && <ContentSkeletonGrid count={6} view="grid" />}

        {/* Loading trigger */}
        {hasMore && (
          <div
            ref={observerTarget}
            className="h-20" // Visible height for trigger
          />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {displayItems.map((item) => (
        <ContentListItem
          key={item.id}
          item={renderItem(item)}
          creators={creators}
          onSave={saveContent}
          onUnsave={unsaveContent}
          onDelete={deleteContent}
          onUndelete={undeleteContent}
          canDelete={canManageCreators}
        />
      ))}

      {/* Early loading trigger for list view */}
      {hasMore && displayItems.length >= 20 && (
        <div ref={earlyTriggerRef} className="h-0 w-0" aria-hidden="true" />
      )}

      {/* Skeleton placeholders for smooth loading */}
      {showSkeletons && <ContentSkeletonGrid count={4} view="list" />}

      {/* Loading trigger */}
      {hasMore && (
        <div
          ref={observerTarget}
          className="h-20" // Visible height for trigger
        />
      )}
    </div>
  );
}
