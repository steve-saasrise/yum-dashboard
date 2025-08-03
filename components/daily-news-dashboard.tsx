'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useInfiniteContent } from '@/hooks/use-infinite-content';
import { useLounges } from '@/hooks/use-lounges';
import type { Creator, Platform } from '@/types/creator';
import type { Lounge } from '@/types/lounge';
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
  LayoutGrid,
  List,
  Bell,
  Filter,
  MoreHorizontal,
  Youtube,
  Linkedin,
  Brain,
  Loader2,
  UserCog,
  X as XIcon,
} from 'lucide-react';
import { AddCreatorModal } from '@/components/creators/add-creator-modal';
import { BackToTop } from '@/components/back-to-top';
import { AISummary } from '@/components/ui/ai-summary';
import { LoungeLogo } from '@/components/lounge-logo';
import { IntersectionObserverGrid } from '@/components/intersection-observer-grid';

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
  ai_summary?: string; // Deprecated
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
  onTopicEdit: (topic: { id: number; name: string; color?: string }) => void;
  onTopicDelete: (topic: { id: number; name: string; color?: string }) => void;
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
      <SidebarHeader className="h-16 px-4 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => {
            onLoungeSelect(null);
            onClearPlatforms();
          }}
          className="flex items-center cursor-pointer focus:outline-none"
        >
          <LoungeLogo className="h-6 w-auto text-gray-900 dark:text-white" />
        </button>
      </SidebarHeader>

      <SidebarContent className="p-2 stable-scrollbar sidebar-scrollbar">
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
                        className="group/topic-item relative"
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
                          <span className="truncate">{lounge.name}Lounge</span>
                          <SidebarMenuBadge className="md:group-hover/topic-item:opacity-0 md:transition-opacity md:duration-200">
                            {lounge.creator_count || 0}
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                        {canManageCreators && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover/topic-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                onClick={() =>
                                  onTopicEdit({
                                    id: parseInt(lounge.id),
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
                                    id: parseInt(lounge.id),
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
  onRefresh,
  canManageCreators,
}: {
  onSignOut: () => void;
  onRefresh?: () => void;
  canManageCreators: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  // Use unified auth with user profile
  const { state } = useAuth();
  const { user } = state;

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
        <div className="relative w-full max-w-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Search content, creators, topics..."
            className="pl-9 bg-gray-100 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-900 focus:border-primary"
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          />
          {showSuggestions && (
            <Card className="absolute top-full mt-2 w-full z-50">
              <CardContent className="p-2">
                <p className="text-xs text-gray-500 p-2">Suggestions</p>
                <Button variant="ghost" className="w-full justify-start">
                  AI Startups
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Naval Ravikant
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Future of Work
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <div className="flex items-center">
          {onRefresh && canManageCreators && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-500 hover:text-gray-900 dark:hover:text-white"
                    onClick={onRefresh}
                  >
                    <Brain className="h-5 w-5" />
                    <span className="sr-only">
                      Refresh content with AI summaries
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Refresh content & generate AI summaries</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
                <p className="text-sm font-medium">Curator</p>
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
            <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export const ContentCard = React.memo(function ContentCard({
  item,
  creators,
  onSave,
  onUnsave,
  onDelete,
  onUndelete,
  canDelete,
}: {
  item: FeedItem;
  creators: Creator[];
  onSave?: (id: string) => Promise<void>;
  onUnsave?: (id: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onUndelete?: (id: string) => Promise<void>;
  canDelete?: boolean;
}) {
  const [bookmarked, setBookmarked] = React.useState(item.is_saved || false);
  const [isLoading, setIsLoading] = React.useState(true);
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
            {item.title}
          </h3>
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic?: SidebarLounge;
}) {
  const isEditing = !!topic;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Topic' : 'Create New Topic'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update the details for the "${topic?.name}" topic.`
              : 'Add a new topic to categorize content.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              defaultValue={topic?.name || ''}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              defaultValue={topic?.description || ''}
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button>{isEditing ? 'Save Changes' : 'Create Topic'}</Button>
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
                      {lounge.name}
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
    await signOut();
    window.location.href = '/';
  };
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
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
  const [platformData, setPlatformData] = React.useState<
    Array<{
      name: string;
      platform: string;
      count: number;
    }>
  >([]);
  const [isLoadingPlatforms, setIsLoadingPlatforms] = React.useState(true);

  // Get viewport width for responsive columns
  const [columns, setColumns] = React.useState(3);

  React.useEffect(() => {
    const updateColumns = () => {
      const width = window.innerWidth;
      if (width < 1024) {
        setColumns(1); // Mobile
      } else if (width < 1280) {
        setColumns(2); // Desktop lg
      } else {
        setColumns(3); // Desktop xl
      }
    };

    updateColumns();
    window.addEventListener('resize', updateColumns);
    return () => window.removeEventListener('resize', updateColumns);
  }, []);

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
  } = useInfiniteContent({
    lounge_id: selectedLoungeId || undefined,
    platforms:
      selectedPlatforms.length > 0 ? (selectedPlatforms as any) : undefined,
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
    id: number;
    name: string;
    color?: string;
  }) => {
    // Convert to Topic type
    const fullTopic: SidebarLounge = {
      id: String(topic.id),
      name: topic.name,
      slug: topic.name.toLowerCase().replace(/\s+/g, '-'),
      color: topic.color,
    };
    setSelectedTopic(fullTopic);
    setTopicModalOpen(true);
  };

  const handleDeleteTopic = (topic: {
    id: number;
    name: string;
    color?: string;
  }) => {
    // Convert to Topic type
    const fullTopic: SidebarLounge = {
      id: String(topic.id),
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
        <SidebarInset className="flex-1 flex flex-col w-full">
          <Header
            onSignOut={handleSignOut}
            onRefresh={refreshContent}
            canManageCreators={canManageCreators}
          />
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-950">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {lounges.find((l) => l.id === selectedLoungeId)?.name
                  ? `${lounges.find((l) => l.id === selectedLoungeId)?.name}Lounge`
                  : 'Your Lounge'}
              </h1>
              <div className="flex items-center gap-2">
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
                              {lounge.name}
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

                {/* View Toggle Buttons */}
                <div className="hidden lg:flex items-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-9 w-9 ${view === 'list' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-transparent'}`}
                          onClick={() => setView('list')}
                        >
                          <List className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>List View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className={`h-9 w-9 ${view === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : 'bg-transparent'}`}
                          onClick={() => setView('grid')}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Grid View</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
            {filteredContent.length === 0 && !isLoadingContent ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="max-w-md text-center space-y-6">
                  <div className="w-20 h-20 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                    <Rss className="w-10 h-10 text-gray-400" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                      No content yet
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {creators.length === 0
                        ? 'Start by adding creators to follow their content'
                        : "Content from your creators will appear here once it's fetched"}
                    </p>
                  </div>
                  {creators.length === 0 && canManageCreators && (
                    <Button onClick={handleCreateCreator} size="lg">
                      <PlusCircle className="w-5 h-5 mr-2" />
                      Add Your First Creator
                    </Button>
                  )}
                  {creators.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        You're following {creators.length} creator
                        {creators.length !== 1 ? 's' : ''}. New content will be
                        fetched automatically.
                      </p>
                      {canManageCreators && (
                        <Button
                          variant="outline"
                          onClick={() => refreshContent()}
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Refresh & Generate AI Summaries
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : isLoadingContent && filteredContent.length === 0 ? (
              // Loading state
              <div className="flex items-center justify-center py-16">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-gray-200 dark:border-gray-800"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
                </div>
              </div>
            ) : (
              // Content feed with ultra-smooth virtualization
              <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.6)*2-theme(spacing.6)-60px)]">
                <IntersectionObserverGrid
                  items={filteredContent}
                  creators={creators}
                  view={view}
                  columns={columns}
                  hasMore={hasMore}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                  saveContent={saveContent}
                  unsaveContent={unsaveContent}
                  deleteContent={handleDeleteContent}
                  undeleteContent={handleUndeleteContent}
                  canManageCreators={canManageCreators}
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
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the "
              {selectedTopic?.name}" topic.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700">
              Delete
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
