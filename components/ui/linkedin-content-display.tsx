'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface LinkedInContentDisplayProps {
  content?: string | null;
  description?: string | null;
  className?: string;
  truncateAt?: number; // Number of characters to truncate at
  engagementMetrics?: {
    likes?: number;
    views?: number;
    shares?: number;
    comments?: number;
  };
}

export function LinkedInContentDisplay({
  content,
  description,
  className,
  truncateAt = 280, // LinkedIn typically shows about 280 characters before truncating
  engagementMetrics,
}: LinkedInContentDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Use content body if available, otherwise fall back to description
  const rawText = content || description || '';

  // Clean up HTML entities and tags for proper display
  const displayText = rawText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x2019;/g, "'")
    .replace(/&#x201C;/g, '"')
    .replace(/&#x201D;/g, '"')
    .replace(/&#x2014;/g, '—')
    .replace(/&#x[0-9A-F]+;/gi, (match) => {
      const code = parseInt(match.slice(3, -1), 16);
      return String.fromCharCode(code);
    })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]*>/g, '')
    .trim();

  // Check if text needs truncation
  const needsTruncation = displayText.length > truncateAt;

  // Get the text to display based on expansion state
  const getDisplayText = () => {
    if (!needsTruncation || isExpanded) {
      return displayText;
    }

    // Find the last space before truncation point to avoid cutting words
    const truncatePoint = displayText.lastIndexOf(' ', truncateAt);
    const cutoffPoint = truncatePoint > 0 ? truncatePoint : truncateAt;

    return displayText.slice(0, cutoffPoint) + '...';
  };

  if (!displayText) {
    return (
      <p className={cn('text-sm text-muted-foreground', className)}>
        No content available
      </p>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
        {getDisplayText()}
      </div>

      {engagementMetrics && (
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          {engagementMetrics.likes && engagementMetrics.likes > 0 && (
            <span>{engagementMetrics.likes} likes</span>
          )}
          {engagementMetrics.comments && engagementMetrics.comments > 0 && (
            <span>{engagementMetrics.comments} comments</span>
          )}
          {engagementMetrics.shares && engagementMetrics.shares > 0 && (
            <span>{engagementMetrics.shares} shares</span>
          )}
        </div>
      )}

      {needsTruncation && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-auto p-0 font-medium text-primary hover:text-primary/80 hover:bg-transparent"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="ml-1 h-3 w-3" />
            </>
          ) : (
            <>
              Read more <ChevronDown className="ml-1 h-3 w-3" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
