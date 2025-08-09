import React from 'react';
import { ExternalLink } from 'lucide-react';
import Image from 'next/image';

interface LinkPreviewProps {
  linkUrl: string;
  linkTitle?: string;
  linkDescription?: string;
  linkDomain?: string;
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  displayUrl?: string;
  className?: string;
}

export function LinkPreviewCard({
  linkUrl,
  linkTitle,
  linkDescription,
  linkDomain,
  imageUrl,
  imageWidth,
  imageHeight,
  displayUrl,
  className = '',
}: LinkPreviewProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.open(linkUrl, '_blank', 'noopener,noreferrer');
  };

  // Extract domain from URL if not provided
  const domain =
    linkDomain ||
    displayUrl ||
    (() => {
      try {
        const url = new URL(linkUrl);
        return url.hostname.replace('www.', '');
      } catch {
        return linkUrl;
      }
    })();

  return (
    <div
      className={`border rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-gray-800 ${className}`}
      onClick={handleClick}
    >
      {imageUrl && (
        <div
          className="relative w-full"
          style={{
            aspectRatio:
              imageWidth && imageHeight
                ? `${imageWidth}/${imageHeight}`
                : '2/1',
            maxHeight: '200px',
          }}
        >
          <Image
            src={imageUrl}
            alt={linkTitle || 'Link preview'}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-3">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {linkTitle && (
              <h4 className="font-semibold text-sm line-clamp-2 text-gray-900 dark:text-white mb-1">
                {linkTitle}
              </h4>
            )}
            {linkDescription && (
              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                {linkDescription}
              </p>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
              <ExternalLink className="h-3 w-3" />
              <span className="truncate">{domain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
