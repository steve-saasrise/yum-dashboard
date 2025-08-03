'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface EnhancedContentSkeletonProps {
  view?: 'grid' | 'list';
  className?: string;
}

export function EnhancedContentSkeleton({
  view = 'grid',
  className,
}: EnhancedContentSkeletonProps) {
  if (view === 'list') {
    return (
      <div
        className={cn(
          'flex gap-4 p-4 rounded-lg border bg-card animate-in fade-in-50 duration-500',
          className
        )}
      >
        {/* Platform icon */}
        <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />

        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'space-y-3 p-4 rounded-lg border bg-card animate-in fade-in-50 duration-500',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded" />
      </div>

      {/* Title */}
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-4/5" />

      {/* Description */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </div>
    </div>
  );
}

// Loading state component for multiple skeletons
export function ContentSkeletonGrid({
  count = 6,
  view = 'grid',
}: {
  count?: number;
  view?: 'grid' | 'list';
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skeleton-${i}`}
          style={{
            animationDelay: `${i * 50}ms`,
          }}
        >
          <EnhancedContentSkeleton view={view} />
        </div>
      ))}
    </>
  );
}
