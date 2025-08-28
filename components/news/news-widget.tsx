'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Newspaper,
  Sparkles,
} from 'lucide-react';
import { NewsHeadlineItem } from './news-headline-item';
import { AISummaryDisplay } from './ai-summary-display';
import { cn } from '@/lib/utils';
import type { NewsSummaryResponse } from '@/app/api/content/news-summary/route';

export interface NewsItemData {
  id: string;
  title: string;
  url: string;
  published_at: string;
  creator: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  engagement_metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
  };
}

interface NewsWidgetProps {
  className?: string;
  initialLimit?: number;
  expandedLimit?: number;
  loungeId?: string;
  showAISummary?: boolean;
}

export function NewsWidget({
  className,
  initialLimit = 7,
  expandedLimit = 15,
  loungeId,
  showAISummary = true,
}: NewsWidgetProps) {
  const [news, setNews] = useState<NewsItemData[]>([]);
  const [aiSummary, setAiSummary] = useState<NewsSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchNews = async () => {
    try {
      setRefreshing(true);

      // Fetch AI summary if enabled
      if (showAISummary) {
        try {
          const summaryUrl = loungeId
            ? `/api/content/news-summary?loungeId=${loungeId}`
            : '/api/content/news-summary';
          const summaryResponse = await fetch(summaryUrl);
          if (summaryResponse.ok) {
            const summaryData = await summaryResponse.json();
            setAiSummary(summaryData);
          }
        } catch (summaryError) {
          console.error('Error fetching AI summary:', summaryError);
        }
      }

      // Fetch regular news as fallback
      const response = await fetch('/api/content/news?limit=20&hours_ago=24');
      if (!response.ok) throw new Error('Failed to fetch news');

      const data = await response.json();
      setNews(data.news || []);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNews();

    // Auto-refresh every 30 minutes
    const interval = setInterval(fetchNews, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const displayedNews = expanded
    ? news.slice(0, expandedLimit)
    : news.slice(0, initialLimit);
  const hasMore = news.length > initialLimit;

  if (loading) {
    return (
      <Card className={cn('h-fit', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Daily News
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (news.length === 0) {
    return (
      <Card className={cn('h-fit', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Daily News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No news available at the moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('h-fit', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Daily News
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={fetchNews}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn('h-3 w-3', refreshing && 'animate-spin')}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-2">
        {/* Display AI Summary if available */}
        {showAISummary && aiSummary?.summary && (
          <div className="pb-2 border-b">
            <AISummaryDisplay
              bullets={aiSummary.summary.bullets}
              compact={true}
            />
          </div>
        )}

        {/* Display news items or fallback content */}
        <div className="space-y-1">
          {displayedNews.map((item) => (
            <NewsHeadlineItem key={item.id} item={item} />
          ))}
        </div>

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-8 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show more ({news.length - initialLimit} more)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
