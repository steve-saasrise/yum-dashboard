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
}

export function LinkedInContentDisplay({
  content,
  description,
  className,
  truncateAt = 280, // LinkedIn typically shows about 280 characters before truncating
}: LinkedInContentDisplayProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  // Use content body if available, otherwise fall back to description
  const displayText = content || description || '';

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
