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
import {
  Bookmark,
  ExternalLink,
  Trash2,
  Youtube,
  Linkedin,
  Rss,
} from 'lucide-react';
import type { Creator } from '@/types/creator';

interface FeedItem {
  id: string;
  title: string;
  description?: string;
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
  topics?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
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
        <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            This content is hidden from users
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
              {item.title}
            </h3>

            <AISummaryCompact
              shortSummary={item.ai_summary_short}
              originalDescription={item.description}
              className="mb-3"
            />

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
