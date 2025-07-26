'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkles, Zap, FileText, Quote } from 'lucide-react';
import type { SummaryStatus } from '@/types/content';

interface AISummaryProps {
  shortSummary?: string | null;
  longSummary?: string | null;
  originalDescription?: string | null;
  summaryStatus?: SummaryStatus;
  summaryModel?: string | null;
  generatedAt?: string | null;
  className?: string;
  defaultMode?: 'short' | 'long' | 'original';
}

export function AISummary({
  shortSummary,
  longSummary,
  originalDescription,
  summaryStatus = 'pending',
  summaryModel,
  generatedAt,
  className,
  defaultMode = 'short',
}: AISummaryProps) {
  const [viewMode, setViewMode] = React.useState<'short' | 'long' | 'original'>(
    defaultMode
  );

  // Determine what content to show based on availability
  const hasShortSummary = shortSummary && shortSummary.trim().length > 0;
  const hasLongSummary = longSummary && longSummary.trim().length > 0;
  const hasOriginal =
    originalDescription && originalDescription.trim().length > 0;
  const hasSummary = hasShortSummary || hasLongSummary;

  // If no summaries are available, show original or pending state
  if (!hasSummary) {
    if (summaryStatus === 'processing') {
      return (
        <div
          className={cn(
            'text-sm text-muted-foreground animate-pulse',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span>Generating AI summary...</span>
          </div>
        </div>
      );
    }

    if (summaryStatus === 'error' || !hasOriginal) {
      return (
        <p
          className={cn(
            'text-sm text-muted-foreground line-clamp-3',
            className
          )}
        >
          {originalDescription || 'No description available'}
        </p>
      );
    }

    return (
      <p
        className={cn('text-sm text-muted-foreground line-clamp-3', className)}
      >
        {originalDescription}
      </p>
    );
  }

  // Determine which content to display based on view mode and availability
  const getDisplayContent = () => {
    if (viewMode === 'short' && hasShortSummary) {
      return shortSummary;
    }
    if (viewMode === 'long' && hasLongSummary) {
      return longSummary;
    }
    if (viewMode === 'original' && hasOriginal) {
      return originalDescription;
    }
    // Fallback to whatever is available
    return shortSummary || longSummary || originalDescription || '';
  };

  const displayContent = getDisplayContent();

  return (
    <div className={cn('space-y-2', className)}>
      {/* Summary Header with AI Badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6 px-2 gap-1">
            <Sparkles className="h-3 w-3" />
            <span className="text-xs">AI Summary</span>
          </Badge>
          {summaryModel && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="h-6 px-2 text-xs">
                    {summaryModel}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Generated{' '}
                    {generatedAt
                      ? new Date(generatedAt).toLocaleDateString()
                      : 'recently'}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1">
          {hasShortSummary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'short' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('short')}
                  >
                    <Zap className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Quick Summary (≤30 words)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasLongSummary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'long' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('long')}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Detailed Summary (≤100 words)</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {hasOriginal && hasSummary && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'original' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setViewMode('original')}
                  >
                    <Quote className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Original Description</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      {/* Content without collapsible */}
      <p className="text-sm text-muted-foreground">{displayContent}</p>
    </div>
  );
}

// Minimal version for list views
export function AISummaryCompact({
  shortSummary,
  originalDescription,
  className,
}: Pick<AISummaryProps, 'shortSummary' | 'originalDescription' | 'className'>) {
  const hasShortSummary = shortSummary && shortSummary.trim().length > 0;

  if (!hasShortSummary) {
    return (
      <p
        className={cn('text-sm text-muted-foreground line-clamp-2', className)}
      >
        {originalDescription || 'No description available'}
      </p>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="h-5 px-1.5 gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          <span className="text-xs">AI</span>
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {shortSummary}
      </p>
    </div>
  );
}
