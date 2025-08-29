'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Newspaper, Sparkles, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NewsItem {
  text: string;
  sourceUrl?: string;
}

interface AINewsResponse {
  items: NewsItem[];
  topic: string;
  generatedAt: string;
}

interface NewsWidgetProps {
  className?: string;
  loungeId?: string;
}

export function NewsWidget({ className, loungeId }: NewsWidgetProps) {
  const [aiNews, setAiNews] = useState<AINewsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchNews = async () => {
    try {
      // Fetch AI-generated news
      const url = loungeId
        ? `/api/content/news-summary?loungeId=${loungeId}`
        : '/api/content/news-summary';

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAiNews(data);
      }
    } catch (error) {
      console.error('Error fetching AI news:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, [loungeId]);

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
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!aiNews || aiNews.items.length === 0) {
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
        <CardTitle className="flex items-center gap-2 text-base">
          <Newspaper className="h-4 w-4" />
          Daily News
          <Sparkles className="h-3 w-3 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        <div className="space-y-2">
          {aiNews.items.map((item, index) => (
            <div key={index} className="flex items-start gap-2">
              <span className="text-xs text-muted-foreground mt-0.5">•</span>
              <div className="flex-1">
                <p className="text-sm leading-relaxed">{item.text}</p>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-0.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Source
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            AI-generated summary • {aiNews.topic}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
