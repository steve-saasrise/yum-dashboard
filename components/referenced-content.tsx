'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icons } from '@/components/icons';
import {
  Quote,
  RefreshCw,
  Reply,
  CheckCircle,
  Video,
  Heart,
  MessageCircle,
} from 'lucide-react';
import type { ReferencedContent } from '@/types/content';

interface ReferencedContentProps {
  referenceType?: 'quote' | 'retweet' | 'reply';
  referencedContent?: ReferencedContent;
  platform?: string;
}

export const ReferencedContentDisplay: React.FC<ReferencedContentProps> = ({
  referenceType,
  referencedContent,
  platform,
}) => {
  if (!referenceType || !referencedContent) {
    return null;
  }

  const getReferenceIcon = () => {
    switch (referenceType) {
      case 'quote':
        return <Quote className="h-3 w-3" />;
      case 'retweet':
        return <RefreshCw className="h-3 w-3" />;
      case 'reply':
        return <Reply className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getReferenceLabel = () => {
    switch (referenceType) {
      case 'quote':
        return 'Quoted';
      case 'retweet':
        // Most platforms now use "Reposted" instead of "Retweeted"
        return platform === 'linkedin' ||
          platform === 'threads' ||
          platform === 'x'
          ? 'Reposted'
          : 'Retweeted';
      case 'reply':
        return 'Replying to';
      default:
        return '';
    }
  };

  // For replies, we might only have minimal information
  if (referenceType === 'reply' && !referencedContent.text) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        {getReferenceIcon()}
        <span>
          {getReferenceLabel()}{' '}
          {referencedContent.author?.username && (
            <span className="font-medium">
              @{referencedContent.author.username}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        {getReferenceIcon()}
        <span>{getReferenceLabel()}</span>
      </div>

      <Card className="border-l-2 border-l-primary/30 bg-muted/30">
        <CardContent className="p-3">
          {referencedContent.author && (
            <div className="flex items-center gap-2 mb-2">
              {referencedContent.author.avatar_url && (
                <Avatar className="h-5 w-5">
                  <AvatarImage
                    src={referencedContent.author.avatar_url}
                    alt={
                      referencedContent.author.name ||
                      referencedContent.author.username
                    }
                  />
                  <AvatarFallback className="text-[10px]">
                    {(
                      referencedContent.author.name ||
                      referencedContent.author.username ||
                      '?'
                    ).charAt(0)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium">
                  {referencedContent.author.name ||
                    referencedContent.author.username}
                </span>
                {referencedContent.author.username && (
                  <span className="text-xs text-muted-foreground">
                    @{referencedContent.author.username}
                  </span>
                )}
                {referencedContent.author.is_verified && (
                  <CheckCircle className="h-3 w-3 text-primary" />
                )}
              </div>
            </div>
          )}

          {referencedContent.text && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {referencedContent.text}
            </p>
          )}

          {referencedContent.media_urls &&
            referencedContent.media_urls.length > 0 && (
              <div className="mt-2 flex gap-1">
                {referencedContent.media_urls
                  .slice(0, 2)
                  .map((media, index) => (
                    <div
                      key={index}
                      className="relative w-20 h-20 bg-muted rounded overflow-hidden flex-shrink-0"
                    >
                      {media.type === 'image' && (
                        <img
                          src={media.url}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            // Hide the container for broken images
                            const container = (
                              e.target as HTMLImageElement
                            ).closest('.relative');
                            if (container) {
                              (container as HTMLElement).style.display = 'none';
                            }
                          }}
                        />
                      )}
                      {media.type === 'video' && (
                        <>
                          {media.thumbnail_url ? (
                            <img
                              src={media.thumbnail_url}
                              alt=""
                              className="w-full h-full object-cover"
                              loading="lazy"
                              onError={(e) => {
                                // Hide broken thumbnails - hide the container
                                const container = (
                                  e.target as HTMLImageElement
                                ).closest('.relative');
                                if (container) {
                                  (container as HTMLElement).style.display =
                                    'none';
                                }
                              }}
                            />
                          ) : (
                            <video
                              src={media.url}
                              className="w-full h-full object-cover"
                              muted
                              playsInline
                              onError={(e) => {
                                // If video fails to load, hide the container
                                const container = (
                                  e.target as HTMLVideoElement
                                ).closest('.relative');
                                if (container) {
                                  (container as HTMLElement).style.display =
                                    'none';
                                }
                              }}
                            />
                          )}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-black/50 rounded-full p-1">
                              <Video className="h-4 w-4 text-white" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                {referencedContent.media_urls.length > 2 && (
                  <div className="w-20 h-20 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{referencedContent.media_urls.length - 2}
                    </span>
                  </div>
                )}
              </div>
            )}

          {referencedContent.engagement_metrics && (
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {referencedContent.engagement_metrics.likes !== undefined && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" />
                  {referencedContent.engagement_metrics.likes}
                </span>
              )}
              {referencedContent.engagement_metrics.comments !== undefined && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {referencedContent.engagement_metrics.comments}
                </span>
              )}
              {referencedContent.engagement_metrics.shares !== undefined && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  {referencedContent.engagement_metrics.shares}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
