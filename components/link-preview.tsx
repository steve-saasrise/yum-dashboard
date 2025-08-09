'use client';

import React from 'react';
import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { useLinkPreview } from '@/hooks/use-link-preview';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface LinkPreviewProps {
  url: string;
  className?: string;
  lazyLoad?: boolean;
}

export function LinkPreview({
  url,
  className,
  lazyLoad = true,
}: LinkPreviewProps) {
  const { data, isLoading, error } = useLinkPreview(url);

  if (isLoading) {
    return (
      <div className={cn('border rounded-lg p-3 space-y-2', className)}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    );
  }

  if (error || !data) {
    // Fallback to simple link if we can't fetch metadata
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline',
          className
        )}
      >
        <span className="truncate max-w-[300px]">{url}</span>
        <ExternalLink className="h-3 w-3 flex-shrink-0" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block border rounded-lg overflow-hidden hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        className
      )}
    >
      <div className="flex">
        {data.image && (
          <div className="relative w-48 h-32 flex-shrink-0 bg-gray-100 dark:bg-gray-800">
            <Image
              src={data.image}
              alt={data.title || 'Link preview'}
              fill
              className="object-cover"
              sizes="192px"
              loading={lazyLoad ? 'lazy' : 'eager'}
              unoptimized
            />
          </div>
        )}
        <div className="flex-1 p-3 min-w-0">
          <div className="flex items-start gap-2">
            {data.favicon && (
              <Image
                src={data.favicon}
                alt=""
                width={16}
                height={16}
                className="mt-0.5 flex-shrink-0"
                unoptimized
              />
            )}
            <div className="flex-1 min-w-0">
              {data.title && (
                <h4 className="font-medium text-sm line-clamp-1 text-gray-900 dark:text-white">
                  {data.title}
                </h4>
              )}
              {data.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                  {data.description}
                </p>
              )}
              <div className="flex items-center gap-1 mt-1">
                {data.siteName && (
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    {data.siteName}
                  </span>
                )}
                <ExternalLink className="h-3 w-3 text-gray-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}
