'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface YouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
  lazyLoad?: boolean;
  thumbnailUrl?: string;
}

export function YouTubeEmbed({
  videoId,
  title = 'YouTube video',
  className,
  autoplay = false,
  lazyLoad = true,
  thumbnailUrl,
}: YouTubeEmbedProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [showEmbed, setShowEmbed] = React.useState(!lazyLoad);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Use Intersection Observer for lazy loading
  React.useEffect(() => {
    if (!lazyLoad || showEmbed) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShowEmbed(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [lazyLoad, showEmbed]);

  const embedUrl = React.useMemo(() => {
    const params = new URLSearchParams({
      rel: '0', // Don't show related videos from other channels
      modestbranding: '1', // Minimal YouTube branding
      ...(autoplay && { autoplay: '1' }),
    });

    // Use privacy-enhanced mode
    return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
  }, [videoId, autoplay]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handlePlayClick = () => {
    setShowEmbed(true);
  };

  // Get high-quality thumbnail
  const getThumbnailUrl = () => {
    if (thumbnailUrl) return thumbnailUrl;
    // YouTube provides multiple thumbnail resolutions
    // maxresdefault might not always be available, so we'll try hqdefault
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  };

  // If lazy loading and not yet triggered, show thumbnail with play button
  if (lazyLoad && !showEmbed) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full bg-black rounded-lg overflow-hidden cursor-pointer group',
          className
        )}
        style={{ aspectRatio: '16/9' }}
        onClick={handlePlayClick}
      >
        <img
          src={getThumbnailUrl()}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <Button
            size="lg"
            variant="ghost"
            className="rounded-full bg-red-600 hover:bg-red-700 text-white p-4 h-auto"
            aria-label="Play video"
          >
            <Play className="h-8 w-8 ml-1" fill="currentColor" />
          </Button>
        </div>
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
          YouTube
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full bg-black rounded-lg overflow-hidden', className)}
      style={{ aspectRatio: '16/9' }}
    >
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-4">
          <AlertCircle className="h-12 w-12 mb-4 text-red-500" />
          <p className="text-center mb-4">Unable to load video</p>
          <Button
            variant="outline"
            className="text-white border-white hover:bg-white/10"
            onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
          >
            Watch on YouTube
          </Button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 w-full h-full"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy"
          />
        </>
      )}
    </div>
  );
}