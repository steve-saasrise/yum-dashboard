'use client';

import * as React from 'react';
import { Play, Linkedin, Youtube } from 'lucide-react';
import { Icons } from '@/components/icons';

interface VideoThumbnailProps {
  thumbnailUrl?: string;
  videoUrl: string;
  platform: string;
  title?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function VideoThumbnail({
  thumbnailUrl,
  videoUrl,
  platform,
  title,
  width,
  height,
  className = '',
}: VideoThumbnailProps) {
  const getPlatformIcon = () => {
    switch (platform?.toLowerCase()) {
      case 'linkedin':
        return <Linkedin className="h-5 w-5" />;
      case 'youtube':
        return <Youtube className="h-5 w-5" />;
      case 'x':
      case 'twitter':
        return <Icons.x className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const platformColors = {
    linkedin: 'bg-blue-600 hover:bg-blue-700',
    youtube: 'bg-red-600 hover:bg-red-700',
    x: 'bg-black hover:bg-gray-900',
    twitter: 'bg-black hover:bg-gray-900',
  };

  const platformColor =
    platformColors[platform?.toLowerCase() as keyof typeof platformColors] ||
    'bg-gray-600 hover:bg-gray-700';

  return (
    <a
      href={videoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`relative block overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800 group ${className}`}
      title={title || 'Watch video'}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={title || 'Video thumbnail'}
          className="w-full h-full object-cover"
          style={{
            maxHeight: height ? `${height}px` : undefined,
            aspectRatio: width && height ? `${width}/${height}` : '16/9',
          }}
        />
      ) : (
        <div
          className="w-full bg-gradient-to-br from-blue-50 to-blue-100 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center"
          style={{
            aspectRatio: width && height ? `${width}/${height}` : '16/9',
            minHeight: '200px',
          }}
        >
          <div className="text-center">
            {getPlatformIcon() && (
              <div className="text-gray-400 dark:text-gray-500 mb-2">
                <div className="h-12 w-12 mx-auto">
                  {getPlatformIcon()}
                </div>
              </div>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">Video</p>
          </div>
        </div>
      )}

      {/* Overlay with play button */}
      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center transition-opacity group-hover:bg-opacity-50">
        <div
          className={`${platformColor} rounded-full p-4 shadow-lg transform transition-transform group-hover:scale-110`}
        >
          <Play className="h-8 w-8 text-white fill-white" />
        </div>
      </div>

      {/* Platform indicator */}
      {getPlatformIcon() && (
        <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded-full p-2">
          {getPlatformIcon()}
        </div>
      )}

      {/* Duration badge (if provided in future) */}
      {/* Can add duration display here if available in metadata */}
    </a>
  );
}
