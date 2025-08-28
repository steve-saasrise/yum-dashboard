'use client';

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ExternalLink } from 'lucide-react';
import type { NewsItemData } from './news-widget';

interface NewsHeadlineItemProps {
  item: NewsItemData;
}

export function NewsHeadlineItem({ item }: NewsHeadlineItemProps) {
  const timeAgo = formatDistanceToNow(new Date(item.published_at), {
    addSuffix: false,
  }).replace('about ', '');

  // Format engagement metrics for display
  const formatEngagement = () => {
    if (!item.engagement_metrics) return null;

    const { views, likes, comments } = item.engagement_metrics;
    const parts = [];

    if (views && views > 0) {
      const formatted =
        views > 999 ? `${(views / 1000).toFixed(1)}k` : views.toString();
      parts.push(`${formatted} readers`);
    }

    if (likes && likes > 0) {
      parts.push(`${likes} likes`);
    }

    if (comments && comments > 0) {
      parts.push(`${comments} comments`);
    }

    return parts.length > 0 ? parts[0] : null; // Only show first metric like LinkedIn
  };

  const engagement = formatEngagement();

  return (
    <div className="group py-3 border-b last:border-0 cursor-pointer hover:bg-accent/50 -mx-2 px-2 rounded transition-colors">
      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block space-y-1"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{timeAgo} ago</span>
          {engagement && (
            <>
              <span>•</span>
              <span>{engagement}</span>
            </>
          )}
        </div>
      </a>
    </div>
  );
}
