'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface XVideoEmbedProps {
  videoUrl: string;
  thumbnailUrl?: string;
  title?: string;
  className?: string;
  autoplay?: boolean;
  lazyLoad?: boolean;
  width?: number;
  height?: number;
  duration?: number;
}

export function XVideoEmbed({
  videoUrl,
  thumbnailUrl,
  title = 'X video',
  className,
  autoplay = false,
  lazyLoad = true,
  width,
  height,
  duration,
}: XVideoEmbedProps) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [showVideo, setShowVideo] = React.useState(!lazyLoad || autoplay);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // Use Intersection Observer for lazy loading
  React.useEffect(() => {
    if (!lazyLoad || showVideo) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShowVideo(true);
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
  }, [lazyLoad, showVideo]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handlePlayClick = () => {
    setShowVideo(true);
    // Auto-play when clicked
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(console.error);
      }
    }, 100);
  };

  // Format duration for display
  const formatDuration = (ms?: number) => {
    if (!ms) return null;
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Calculate aspect ratio - constrain tall videos to 16:9 max
  let aspectRatio = '16/9';
  if (width && height) {
    // If video is taller than 16:9 (portrait), cap it at 16:9
    const videoAspectRatio = width / height;
    if (videoAspectRatio < 16 / 9) {
      aspectRatio = '16/9';
    } else {
      aspectRatio = `${width}/${height}`;
    }
  }

  // If lazy loading and not yet triggered, show thumbnail with play button
  if (lazyLoad && !showVideo) {
    return (
      <div
        ref={containerRef}
        className={cn(
          'relative w-full bg-black rounded-lg overflow-hidden cursor-pointer group',
          className
        )}
        style={{ aspectRatio }}
        onClick={handlePlayClick}
      >
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className={cn(
              'w-full h-full',
              width && height && width < height
                ? 'object-contain'
                : 'object-cover'
            )}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center">
            <Play className="h-12 w-12 text-gray-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          <Button
            size="lg"
            variant="ghost"
            className="rounded-full bg-white/90 hover:bg-white text-black p-4 h-auto"
            aria-label="Play video"
          >
            <Play className="h-8 w-8 ml-1" fill="currentColor" />
          </Button>
        </div>
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Video
        </div>
        {duration && (
          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {formatDuration(duration)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full bg-black rounded-lg overflow-hidden',
        className
      )}
      style={{ aspectRatio }}
    >
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white p-4">
          <AlertCircle className="h-12 w-12 mb-4 text-red-500" />
          <p className="text-center mb-4">Unable to load video</p>
          <Button
            variant="outline"
            className="text-white border-white hover:bg-white/10"
            onClick={() => window.open(videoUrl, '_blank')}
          >
            Open Video
          </Button>
        </div>
      ) : (
        <>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            poster={thumbnailUrl}
            className={cn(
              'w-full h-full',
              width && height && width < height
                ? 'object-contain'
                : 'object-cover'
            )}
            controls
            playsInline
            muted
            preload="metadata"
            autoPlay={autoplay}
            onLoadedData={handleLoad}
            onError={handleError}
            title={title}
          >
            Your browser does not support the video tag.
          </video>
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded flex items-center gap-1 pointer-events-none">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Video
          </div>
        </>
      )}
    </div>
  );
}
