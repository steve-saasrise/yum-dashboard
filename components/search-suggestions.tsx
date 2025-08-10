'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Loader2, Youtube, Linkedin, Rss, User, FileText, Clock, Search } from 'lucide-react';
import type { CreatorSuggestion, ContentSuggestion } from '@/hooks/use-search-suggestions';

interface SearchSuggestionsProps {
  creators: CreatorSuggestion[];
  content: ContentSuggestion[];
  isLoading: boolean;
  searchQuery: string;
  recentSearches: string[];
  onSuggestionClick: (suggestion: string) => void;
  onCreatorClick?: (creatorId: string) => void;
  onContentClick?: (contentId: string) => void;
  onClearRecentSearches: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  selectedIndex?: number;
}

const getPlatformIcon = (platform: string) => {
  switch (platform?.toLowerCase()) {
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

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  if (diffInHours < 1) {
    const diffInMinutes = Math.floor(diffInHours * 60);
    return `${diffInMinutes}m ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)}h ago`;
  } else if (diffInHours < 168) { // 7 days
    return `${Math.floor(diffInHours / 24)}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

export function SearchSuggestions({
  creators,
  content,
  isLoading,
  searchQuery,
  recentSearches,
  onSuggestionClick,
  onCreatorClick,
  onContentClick,
  onClearRecentSearches,
  selectedIndex = -1,
}: SearchSuggestionsProps) {
  const hasResults = creators.length > 0 || content.length > 0;
  const showRecentSearches = !searchQuery && recentSearches.length > 0;
  
  let currentIndex = 0;
  const isSelected = (index: number) => index === selectedIndex;

  if (!hasResults && !isLoading && !showRecentSearches) {
    return null;
  }

  return (
    <Card className="absolute top-full mt-2 w-full z-50 shadow-lg max-h-[70vh] overflow-hidden">
      <CardContent className="p-0">
        <div className="max-h-[calc(70vh-2rem)] overflow-y-auto">
          {isLoading && !hasResults ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : showRecentSearches ? (
            // Recent searches
            <div className="p-2">
              <div className="flex items-center justify-between px-2 py-1">
                <p className="text-xs text-gray-500">Recent searches</p>
                <button
                  type="button"
                  onClick={onClearRecentSearches}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, idx) => (
                <Button
                  key={idx}
                  type="button"
                  variant="ghost"
                  className="w-full justify-start text-sm"
                  onClick={() => onSuggestionClick(search)}
                >
                  <Clock className="h-3 w-3 mr-2 text-gray-400" />
                  {search}
                </Button>
              ))}
            </div>
          ) : (
            <>
              {/* Search query suggestion */}
              {searchQuery && (
                <div className="border-b">
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full justify-start text-sm font-medium rounded-none"
                    onClick={() => onSuggestionClick(searchQuery)}
                  >
                    <Search className="h-4 w-4 mr-2 text-gray-500" />
                    Search for "{searchQuery}"
                  </Button>
                </div>
              )}

              {/* Creators section */}
              {creators.length > 0 && (
                <div className="border-b">
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Creators
                    </p>
                  </div>
                  <div className="py-1">
                    {creators.map((creator) => {
                      const PlatformIcon = getPlatformIcon(creator.platform);
                      return (
                        <Button
                          key={creator.id}
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-sm rounded-none py-2 h-auto"
                          onClick={() => {
                            if (onCreatorClick) {
                              onCreatorClick(creator.id);
                            } else {
                              onSuggestionClick(creator.display_name);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={creator.avatar_url || '/placeholder.svg'}
                                alt={creator.display_name}
                              />
                              <AvatarFallback className="text-xs">
                                {creator.display_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left">
                              <div className="font-medium">{creator.display_name}</div>
                              {creator.handle && (
                                <div className="text-xs text-gray-500">@{creator.handle}</div>
                              )}
                            </div>
                            <PlatformIcon className="h-4 w-4 text-gray-400" />
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content section */}
              {content.length > 0 && (
                <div>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Content
                    </p>
                  </div>
                  <div className="py-1">
                    {content.map((item) => {
                      const PlatformIcon = getPlatformIcon(item.platform);
                      return (
                        <Button
                          key={item.id}
                          type="button"
                          variant="ghost"
                          className="w-full justify-start text-sm rounded-none py-2 h-auto"
                          onClick={() => {
                            if (onContentClick) {
                              onContentClick(item.id);
                            } else {
                              onSuggestionClick(item.title);
                            }
                          }}
                        >
                          <div className="flex items-start gap-3 w-full">
                            <FileText className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 text-left">
                              <div className="font-medium line-clamp-1">{item.title}</div>
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{item.creator_name}</span>
                                <span>•</span>
                                <PlatformIcon className="h-3 w-3" />
                                <span>•</span>
                                <span>{formatDate(item.published_at)}</span>
                              </div>
                            </div>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No results message */}
              {!hasResults && searchQuery && !isLoading && (
                <div className="p-4 text-center">
                  <p className="text-sm text-gray-500">
                    No results found for "{searchQuery}"
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}