'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Newspaper } from 'lucide-react';
import { NewsHeadlineItem } from './news-headline-item';
import { cn } from '@/lib/utils';
import type { NewsItemData } from './news-widget';

interface MobileNewsSectionProps {
  className?: string;
  initialLimit?: number;
}

export function MobileNewsSection({
  className,
  initialLimit = 3,
}: MobileNewsSectionProps) {
  const [news, setNews] = useState<NewsItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchNews = async () => {
      try {
        const response = await fetch('/api/content/news?limit=10&hours_ago=24');
        if (!response.ok) throw new Error('Failed to fetch news');

        const data = await response.json();
        setNews(data.news || []);
      } catch (error) {
        console.error('Error fetching news:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const displayedNews = expanded ? news : news.slice(0, initialLimit);
  const hasMore = news.length > initialLimit;

  if (loading) {
    return (
      <Card className={cn('mb-4', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Top News
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
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
    return null; // Hide section if no news
  }

  return (
    <Card className={cn('mb-4', className)}>
      <CardHeader
        className="pb-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Newspaper className="h-4 w-4" />
            Top News
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>

      {(expanded || news.length <= initialLimit) && (
        <CardContent className="space-y-1 pb-2">
          {displayedNews.map((item) => (
            <NewsHeadlineItem key={item.id} item={item} />
          ))}

          {hasMore && !expanded && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 h-8 text-xs"
              onClick={() => setExpanded(true)}
            >
              <ChevronDown className="h-3 w-3 mr-1" />
              Show {news.length - initialLimit} more stories
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
