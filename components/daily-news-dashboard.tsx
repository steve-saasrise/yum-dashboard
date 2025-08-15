'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useInfiniteContent } from '@/hooks/use-infinite-content';
import { useLounges } from '@/hooks/use-lounges';
import { useDebounce } from '@/hooks/use-debounce';
import { useDigestSubscription } from '@/hooks/use-digest-subscription';
import type { Creator, Platform } from '@/types/creator';
import type { Lounge } from '@/types/lounge';
import type { MediaUrl } from '@/types/content';
import { toast } from 'sonner';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarSeparator,
  SidebarInset,
} from '@/components/ui/sidebar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerWithRange } from '@/components/date-picker-with-range';
import { Icons } from '@/components/icons';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Search,
  LogOut,
  PlusCircle,
  Bookmark,
  ExternalLink,
  ChevronDown,
  Trash2,
  Edit,
  Rss,
  Bell,
  Filter,
  MoreHorizontal,
  Youtube,
  Linkedin,
  Loader2,
  UserCog,
  X as XIcon,
  Mail,
} from 'lucide-react';
import { AddCreatorModal } from '@/components/creators/add-creator-modal';
import { BackToTop } from '@/components/back-to-top';
import { AISummary } from '@/components/ui/ai-summary';
import { IntersectionObserverGrid } from '@/components/intersection-observer-grid';
import { YouTubeEmbed } from '@/components/ui/youtube-embed';
import { XVideoEmbed } from '@/components/ui/x-video-embed';
import { ReferencedContentDisplay } from '@/components/referenced-content';
import { LinkPreviewCard } from '@/components/link-preview-card';
import { VideoThumbnail } from '@/components/video-thumbnail';
import { ContentLinkPreviews } from '@/components/content-link-previews';
import type { ReferenceType, ReferencedContent } from '@/types/content';
import { useSearchSuggestions } from '@/hooks/use-search-suggestions';
import { SearchSuggestions } from '@/components/search-suggestions';
import { LinkedInContentDisplay } from '@/components/ui/linkedin-content-display';

// --- PLATFORM ICONS ---

const getPlatformIcon = (platform: string) => {
  switch (platform) {
    case 'youtube':
      return Youtube;
    case 'twitter':
      return Icons.x;
    case 'linkedin':
      return Linkedin;
    case 'threads':
      return Icons.threads;
    case 'rss':
      return Rss;
    default:
      return Rss;
  }
};

// Mock topics array removed - now using real lounges from useLounges hook

// Static creators array removed - now fetched from database in DailyNewsDashboard component

// Static content feed removed - will be replaced with dynamic content from database

// Content item interface for feed items
interface FeedItem {
  id: string;
  title: string;
  description?: string;
  content_body?: string; // Full content text
  ai_summary?: string; // Deprecated
  ai_summary_short?: string;
  ai_summary_long?: string;
  summary_generated_at?: string;
  summary_model?: string;
  summary_status?: 'pending' | 'processing' | 'completed' | 'error';
  summary_error_message?: string;
  url: string;
  platform: string;
  platform_content_id?: string;
  thumbnail_url?: string;
  creator_id: string;
  creator?: {
    id: string;
    name: string;
    platform: Platform;
    avatar_url?: string;
    metadata?: Record<string, unknown>;
  };
  published_at: string;
  is_saved?: boolean;
  is_deleted?: boolean; // Only present for curators/admins
  topics?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  media_urls?: MediaUrl[];
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

// Lounge interface for sidebar
interface SidebarLounge {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  color?: string;
  creator_count?: number;
  content_count?: number;
}
// --- SUBCOMPONENTS ---

interface AppSidebarProps {
  onTopicCreate: () => void;
  onTopicEdit: (topic: { id: string; name: string; color?: string }) => void;
  onTopicDelete: (topic: { id: string; name: string; color?: string }) => void;
  onCreatorCreate: () => void;
  lounges: Lounge[];
  isLoadingLounges: boolean;
  selectedLoungeId: string | null;
  onLoungeSelect: (loungeId: string | null) => void;
  canManageCreators: boolean;
  platformData: Array<{
    name: string;
    platform: string;
    count: number;
  }>;
  isLoadingPlatforms: boolean;
  selectedPlatforms: string[];
  onPlatformToggle: (platform: string) => void;
  onClearPlatforms: () => void;
}

function AppSidebar({
  onTopicCreate,
  onTopicEdit,
  onTopicDelete,
  onCreatorCreate,
  lounges,
  isLoadingLounges,
  selectedLoungeId,
  onLoungeSelect,
  canManageCreators,
  platformData,
  isLoadingPlatforms,
  selectedPlatforms,
  onPlatformToggle,
  onClearPlatforms,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" side="left">
      <SidebarHeader className="h-16 px-2 py-2 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => {
            onLoungeSelect(null);
            onClearPlatforms();
          }}
          className="flex items-center cursor-pointer focus:outline-none w-full h-full"
        >
          <Image
            src="/lounge_logo.svg"
            alt="Lounge Logo"
            width={160}
            height={56}
            className="h-12 w-auto object-contain mx-auto"
            priority
          />
        </button>
      </SidebarHeader>

      <SidebarContent
        className="px-2 py-2 sidebar-scrollbar"
        style={{ backgroundColor: '#FFF5F2' }}
      >
        {/* Curator Management Options - Moved to top for curator users */}
        {canManageCreators && (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip="Manage Creators">
                      <Link href="/creators">
                        <Edit className="w-4 h-4" />
                        <span className="truncate">Manage Creators</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Add Creator (Quick)"
                      onClick={onCreatorCreate}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span className="truncate">Add Creator</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Add Lounge"
                      onClick={onTopicCreate}
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span className="truncate">Add Lounge</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
          </>
        )}

        {/* Extra spacing above Lounges for non-curator users */}
        {!canManageCreators && <div className="h-3"></div>}

        {/* Lounges Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Lounges</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoadingLounges ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="truncate">Loading lounges...</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : lounges.length === 0 ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <span className="truncate text-gray-500">
                          No lounges yet
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    lounges.map((lounge) => (
                      <SidebarMenuItem
                        key={lounge.id}
                        className="group/topic-item relative flex items-center md:block"
                      >
                        <SidebarMenuButton
                          tooltip={lounge.name}
                          onClick={() => {
                            const newSelection =
                              selectedLoungeId === lounge.id ? null : lounge.id;
                            console.log('Lounge selection changed:', {
                              previousLoungeId: selectedLoungeId,
                              newLoungeId: newSelection,
                              loungeName: lounge.name,
                            });
                            onLoungeSelect(newSelection);
                          }}
                          className={
                            selectedLoungeId === lounge.id
                              ? 'bg-gray-100 dark:bg-gray-800'
                              : ''
                          }
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              selectedLoungeId === lounge.id
                                ? 'bg-primary'
                                : 'bg-gray-400 dark:bg-gray-600'
                            }`}
                          />
                          <span className="truncate">
                            {lounge.name === 'Venture' ? 'Venture Capital' : lounge.name}
                          </span>
                          <SidebarMenuBadge
                            className={
                              canManageCreators
                                ? 'md:group-hover/topic-item:opacity-0 md:transition-opacity md:duration-200'
                                : ''
                            }
                          >
                            {lounge.creator_count || 0}
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                        {canManageCreators && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="ml-1 md:absolute md:right-1 md:top-1/2 md:-translate-y-1/2 h-6 w-6 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover/topic-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                onClick={() =>
                                  onTopicEdit({
                                    id: lounge.id,
                                    name: lounge.name,
                                  })
                                }
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() =>
                                  onTopicDelete({
                                    id: lounge.id,
                                    name: lounge.name,
                                  })
                                }
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Platforms Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Platforms</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {selectedPlatforms.length > 0 && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        tooltip="Clear all platform filters"
                        onClick={onClearPlatforms}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        <XIcon className="w-3 h-3" />
                        <span className="truncate">All Platforms</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isLoadingPlatforms ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="truncate">Loading platforms...</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    platformData.map((platform) => {
                      const Icon = getPlatformIcon(platform.platform);
                      const isSelected = selectedPlatforms.includes(
                        platform.platform
                      );
                      return (
                        <SidebarMenuItem key={platform.platform}>
                          <SidebarMenuButton
                            tooltip={`${platform.name} (${platform.count} items)`}
                            onClick={() => onPlatformToggle(platform.platform)}
                            className={
                              isSelected ? 'bg-gray-100 dark:bg-gray-800' : ''
                            }
                          >
                            <Icon className="w-4 h-4" />
                            <span className="truncate">{platform.name}</span>
                            <SidebarMenuBadge>
                              {platform.count}
                            </SidebarMenuBadge>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

function Header({
  onSignOut,
  canManageCreators,
  searchQuery,
  onSearchChange,
  isSearching,
}: {
  onSignOut: () => void;
  canManageCreators: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  isSearching: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const [localSearchQuery, setLocalSearchQuery] = React.useState(searchQuery);
  const [recentSearches, setRecentSearches] = React.useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] =
    React.useState(-1);
  // Use unified auth with user profile
  const { state } = useAuth();
  const { user } = state;

  // Use search suggestions hook
  const suggestions = useSearchSuggestions(localSearchQuery, showSuggestions);

  // Load recent searches from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored));
      } catch (e) {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Save search to recent searches
  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter((s) => s !== query)].slice(
      0,
      5
    );
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = localSearchQuery.trim();
    if (query) {
      saveRecentSearch(query);
    }
    onSearchChange(query);
    setShowSuggestions(false);
  };

  const handleSearchClear = () => {
    setLocalSearchQuery('');
    onSearchChange('');
  };

  const handleSuggestionClick = (suggestion: string) => {
    setLocalSearchQuery(suggestion);
    onSearchChange(suggestion);
    saveRecentSearch(suggestion);
    setShowSuggestions(false);
  };

  // Sync local search with parent when parent changes (e.g., clear filters)
  React.useEffect(() => {
    setLocalSearchQuery(searchQuery);
  }, [searchQuery]);

  // Reset selected index when suggestions change
  React.useEffect(() => {
    setSelectedSuggestionIndex(-1);
  }, [suggestions.creators, suggestions.content, localSearchQuery]);

  // Calculate total suggestions count for keyboard navigation
  const getTotalSuggestions = () => {
    const searchItem = localSearchQuery ? 1 : 0;
    const recentCount = !localSearchQuery ? recentSearches.length : 0;
    const creatorsCount = suggestions.creators.length;
    const contentCount = suggestions.content.length;
    return searchItem + recentCount + creatorsCount + contentCount;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const totalSuggestions = getTotalSuggestions();

    if (!showSuggestions || totalSuggestions === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev < totalSuggestions - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex((prev) =>
        prev > 0 ? prev - 1 : totalSuggestions - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();

      // Determine which item is selected
      let currentIndex = 0;

      // Search query item
      if (localSearchQuery) {
        if (currentIndex === selectedSuggestionIndex) {
          handleSuggestionClick(localSearchQuery);
          return;
        }
        currentIndex++;
      }

      // Recent searches
      if (!localSearchQuery) {
        for (const search of recentSearches) {
          if (currentIndex === selectedSuggestionIndex) {
            handleSuggestionClick(search);
            return;
          }
          currentIndex++;
        }
      }

      // Creators
      for (const creator of suggestions.creators) {
        if (currentIndex === selectedSuggestionIndex) {
          handleSuggestionClick(creator.display_name);
          return;
        }
        currentIndex++;
      }

      // Content
      for (const content of suggestions.content) {
        if (currentIndex === selectedSuggestionIndex) {
          handleSuggestionClick(content.title);
          return;
        }
        currentIndex++;
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  };

  const getInitials = (email?: string) => {
    if (!email) return 'U';
    return email[0].toUpperCase();
  };
  return (
    <header className="flex items-center h-16 px-3 md:px-6 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-30">
      <div className="md:hidden">
        <SidebarTrigger className="h-9 w-9" />
      </div>
      <div className="flex-1 flex items-center gap-4">
        <form
          onSubmit={handleSearchSubmit}
          className="relative w-full max-w-xl"
        >
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-gray-500 pointer-events-none" />
            {isSearching && (
              <Loader2 className="absolute right-10 h-4 w-4 text-gray-500 animate-spin pointer-events-none" />
            )}
            <Input
              type="text"
              placeholder="Search content or creators..."
              className="pl-9 pr-10 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-primary transition-all"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-3 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {showSuggestions && (
            <SearchSuggestions
              creators={suggestions.creators}
              content={suggestions.content}
              isLoading={suggestions.isLoading}
              searchQuery={localSearchQuery}
              recentSearches={recentSearches}
              onSuggestionClick={handleSuggestionClick}
              onClearRecentSearches={() => {
                setRecentSearches([]);
                localStorage.removeItem('recentSearches');
              }}
              selectedIndex={selectedSuggestionIndex}
            />
          )}
        </form>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white"
          >
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar className="h-9 w-9 cursor-pointer">
              <AvatarImage
                src={'/placeholder.svg?height=40&width=40'}
                alt={user?.email || 'User'}
              />
              <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                {state.profile?.role && state.profile.role !== 'viewer' && (
                  <p className="text-sm font-medium">
                    {state.profile.role.charAt(0).toUpperCase() +
                      state.profile.role.slice(1)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {state.profile?.role === 'admin' && (
              <>
                <DropdownMenuItem
                  onClick={() => (window.location.href = '/dashboard/admin')}
                >
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onSignOut} className="cursor-pointer">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

// Helper function to generate better LinkedIn post titles
function getLinkedInTitle(item: FeedItem, creator: any): string {
  const creatorName = creator?.display_name || creator?.name || 'Unknown';
  return `LinkedIn post by ${creatorName}`;
}

export const ContentCard = React.memo(function ContentCard({
  item,
  creators,
  onSave,
  onUnsave,
  onDelete,
  onUndelete,
  canDelete,
  showVideoEmbeds = true,
}: {
  item: FeedItem;
  creators: Creator[];
  onSave?: (id: string) => Promise<void>;
  onUnsave?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onUndelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
  showVideoEmbeds?: boolean;
}) {
  const [bookmarked, setBookmarked] = React.useState(item.is_saved || false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [expandedImage, setExpandedImage] = React.useState<string | null>(null);
  const [imageIndices, setImageIndices] = React.useState<{
    [key: string]: number;
  }>({});
  const isDeleted = item.is_deleted || false;
  const creator =
    item.creator || creators.find((c) => c.id === item.creator_id);

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

  const getPlatformDisplayName = (platform: string) => {
    if (platform?.toLowerCase() === 'twitter') return 'X';
    if (platform?.toLowerCase() === 'x') return 'X';
    return platform || 'website';
  };

  const PlatformIcon = getPlatformIcon(item.platform);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), Math.random() * 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!creator) return null;

  if (isLoading) {
    return (
      <Card className="overflow-hidden transition-all hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
          <Skeleton className="h-5 w-full mb-2" />
          <Skeleton className="h-4 w-full mb-1" />
          <Skeleton className="h-4 w-2/3 mb-4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 flex flex-col h-full ${isDeleted ? 'opacity-60' : ''}`}
    >
      {isDeleted && canDelete && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 border-b border-yellow-200 dark:border-yellow-800">
          <p className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
            This content is hidden from users
          </p>
        </div>
      )}
      <CardContent className="p-4 flex flex-col flex-grow">
        <div className="flex-grow">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 border">
                <AvatarImage
                  src={creator.avatar_url || '/placeholder.svg'}
                  alt={
                    'display_name' in creator
                      ? creator.display_name
                      : creator.name
                  }
                />
                <AvatarFallback>
                  {('display_name' in creator
                    ? creator.display_name
                    : creator.name
                  ).charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100">
                  {'display_name' in creator
                    ? creator.display_name
                    : creator.name}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <PlatformIcon className="h-3.5 w-3.5" />
                  <span>
                    {getPlatformDisplayName(
                      item.platform || creator?.platform || 'website'
                    )}{' '}
                    &middot;{' '}
                    {item.published_at
                      ? new Date(item.published_at).toLocaleDateString()
                      : 'Recently'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canDelete && (onDelete || onUndelete) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${isDeleted ? 'text-green-600 hover:text-green-700' : 'text-gray-500 hover:text-red-600'}`}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-gray-500 hover:text-primary"
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
            </div>
          </div>
          <h3 className="font-bold text-lg mb-1 text-gray-900 dark:text-white">
            {item.platform === 'linkedin'
              ? getLinkedInTitle(item, creator)
              : item.title}
          </h3>
          {/* Use LinkedIn content display for LinkedIn, AI summaries for others */}
          {item.platform === 'linkedin' ? (
            <LinkedInContentDisplay
              content={item.content_body}
              description={item.description}
              className="mb-4"
              truncateAt={280}
              engagementMetrics={item.engagement_metrics}
            />
          ) : (
            <AISummary
              shortSummary={item.ai_summary_short}
              longSummary={item.ai_summary_long}
              originalDescription={item.description}
              summaryStatus={item.summary_status}
              summaryModel={item.summary_model}
              generatedAt={item.summary_generated_at}
              className="mb-4"
              defaultMode="short"
            />
          )}

          {/* Display YouTube video embed */}
          {item.platform === 'youtube' && item.platform_content_id && (
            <YouTubeEmbed
              videoId={item.platform_content_id}
              title={item.title}
              thumbnailUrl={item.thumbnail_url}
              className="mb-4"
              lazyLoad={true}
            />
          )}

          {/* Display X/Twitter video embed */}
          {item.platform === 'twitter' &&
            item.media_urls &&
            (() => {
              // Find the first video in media_urls
              const videoMedia = item.media_urls.find(
                (m) => m.type === 'video'
              );
              if (
                videoMedia &&
                videoMedia.url &&
                videoMedia.url.includes('video.twimg.com')
              ) {
                return (
                  <XVideoEmbed
                    videoUrl={videoMedia.url}
                    thumbnailUrl={videoMedia.thumbnail_url}
                    title={item.title}
                    className="mb-4"
                    lazyLoad={true}
                    width={videoMedia.width}
                    height={videoMedia.height}
                    duration={videoMedia.duration}
                  />
                );
              }
              return null;
            })()}

          {/* For LinkedIn reposts, show referenced content first */}
          {item.platform === 'linkedin' &&
            item.reference_type === 'retweet' && (
              <div className="mb-4">
                <ReferencedContentDisplay
                  referenceType={item.reference_type}
                  referencedContent={item.referenced_content}
                  platform={item.platform}
                />
              </div>
            )}

          {/* Display LinkedIn videos with thumbnail and play button */}
          {item.platform === 'linkedin' &&
            item.media_urls &&
            (() => {
              // Find the first video in media_urls
              const videoMedia = item.media_urls.find(
                (m) => m.type === 'video'
              );
              if (videoMedia && videoMedia.url) {
                return (
                  <VideoThumbnail
                    thumbnailUrl={videoMedia.thumbnail_url}
                    videoUrl={item.url} // Link to the LinkedIn post
                    platform="linkedin"
                    title={item.title}
                    width={videoMedia.width}
                    height={videoMedia.height}
                    className="mb-4"
                  />
                );
              }
              return null;
            })()}

          {/* Display images for Twitter, LinkedIn, Threads, and RSS posts */}
          {item.media_urls &&
            item.media_urls.length > 0 &&
            ['twitter', 'linkedin', 'threads', 'rss'].includes(item.platform) &&
            (() => {
              // For LinkedIn, skip this section if there's a video (handled above)
              if (
                item.platform === 'linkedin' &&
                item.media_urls.some((m) => m.type === 'video')
              ) {
                return null;
              }

              // Filter out null/placeholder images and videos (videos are handled separately)
              const validImages = item.media_urls.filter(
                (m) =>
                  m.type === 'image' &&
                  m.url &&
                  !m.url.includes('null.jpg') &&
                  !m.url.includes('null.png')
              );

              if (validImages.length === 0) return null;

              // Use item.id as unique key for this post's image index
              const imageKey = item.id;
              const currentImageIndex = imageIndices[imageKey] || 0;
              const currentImage =
                validImages[
                  Math.min(currentImageIndex, validImages.length - 1)
                ];

              const handlePrevImage = (e: React.MouseEvent) => {
                e.stopPropagation();
                setImageIndices((prev) => ({
                  ...prev,
                  [imageKey]:
                    currentImageIndex === 0
                      ? validImages.length - 1
                      : currentImageIndex - 1,
                }));
              };

              const handleNextImage = (e: React.MouseEvent) => {
                e.stopPropagation();
                setImageIndices((prev) => ({
                  ...prev,
                  [imageKey]:
                    currentImageIndex === validImages.length - 1
                      ? 0
                      : currentImageIndex + 1,
                }));
              };

              return (
                <>
                  <div
                    className="relative w-full mb-4 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer group"
                    style={{
                      aspectRatio: '16/9',
                      maxHeight: '400px',
                    }}
                    onClick={() => setExpandedImage(currentImage.url)}
                  >
                    <Image
                      src={currentImage.url}
                      alt={item.title || 'Post image'}
                      fill
                      className="object-contain group-hover:opacity-95 transition-opacity"
                      sizes="(max-width: 768px) 100vw, 672px"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none" />

                    {/* Navigation arrows for multiple images */}
                    {validImages.length > 1 && (
                      <>
                        <button
                          onClick={handlePrevImage}
                          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 19l-7-7 7-7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={handleNextImage}
                          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>

                        {/* Image counter */}
                        <div className="absolute top-2 right-2">
                          <div className="bg-black/70 text-white px-2 py-1 rounded text-xs">
                            {currentImageIndex + 1} of {validImages.length}
                          </div>
                        </div>

                        {/* Dots indicator */}
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                          {validImages.map((_, idx) => (
                            <button
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setImageIndices((prev) => ({
                                  ...prev,
                                  [imageKey]: idx,
                                }));
                              }}
                              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                idx === currentImageIndex
                                  ? 'bg-white'
                                  : 'bg-white/50'
                              }`}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Expand hint */}
                    <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="bg-black/70 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                          />
                        </svg>
                        Click to expand
                      </div>
                    </div>
                  </div>

                  {/* Lightbox Modal with navigation */}
                  {expandedImage && (
                    <div
                      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                      onClick={() => setExpandedImage(null)}
                    >
                      <div className="relative max-w-[90vw] max-h-[90vh] flex items-center">
                        {validImages.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const prevIndex = validImages.findIndex(
                                (img) => img.url === expandedImage
                              );
                              const newIndex =
                                prevIndex === 0
                                  ? validImages.length - 1
                                  : prevIndex - 1;
                              setExpandedImage(validImages[newIndex].url);
                              setImageIndices((prev) => ({
                                ...prev,
                                [imageKey]: newIndex,
                              }));
                            }}
                            className="absolute left-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3"
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 19l-7-7 7-7"
                              />
                            </svg>
                          </button>
                        )}

                        <Image
                          src={expandedImage}
                          alt={item.title || 'Post image'}
                          width={1200}
                          height={800}
                          className="object-contain w-auto h-auto max-w-full max-h-[90vh]"
                          priority
                        />

                        {validImages.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIdx = validImages.findIndex(
                                (img) => img.url === expandedImage
                              );
                              const newIndex =
                                currentIdx === validImages.length - 1
                                  ? 0
                                  : currentIdx + 1;
                              setExpandedImage(validImages[newIndex].url);
                              setImageIndices((prev) => ({
                                ...prev,
                                [imageKey]: newIndex,
                              }));
                            }}
                            className="absolute right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-3"
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        )}

                        <button
                          className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 transition-colors z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedImage(null);
                          }}
                        >
                          <XIcon className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

          {/* Display LinkedIn article shares as integrated cards */}
          {item.media_urls &&
            item.platform === 'linkedin' &&
            (() => {
              const articlePreviews = item.media_urls.filter(
                (m) => m.type === 'link_preview'
              );

              if (articlePreviews.length === 0) return null;

              // LinkedIn best practice: Show only the first article
              const articleToShow = articlePreviews[0];

              // Only render if we have a valid article URL
              if (!articleToShow.link_url) return null;

              return (
                <div className="mb-4">
                  <LinkPreviewCard
                    linkUrl={articleToShow.link_url}
                    linkTitle={articleToShow.link_title}
                    linkDescription={articleToShow.link_description}
                    linkDomain={articleToShow.link_domain}
                    imageUrl={articleToShow.url}
                  />
                </div>
              );
            })()}

          {/* Display native X/Twitter link previews from media_urls */}
          {/* Following X.com behavior: Don't show link previews when there's a video */}
          {item.media_urls &&
            item.platform === 'twitter' &&
            (() => {
              // Check if there's a video in the tweet
              const hasVideo = item.media_urls.some((m) => m.type === 'video');

              // Skip link previews if there's a video (X.com behavior)
              if (hasVideo) return null;

              const linkPreviews = item.media_urls.filter(
                (m) => m.type === 'link_preview'
              );

              if (linkPreviews.length === 0) return null;

              // X best practice: Show only the first link preview
              const previewToShow = linkPreviews[0];

              // Only render if we have a valid link URL
              if (!previewToShow.link_url) return null;

              return (
                <div className="mb-4">
                  <LinkPreviewCard
                    linkUrl={previewToShow.link_url}
                    linkTitle={previewToShow.link_title}
                    linkDescription={previewToShow.link_description}
                    linkDomain={previewToShow.link_domain}
                    imageUrl={previewToShow.url}
                    imageWidth={previewToShow.width}
                    imageHeight={previewToShow.height}
                    displayUrl={previewToShow.link_display_url}
                  />
                </div>
              );
            })()}

          {/* Display dynamic link previews for external URLs in content */}
          {/* For X/Twitter: Only show if there's no native media or link preview */}
          {/* For YouTube: Skip as the video embed is sufficient */}
          {/* For LinkedIn/others: Show only first link for better UX */}
          {(() => {
            // Skip YouTube entirely - video embed is enough
            if (item.platform === 'youtube') return null;

            // For X/Twitter, be more selective about when to show ContentLinkPreviews
            if (item.platform === 'twitter') {
              // Check if we have any visual media content
              const hasVisualMedia =
                item.media_urls &&
                item.media_urls.some(
                  (m) =>
                    m.type === 'image' ||
                    m.type === 'video' ||
                    m.type === 'link_preview'
                );

              // If we have any visual media, skip ContentLinkPreviews to avoid redundancy
              // This prevents showing link previews for tweets that already have visual content
              if (hasVisualMedia) return null;
            }

            // For LinkedIn, check if we already have article previews
            if (item.platform === 'linkedin') {
              const hasArticlePreview =
                item.media_urls &&
                item.media_urls.some((m) => m.type === 'link_preview');

              // Skip ContentLinkPreviews if we already showed an article preview
              if (hasArticlePreview) return null;
            }

            // For all platforms, show link previews
            // LinkedIn best practice: show only the first link
            const maxPreviews = item.platform === 'linkedin' ? 1 : 3;

            return (
              <ContentLinkPreviews
                description={item.description}
                contentBody={item.content_body}
                platform={item.platform}
                className="mb-4"
                maxPreviews={maxPreviews}
              />
            );
          })()}

          {/* Display referenced content (quote tweets, etc.) - after media */}
          {/* Skip for LinkedIn reposts as we show them before media */}
          {!(
            item.platform === 'linkedin' && item.reference_type === 'retweet'
          ) && (
            <ReferencedContentDisplay
              referenceType={item.reference_type}
              referencedContent={item.referenced_content}
              platform={item.platform}
            />
          )}

          <div className="flex flex-wrap gap-2 mb-4">
            {(item.topics || []).map((topic) => {
              return (
                <Badge
                  key={topic.id}
                  variant="secondary"
                  className={`${topic.color || 'bg-gray-100 text-gray-800'} hover:${topic.color || 'bg-gray-100'} font-normal`}
                >
                  {topic.name}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex justify-between items-center mt-auto">
          <Button variant="outline" size="sm" asChild>
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              View Original
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

function TopicManagementModal({
  open,
  onOpenChange,
  topic,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic?: SidebarLounge;
  onSuccess?: () => void;
}) {
  const isEditing = !!topic;
  const [name, setName] = React.useState(topic?.name || '');
  const [description, setDescription] = React.useState(
    topic?.description || ''
  );
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (topic) {
      setName(topic.name);
      setDescription(topic.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [topic]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Lounge name is required');
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        name: name.trim(),
      };

      // Only add description if it has a value
      if (description.trim()) {
        payload.description = description.trim();
      }

      const response = await fetch(
        isEditing ? `/api/lounges/${topic.id}` : '/api/lounges',
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save lounge');
      }

      toast.success(
        isEditing ? `${name} has been updated` : `${name} has been created`
      );

      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save lounge'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Lounge' : 'Create New Lounge'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the details for the "${topic?.name}" lounge.`
              : 'Add a new lounge to organize creators and content.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. AI, Startups, Design"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">
              Description{' '}
              <span className="text-sm text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this lounge"
            />
          </div>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {isEditing ? 'Save Changes' : 'Create Lounge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ContentListItem is now imported from separate component file

function MobileFiltersSheet({
  open,
  onOpenChange,
  creators,
  lounges,
  selectedLoungeId,
  setSelectedLoungeId,
  platformData,
  selectedPlatforms,
  onPlatformToggle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: Creator[];
  lounges: Lounge[];
  selectedLoungeId: string | null;
  setSelectedLoungeId: (id: string | null) => void;
  platformData: Array<{
    name: string;
    platform: string;
    count: number;
  }>;
  selectedPlatforms: string[];
  onPlatformToggle: (platform: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] [&>button]:hidden px-6">
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between pb-4 border-b">
            <h2 className="text-lg font-semibold">Filters</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 pr-4 space-y-6">
            {/* Date Range */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Date Range</h3>
              <DatePickerWithRange className="w-full" />
            </div>

            {/* Platforms */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Platforms</h3>
              <div className="space-y-2">
                {platformData.map((p) => {
                  const Icon = getPlatformIcon(p.platform);
                  return (
                    <div
                      key={p.platform}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={`mobile-platform-${p.platform}`}
                        checked={selectedPlatforms.includes(p.platform)}
                        onCheckedChange={(checked) => {
                          if (checked !== 'indeterminate') {
                            onPlatformToggle(p.platform);
                          }
                        }}
                      />
                      <label
                        htmlFor={`mobile-platform-${p.platform}`}
                        className="text-sm font-medium leading-none flex items-center gap-2"
                      >
                        <Icon className="w-4 h-4" />
                        {p.name} ({p.count})
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Topics */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Lounges</h3>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {lounges.map((lounge) => (
                  <div key={lounge.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`mobile-lounge-${lounge.id}`}
                      checked={selectedLoungeId === lounge.id}
                      onCheckedChange={(checked) =>
                        setSelectedLoungeId(checked ? lounge.id : null)
                      }
                    />
                    <label
                      htmlFor={`mobile-lounge-${lounge.id}`}
                      className="text-sm font-medium leading-none"
                    >
                      {lounge.name === 'Venture' ? 'Venture Capital' : lounge.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Creators */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm">Creators</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {creators.map((c) => (
                  <div key={c.id} className="flex items-center space-x-2">
                    <Checkbox id={`mobile-creator-${c.id}`} />
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={c.avatar_url || '/placeholder.svg'}
                          alt={c.display_name}
                        />
                        <AvatarFallback className="text-xs">
                          {c.display_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <label
                        htmlFor={`mobile-creator-${c.id}`}
                        className="text-sm font-medium leading-none"
                      >
                        {c.display_name}
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Saved Items */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Saved Items Only</span>
              <Switch />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              className="flex-1 bg-transparent"
              onClick={() => onOpenChange(false)}
            >
              Clear All
            </Button>
            <Button className="flex-1" onClick={() => onOpenChange(false)}>
              Apply Filters
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// --- MAIN DASHBOARD COMPONENT ---

export function DailyNewsDashboard() {
  const { signOut, state: authState } = useAuth();
  const userRole = authState.profile?.role;
  const canManageCreators = userRole === 'curator' || userRole === 'admin';

  // Debug logging
  console.log('[DailyNewsDashboard] Auth state:', {
    userEmail: authState.user?.email,
    userRole,
    profileLoaded: !!authState.profile,
    isViewer: userRole === 'viewer',
    canManageCreators,
  });

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Logout error:', error);
        toast.error('Failed to sign out. Please try again.');
      }
      // Don't redirect here - let the auth state change handle it
    } catch (error) {
      console.error('Unexpected logout error:', error);
      toast.error('An unexpected error occurred during sign out.');
    }
  };
  // Single column feed - no view toggle needed
  const [isTopicModalOpen, setTopicModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedTopic, setSelectedTopic] =
    React.useState<SidebarLounge | null>(null);
  const [selectedCreator, setSelectedCreator] = React.useState<Creator | null>(
    null
  );
  const [isDeleteCreatorDialogOpen, setDeleteCreatorDialogOpen] =
    React.useState(false);
  const [creatorToDelete, setCreatorToDelete] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isCreatorModalOpen, setCreatorModalOpen] = React.useState(false);
  const [creatorModalMode, setCreatorModalMode] = React.useState<
    'add' | 'edit'
  >('add');
  const [isMobileFiltersOpen, setMobileFiltersOpen] = React.useState(false);
  const [creators, setCreators] = React.useState<Creator[]>([]);
  const [isLoadingCreators, setIsLoadingCreators] = React.useState(true);
  const [selectedLoungeId, setSelectedLoungeId] = React.useState<string | null>(
    null
  );
  const [selectedPlatforms, setSelectedPlatforms] = React.useState<string[]>(
    []
  );

  // Digest subscription state
  const {
    subscribed,
    loading: digestLoading,
    toggleSubscription,
  } = useDigestSubscription(selectedLoungeId);
  const [platformData, setPlatformData] = React.useState<
    Array<{
      name: string;
      platform: string;
      count: number;
    }>
  >([]);
  const [isLoadingPlatforms, setIsLoadingPlatforms] = React.useState(true);
  const [showVideoEmbeds, setShowVideoEmbeds] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Debounce the search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Get viewport width for responsive columns
  // Single column feed layout

  // Use the infinite content hook with React Query
  const {
    content,
    loading: isLoadingContent,
    hasMore,
    saveContent,
    unsaveContent,
    deleteContent,
    undeleteContent,
    refreshContent,
    isFetchingNextPage,
    fetchNextPage,
    isFetching,
  } = useInfiniteContent({
    lounge_id: selectedLoungeId || undefined,
    platforms:
      selectedPlatforms.length > 0 ? (selectedPlatforms as any) : undefined,
    search: debouncedSearchQuery || undefined,
    sort_by: 'published_at',
    sort_order: 'desc',
  });

  // Filter content based on user role
  const filteredContent = React.useMemo(() => {
    return content.filter((item) => {
      // Filter out deleted content for viewers
      if (userRole === 'viewer' && item.is_deleted) {
        return false;
      }
      return true;
    });
  }, [content, userRole]);

  // Debug logging
  React.useEffect(() => {
    console.log('Content state:', {
      contentLength: content.length,
      filteredContentLength: filteredContent.length,
      isLoadingContent,
      hasMore,
      isFetchingNextPage,
    });
  }, [content, filteredContent, isLoadingContent, hasMore, isFetchingNextPage]);

  // Use the optimistic delete handlers from the hook
  const handleDeleteContent = deleteContent;
  const handleUndeleteContent = undeleteContent;

  // Use the lounges hook to fetch real lounges
  const { lounges, loading: isLoadingLounges, refreshLounges } = useLounges();

  const handleCreateTopic = () => {
    setSelectedTopic(null);
    setTopicModalOpen(true);
  };

  const handleEditTopic = (topic: {
    id: string;
    name: string;
    color?: string;
  }) => {
    // Convert to Topic type
    const fullTopic: SidebarLounge = {
      id: topic.id,
      name: topic.name,
      slug: topic.name.toLowerCase().replace(/\s+/g, '-'),
      color: topic.color,
    };
    setSelectedTopic(fullTopic);
    setTopicModalOpen(true);
  };

  const handleDeleteTopic = (topic: {
    id: string;
    name: string;
    color?: string;
  }) => {
    // Convert to Topic type
    const fullTopic: SidebarLounge = {
      id: topic.id,
      name: topic.name,
      slug: topic.name.toLowerCase().replace(/\s+/g, '-'),
      color: topic.color,
    };
    setSelectedTopic(fullTopic);
    setDeleteDialogOpen(true);
  };

  const handleEditCreator = (creator: {
    id: string;
    name: string;
    platform: string;
    handle: string;
  }) => {
    // Find the full creator object from our state
    const fullCreator = creators.find((c) => c.id === creator.id);
    if (fullCreator) {
      setSelectedCreator(fullCreator);
      setCreatorModalMode('edit');
      setCreatorModalOpen(true);
    }
  };

  const handleCreateCreator = () => {
    setSelectedCreator(null);
    setCreatorModalMode('add');
    setCreatorModalOpen(true);
  };
  const handleDeleteCreator = (creator: { id: string; name: string }) => {
    setCreatorToDelete(creator);
    setDeleteCreatorDialogOpen(true);
  };

  const confirmDeleteCreator = async () => {
    if (!creatorToDelete) return;

    try {
      const response = await fetch(`/api/creators/${creatorToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete creator');
      }

      // Remove creator from local state
      setCreators((prev) => prev.filter((c) => c.id !== creatorToDelete.id));
      toast.success(`${creatorToDelete.name} has been deleted`);
      setDeleteCreatorDialogOpen(false);
      setCreatorToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete creator'
      );
    }
  };

  // Fetch creators from the database
  const fetchCreators = React.useCallback(async () => {
    setIsLoadingCreators(true);
    try {
      const params = new URLSearchParams();
      if (selectedLoungeId) {
        params.append('lounge_id', selectedLoungeId);
      }

      console.log('Fetching creators with params:', {
        selectedLoungeId,
        paramsString: params.toString(),
        fullUrl: `/api/creators${params.toString() ? '?' + params.toString() : ''}`,
      });

      const response = await fetch(
        `/api/creators${params.toString() ? '?' + params.toString() : ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('Creators API response:', {
          selectedLoungeId,
          creatorsCount: data.data?.creators?.length || 0,
          creators:
            data.data?.creators?.map((c: any) => ({
              id: c.id,
              name: c.display_name,
            })) || [],
        });
        setCreators(data.data?.creators || []);
      } else {
        console.error(
          'Failed to fetch creators:',
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setIsLoadingCreators(false);
    }
  }, [selectedLoungeId]);

  // Fetch creators on mount and when user/session changes
  React.useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  // Fetch platform statistics
  const fetchPlatforms = React.useCallback(async () => {
    setIsLoadingPlatforms(true);
    try {
      const params = new URLSearchParams();
      if (selectedLoungeId) {
        params.append('lounge_id', selectedLoungeId);
      }

      const response = await fetch(
        `/api/platforms${params.toString() ? '?' + params.toString() : ''}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPlatformData(data.platforms || []);
      } else {
        console.error(
          'Failed to fetch platforms:',
          response.status,
          response.statusText
        );
      }
    } catch (error) {
      console.error('Error fetching platforms:', error);
    } finally {
      setIsLoadingPlatforms(false);
    }
  }, [selectedLoungeId]);

  // Fetch platforms when lounge changes
  React.useEffect(() => {
    fetchPlatforms();
  }, [fetchPlatforms]);

  // Handle platform selection
  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms((prev) => {
      const isSelected = prev.includes(platform);
      if (isSelected) {
        return prev.filter((p) => p !== platform);
      } else {
        return [...prev, platform];
      }
    });
  };

  const handleClearPlatforms = () => {
    setSelectedPlatforms([]);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
  };

  const handleClearAllFilters = () => {
    setSearchQuery('');
    setSelectedLoungeId(null);
    setSelectedPlatforms([]);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          onTopicCreate={handleCreateTopic}
          onTopicEdit={handleEditTopic}
          onTopicDelete={handleDeleteTopic}
          onCreatorCreate={handleCreateCreator}
          lounges={lounges}
          isLoadingLounges={isLoadingLounges}
          selectedLoungeId={selectedLoungeId}
          onLoungeSelect={setSelectedLoungeId}
          canManageCreators={canManageCreators}
          platformData={platformData}
          isLoadingPlatforms={isLoadingPlatforms}
          selectedPlatforms={selectedPlatforms}
          onPlatformToggle={handlePlatformToggle}
          onClearPlatforms={handleClearPlatforms}
        />
        <SidebarInset className="flex-1 flex flex-col w-full min-h-screen bg-gray-50 dark:bg-gray-950">
          <Header
            onSignOut={handleSignOut}
            canManageCreators={canManageCreators}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            isSearching={isFetching && !isFetchingNextPage}
          />
          <main className="flex-1 py-4 md:py-6 lg:py-8">
            <div className="flex justify-between items-center mb-6 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {searchQuery
                    ? `Search results for "${searchQuery}"`
                    : lounges.find((l) => l.id === selectedLoungeId)?.name
                      ? `${lounges.find((l) => l.id === selectedLoungeId)?.name} Lounge`
                      : 'Your Lounge'}
                </h1>
                {(searchQuery || selectedPlatforms.length > 0) && (
                  <div className="flex items-center gap-2 mt-2">
                    <p className="text-sm text-gray-500">Active filters:</p>
                    {searchQuery && (
                      <Badge
                        variant="secondary"
                        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => setSearchQuery('')}
                      >
                        Search: {searchQuery}
                        <XIcon className="h-3 w-3 ml-1" />
                      </Badge>
                    )}
                    {selectedPlatforms.map((platform) => (
                      <Badge
                        key={platform}
                        variant="secondary"
                        className="cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={() => handlePlatformToggle(platform)}
                      >
                        {platform}
                        <XIcon className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllFilters}
                      className="text-xs"
                    >
                      Clear all
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Email Digest Toggle - only show when a lounge is selected */}
                {selectedLoungeId && (
                  <Button
                    variant={subscribed ? 'default' : 'outline'}
                    size="sm"
                    onClick={toggleSubscription}
                    disabled={digestLoading}
                    className="gap-2"
                  >
                    <Mail className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {subscribed ? 'Subscribed' : 'Get Daily Digest'}
                    </span>
                  </Button>
                )}

                {/* Mobile Filter Button */}
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden h-9 w-9 bg-transparent"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  <Filter className="h-4 w-4" />
                </Button>

                {/* Desktop Filter Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      className="hidden md:flex bg-transparent"
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-80 min-w-[320px]"
                    align="end"
                    side="bottom"
                    sideOffset={4}
                  >
                    <DropdownMenuLabel>Filter By</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5">
                      <DatePickerWithRange className="w-full" />
                    </div>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Platforms</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {selectedPlatforms.length > 0 && (
                            <>
                              <DropdownMenuItem
                                onClick={handleClearPlatforms}
                                className="text-xs text-muted-foreground"
                              >
                                <XIcon className="w-3 h-3 mr-2" />
                                Clear all
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {platformData.map((p) => {
                            const Icon = getPlatformIcon(p.platform);
                            return (
                              <DropdownMenuCheckboxItem
                                key={p.platform}
                                checked={selectedPlatforms.includes(p.platform)}
                                onCheckedChange={() =>
                                  handlePlatformToggle(p.platform)
                                }
                              >
                                <Icon className="w-4 h-4 mr-2" />
                                {p.name} ({p.count})
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Creators</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {creators.map((c) => (
                            <DropdownMenuCheckboxItem key={c.id}>
                              {c.display_name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Lounges</DropdownMenuSubTrigger>
                      <DropdownMenuPortal>
                        <DropdownMenuSubContent>
                          {lounges.map((lounge) => (
                            <DropdownMenuCheckboxItem
                              key={lounge.id}
                              checked={selectedLoungeId === lounge.id}
                              onCheckedChange={(checked) =>
                                setSelectedLoungeId(checked ? lounge.id : null)
                              }
                            >
                              {lounge.name === 'Venture' ? 'Venture Capital' : lounge.name}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuSubContent>
                      </DropdownMenuPortal>
                    </DropdownMenuSub>
                    <div className="flex items-center justify-between px-2 py-1.5">
                      <span className="text-sm font-medium">Saved Items</span>
                      <Switch />
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Advanced Search</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {filteredContent.length === 0 && !isLoadingContent ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 px-4 max-w-3xl mx-auto">
                <div className="max-w-md text-center space-y-6">
                  <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Rss className="w-10 h-10 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {searchQuery ? 'No results found' : 'No content yet'}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {searchQuery
                        ? `Try adjusting your search query or clearing filters`
                        : creators.length === 0
                          ? 'Start by adding creators to follow their content'
                          : "Content from your creators will appear here once it's fetched"}
                    </p>
                  </div>
                  {searchQuery ? (
                    <Button
                      onClick={() => setSearchQuery('')}
                      variant="outline"
                    >
                      <XIcon className="w-4 h-4 mr-2" />
                      Clear search
                    </Button>
                  ) : (
                    creators.length === 0 &&
                    canManageCreators && (
                      <Button onClick={handleCreateCreator} size="lg">
                        <PlusCircle className="w-5 h-5 mr-2" />
                        Add Your First Creator
                      </Button>
                    )
                  )}
                  {creators.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        You're following {creators.length} creator
                        {creators.length !== 1 ? 's' : ''}. New content will be
                        fetched automatically.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : isLoadingContent && filteredContent.length === 0 ? (
              // Loading state
              <div className="flex items-center justify-center py-16 max-w-3xl mx-auto">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-800"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
                </div>
              </div>
            ) : (
              // Content feed with ultra-smooth virtualization
              <div>
                <IntersectionObserverGrid
                  items={filteredContent}
                  creators={creators}
                  hasMore={hasMore}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                  saveContent={saveContent}
                  unsaveContent={unsaveContent}
                  deleteContent={handleDeleteContent}
                  undeleteContent={handleUndeleteContent}
                  canManageCreators={canManageCreators}
                  showVideoEmbeds={showVideoEmbeds}
                />
              </div>
            )}
          </main>
          <BackToTop />
        </SidebarInset>
      </div>
      <TopicManagementModal
        open={isTopicModalOpen}
        onOpenChange={setTopicModalOpen}
        topic={selectedTopic || undefined}
        onSuccess={() => {
          refreshLounges();
          refreshContent();
        }}
      />
      <AddCreatorModal
        open={isCreatorModalOpen}
        onOpenChange={setCreatorModalOpen}
        onCreatorAdded={() => {
          fetchCreators();
          refreshLounges(); // Refresh lounges to update counts
        }}
        mode={creatorModalMode}
        creator={selectedCreator || undefined}
        selectedLoungeId={selectedLoungeId}
      />
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lounge</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{selectedTopic?.name}"
              lounge? This will remove it from your sidebar, but any creators
              assigned to this lounge will remain in your system. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!selectedTopic) return;

                try {
                  const response = await fetch(
                    `/api/lounges/${selectedTopic.id}`,
                    {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                    }
                  );

                  if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to delete lounge');
                  }

                  toast.success(`${selectedTopic.name} has been deleted`);
                  setDeleteDialogOpen(false);
                  setSelectedTopic(null);
                  refreshLounges();
                  // Clear selection if this lounge was selected
                  if (selectedLoungeId === selectedTopic.id) {
                    setSelectedLoungeId(null);
                  }
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Failed to delete lounge'
                  );
                }
              }}
            >
              Delete Lounge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={isDeleteCreatorDialogOpen}
        onOpenChange={setDeleteCreatorDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Creator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold">{creatorToDelete?.name}</span>?
              This will remove them from your feed and delete all their saved
              content. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteCreatorDialogOpen(false);
                setCreatorToDelete(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              onClick={confirmDeleteCreator}
            >
              Delete Creator
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MobileFiltersSheet
        open={isMobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        creators={creators}
        lounges={lounges}
        selectedLoungeId={selectedLoungeId}
        setSelectedLoungeId={setSelectedLoungeId}
        platformData={platformData}
        selectedPlatforms={selectedPlatforms}
        onPlatformToggle={handlePlatformToggle}
      />
    </SidebarProvider>
  );
}
