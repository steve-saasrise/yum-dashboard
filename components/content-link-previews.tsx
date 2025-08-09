'use client';

import React from 'react';
import { LinkPreview } from './link-preview';
import { extractUrlsFromContent } from '@/lib/url-utils';

interface ContentLinkPreviewsProps {
  description?: string | null;
  contentBody?: string | null;
  className?: string;
  maxPreviews?: number;
  platform?: string;
}

export function ContentLinkPreviews({
  description,
  contentBody,
  className,
  maxPreviews = 3,
  platform,
}: ContentLinkPreviewsProps) {
  const urls = extractUrlsFromContent(description, contentBody, platform);

  if (urls.length === 0) {
    return null;
  }

  // Limit the number of previews to avoid cluttering the UI
  const urlsToShow = urls.slice(0, maxPreviews);

  return (
    <div className={className}>
      <div className="space-y-2">
        {urlsToShow.map((url, index) => (
          <LinkPreview key={`${url}-${index}`} url={url} lazyLoad={true} />
        ))}
      </div>
    </div>
  );
}
