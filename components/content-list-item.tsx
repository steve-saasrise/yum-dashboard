'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Icons } from '@/components/icons';
import { AISummaryCompact } from '@/components/ui/ai-summary';
import { ReferencedContentDisplay } from '@/components/referenced-content';
import { VideoThumbnail } from '@/components/video-thumbnail';
import {
  Bookmark,
  ExternalLink,
  Trash2,
  Youtube,
  Linkedin,
  Rss,
} from 'lucide-react';
import type { Creator } from '@/types/creator';
import type { ReferenceType, ReferencedContent } from '@/types/content';

interface FeedItem {
  id: string;
  title: string;
  description?: string;
  content_body?: string;
  ai_summary?: string;
  ai_summary_short?: string;
  ai_summary_long?: string;
  summary_generated_at?: string;
  summary_model?: string;
  summary_status?: 'pending' | 'processing' | 'completed' | 'error';
  summary_error_message?: string;
  url: string;
  platform: string;
  creator_id: string;
  creator?: {
    id: string;
    name: string;
    platform: string;
    avatar_url?: string;
    metadata?: Record<string, unknown>;
  };
  published_at: string;
  is_saved?: boolean;
  is_deleted?: boolean;
  deletion_reason?: string;
  media_urls?: Array<{
    url: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'link_preview';
    thumbnail_url?: string;
    width?: number;
    height?: number;
    duration?: number;
  }>;
  topics?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  engagement_metrics?: {
    likes?: number;
    views?: number;
    shares?: number;
    comments?: number;
  };
  // Reference fields for quoted/retweeted/replied content
  reference_type?: ReferenceType;
  referenced_content_id?: string;
  referenced_content?: ReferencedContent;
}

interface ContentListItemProps {
  item: FeedItem;
  creators: Creator[];
  onSave?: (id: string) => Promise<void>;
  onUnsave?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onUndelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}

export const ContentListItem = React.memo(function ContentListItem({
  item,
  creators,
  onSave,
  onUnsave,
  onDelete,
  onUndelete,
  canDelete,
}: ContentListItemProps) {
  const [bookmarked, setBookmarked] = React.useState(item.is_saved || false);
  const isDeleted = item.is_deleted || false;
  const creator =
    item.creator || creators.find((c) => c.id === item.creator_id);

  // Generate a better title for LinkedIn posts
  const getDisplayTitle = () => {
    if (item.platform === 'linkedin') {
      // For LinkedIn, create a concise title from the content
      const content = item.content_body || item.description || '';
      // Remove HTML tags and decode entities
      const cleanContent = content
        .replace(/<[^>]*>/g, '')
        .replace(/&#x[0-9A-F]+;/gi, (match) => {
          const code = parseInt(match.slice(3, -1), 16);
          return String.fromCharCode(code);
        })
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      // Get first sentence or first 80 characters
      const firstSentence =
        cleanContent.match(/^[^.!?]+[.!?]/)?.[0] || cleanContent;
      if (firstSentence.length > 80) {
        return firstSentence.substring(0, 80).trim() + '...';
      }
      return firstSentence;
    }
    return item.title;
  };

  const getPlatformIcon = (platformName: string) => {
    switch (platformName?.toLowerCase()) {
      case 'youtube':
        return Youtube;
      case 'x':
      case 'twitter':
        return Icons.x;
      case 'linkedin':
        return Linkedin;
      case 'threads':
        return Icons.threads;
      default:
        return Rss;
    }
  };

  const PlatformIcon = getPlatformIcon(item.platform);

  if (!creator) return null;

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 w-full ${isDeleted ? 'opacity-60' : ''}`}
    >
      {isDeleted && canDelete && (
        <div
          className={`px-4 py-2 border-b ${
            item.deletion_reason === 'low_relevancy'
              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
              : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          }`}
        >
          <p
            className={`text-xs font-medium ${
              item.deletion_reason === 'low_relevancy'
                ? 'text-orange-800 dark:text-orange-200'
                : 'text-yellow-800 dark:text-yellow-200'
            }`}
          >
            {item.deletion_reason === 'low_relevancy'
              ? '🤖 Auto-hidden: Low relevancy to lounge theme'
              : 'This content is hidden from users'}
          </p>
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12 border flex-shrink-0">
            <AvatarImage
              src={creator.avatar_url || '/placeholder.svg'}
              alt={
                'display_name' in creator ? creator.display_name : creator.name
              }
            />
            <AvatarFallback>
              {('display_name' in creator
                ? creator.display_name
                : creator.name
              ).charAt(0)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {'display_name' in creator
                  ? creator.display_name
                  : creator.name}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <PlatformIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {item.published_at
                    ? new Date(item.published_at).toLocaleDateString()
                    : 'Recently'}
                </span>
              </div>
            </div>

            <h3 className="font-bold text-lg mb-2 text-gray-900 dark:text-white line-clamp-2 leading-tight">
              {getDisplayTitle()}
            </h3>

            {/* For LinkedIn, show the full content with proper formatting */}
            {item.platform === 'linkedin' && item.content_body ? (
              <div className="mb-3">
                <div
                  className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    __html: item.content_body
                      .replace(/<br\s*\/?>/gi, '\n')
                      .replace(/&#x2019;/g, "'")
                      .replace(/&#x201C;/g, '"')
                      .replace(/&#x201D;/g, '"')
                      .replace(/&#x2014;/g, '—')
                      .replace(/<[^>]*>/g, ''),
                  }}
                />
                {item.engagement_metrics && (
                  <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {item.engagement_metrics.likes &&
                      item.engagement_metrics.likes > 0 && (
                        <span>{item.engagement_metrics.likes} likes</span>
                      )}
                    {item.engagement_metrics.comments &&
                      item.engagement_metrics.comments > 0 && (
                        <span>{item.engagement_metrics.comments} comments</span>
                      )}
                    {item.engagement_metrics.shares &&
                      item.engagement_metrics.shares > 0 && (
                        <span>{item.engagement_metrics.shares} shares</span>
                      )}
                  </div>
                )}
              </div>
            ) : (
              <AISummaryCompact
                shortSummary={item.ai_summary_short}
                originalDescription={item.description}
                className="mb-3"
              />
            )}

            {/* Display media content first */}
            {item.media_urls && item.media_urls.length > 0 && (
              <div className="mt-3">
                {item.media_urls.map((media, index) => {
                  if (media.type === 'video') {
                    return (
                      <VideoThumbnail
                        key={index}
                        thumbnailUrl={media.thumbnail_url}
                        videoUrl={media.url}
                        platform={item.platform}
                        title={item.title}
                        width={media.width}
                        height={media.height}
                        className="mt-2"
                      />
                    );
                  } else if (
                    media.type === 'image' &&
                    item.platform === 'linkedin'
                  ) {
                    // Display LinkedIn images
                    return (
                      <img
                        key={index}
                        src={media.url}
                        alt={item.title || 'Content image'}
                        className="mt-2 rounded-lg w-full object-cover"
                        style={{
                          maxHeight: '400px',
                        }}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            )}

            {/* Display referenced content with proper spacing */}
            {item.reference_type && item.referenced_content && (
              <div
                className={
                  item.media_urls && item.media_urls.length > 0
                    ? 'mt-4'
                    : 'mt-3'
                }
              >
                <ReferencedContentDisplay
                  referenceType={item.reference_type}
                  referencedContent={item.referenced_content}
                  platform={item.platform}
                />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {(item.topics || []).map((topic) => {
                return (
                  <Badge
                    key={topic.id}
                    variant="secondary"
                    className={`${topic.color || 'bg-gray-100 text-gray-800'} hover:${topic.color || 'bg-gray-100'} font-normal text-xs`}
                  >
                    {topic.name}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 bg-transparent"
                    asChild
                  >
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>View Original</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-500 hover:text-primary"
                    onClick={async () => {
                      try {
                        if (bookmarked && onUnsave) {
                          await onUnsave(item.id);
                          setBookmarked(false);
                        } else if (!bookmarked && onSave) {
                          await onSave(item.id);
                          setBookmarked(true);
                        }
                      } catch {
                        // Error is handled by the hook with toast
                      }
                    }}
                  >
                    <Bookmark
                      className={`h-4 w-4 ${bookmarked ? 'fill-primary text-primary' : ''}`}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bookmark</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {canDelete && (onDelete || onUndelete) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-9 w-9 ${isDeleted ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-red-600'}`}
                      onClick={async () => {
                        try {
                          if (isDeleted && onUndelete) {
                            await onUndelete(item.id);
                          } else if (!isDeleted && onDelete) {
                            await onDelete(item.id);
                          }
                        } catch {
                          // Error is handled by the hook with toast
                        }
                      }}
                    >
                      {isDeleted ? (
                        <Icons.undo className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isDeleted ? 'Undelete' : 'Delete'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
