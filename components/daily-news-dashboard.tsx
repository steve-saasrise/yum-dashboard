'use client';

import * as React from 'react';
import Link from 'next/link';
import { useAuth, useProfile } from '@/hooks/use-auth';
import { useCuratorAuth } from '@/hooks/use-curator-auth';
import { useContent } from '@/hooks/use-content';
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
  User,
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
} from 'lucide-react';
import { AddCreatorModal } from '@/components/creators/add-creator-modal';
import { InfiniteScrollSentinel } from '@/components/infinite-scroll-sentinel';
import { BackToTop } from '@/components/back-to-top';
import { AISummary, AISummaryCompact } from '@/components/ui/ai-summary';
import {
  ContentSkeleton,
  ContentSkeletonList,
} from '@/components/content-skeleton';
import { LoungeLogo } from '@/components/lounge-logo';

// --- MOCK DATA ---

const platforms = [
  { name: 'YouTube', icon: Youtube, count: 12 },
  { name: 'X', icon: Icons.x, count: 8 },
  { name: 'LinkedIn', icon: Linkedin, count: 5 },
  { name: 'Threads', icon: Icons.threads, count: 3 },
  { name: 'Blogs', icon: Rss, count: 22 },
];

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
  onCreatorEdit: (creator: {
    id: string;
    name: string;
    platform: string;
    handle: string;
  }) => void;
  onCreatorDelete: (creator: { id: string; name: string }) => void;
  creators: Array<{
    id: string;
    name: string;
    platform: string;
    handle: string;
    category?: string;
    isActive?: boolean;
    lastFetchedAt?: string;
  }>;
  isLoadingCreators: boolean;
  lounges: Lounge[];
  isLoadingLounges: boolean;
  selectedLoungeId: string | null;
  onLoungeSelect: (loungeId: string | null) => void;
}

function AppSidebar({
  onTopicCreate,
  onTopicEdit,
  onTopicDelete,
  onCreatorCreate,
  onCreatorEdit,
  onCreatorDelete,
  creators,
  isLoadingCreators,
  lounges,
  isLoadingLounges,
  selectedLoungeId,
  onLoungeSelect,
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" side="left">
      <SidebarHeader className="h-16 px-4 flex items-center justify-center border-b border-gray-200 dark:border-gray-800">
        <LoungeLogo className="h-6 w-auto text-gray-900 dark:text-white" />
      </SidebarHeader>

      <SidebarContent className="p-2 stable-scrollbar sidebar-scrollbar">
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
                <SidebarMenuButton tooltip="Add Lounge" onClick={onTopicCreate}>
                  <PlusCircle className="w-4 h-4" />
                  <span className="truncate">Add Lounge</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />

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
                  {platforms.map((platform) => (
                    <SidebarMenuItem key={platform.name}>
                      <SidebarMenuButton tooltip={platform.name}>
                        <platform.icon className="w-4 h-4" />
                        <span className="truncate">{platform.name}</span>
                        <SidebarMenuBadge>{platform.count}</SidebarMenuBadge>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Topics Section */}
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
                        className="group/topic-item"
                      >
                        <SidebarMenuButton
                          tooltip={lounge.name}
                          onClick={() =>
                            onLoungeSelect(
                              selectedLoungeId === lounge.id ? null : lounge.id
                            )
                          }
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
                          <span className="truncate">{lounge.name}</span>
                          <SidebarMenuBadge className="group-hover/topic-item:opacity-0 transition-opacity duration-200">
                            {lounge.creator_count || 0}
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/topic-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
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
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Creators Section */}
        <SidebarGroup>
          <Collapsible defaultOpen>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="w-full flex items-center justify-between hover:bg-sidebar-accent rounded-md px-2 py-1 transition-colors duration-200 group">
                <span>Creators</span>
                <ChevronDown className="h-4 w-4 transition-transform duration-300 ease-in-out group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent className="transition-all duration-300 ease-in-out data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden">
              <SidebarGroupContent>
                <SidebarMenu>
                  {isLoadingCreators ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Loading...
                    </div>
                  ) : creators.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      No creators yet
                    </div>
                  ) : (
                    creators.map((creator) => {
                      const lastFetched = creator.lastFetchedAt
                        ? new Date(creator.lastFetchedAt)
                        : null;
                      const now = new Date();
                      const timeDiff = lastFetched
                        ? now.getTime() - lastFetched.getTime()
                        : null;
                      const hoursAgo = timeDiff
                        ? Math.floor(timeDiff / (1000 * 60 * 60))
                        : null;
                      const minutesAgo = timeDiff
                        ? Math.floor(
                            (timeDiff % (1000 * 60 * 60)) / (1000 * 60)
                          )
                        : null;

                      let lastFetchedText = 'Never fetched';
                      if (lastFetched && hoursAgo !== null) {
                        if (hoursAgo === 0) {
                          if (minutesAgo === 0) {
                            lastFetchedText = 'Just now';
                          } else {
                            lastFetchedText = `${minutesAgo}m ago`;
                          }
                        } else if (hoursAgo < 24) {
                          lastFetchedText = `${hoursAgo}h ago`;
                        } else {
                          const daysAgo = Math.floor(hoursAgo / 24);
                          lastFetchedText = `${daysAgo}d ago`;
                        }
                      }

                      return (
                        <SidebarMenuItem
                          key={creator.id}
                          className="group/creator-item"
                        >
                          <SidebarMenuButton
                            tooltip={`${creator.name} - Last updated: ${lastFetchedText}`}
                          >
                            <div className="relative">
                              <Avatar className="w-5 h-5">
                                <AvatarImage
                                  src={'/placeholder.svg'}
                                  alt={creator.name}
                                />
                                <AvatarFallback className="text-xs">
                                  {creator.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-white ${creator.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">
                                {creator.name}
                              </span>
                            </div>
                          </SidebarMenuButton>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover/creator-item:opacity-100 transition-opacity duration-200 group-data-[collapsible=icon]:hidden"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="right" align="start">
                              <DropdownMenuItem
                                onClick={() => onCreatorEdit(creator)}
                              >
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => onCreatorDelete(creator)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
}: {
  onSignOut: () => void;
  onRefresh?: () => void;
}) {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  // Use curator auth instead of user profile
  const { curator } = useCuratorAuth();

  const getInitials = (email?: string) => {
    if (!email) return 'C';
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
          {onRefresh && (
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
                alt={curator?.email || 'Curator'}
              />
              <AvatarFallback>{getInitials(curator?.email)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">Curator</p>
                <p className="text-xs text-muted-foreground">
                  {curator?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {curator?.is_admin && (
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

function ContentCard({
  item,
  creators,
  onSave,
  onUnsave,
}: {
  item: FeedItem;
  creators: Creator[];
  onSave?: (id: string) => Promise<void>;
  onUnsave?: (id: string) => Promise<void>;
}) {
  const [bookmarked, setBookmarked] = React.useState(item.is_saved || false);
  const [isLoading, setIsLoading] = React.useState(true);
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
    <Card className="overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 flex flex-col">
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
}

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

// --- NEW: Content List Item Component ---
function ContentListItem({
  item,
  creators,
  onSave,
  onUnsave,
}: {
  item: FeedItem;
  creators: Creator[];
  onSave?: (id: string) => Promise<void>;
  onUnsave?: (id: string) => Promise<void>;
}) {
  const [bookmarked, setBookmarked] = React.useState(item.is_saved || false);
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
    <Card className="overflow-hidden transition-all hover:shadow-md dark:bg-gray-800/50 w-full">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MobileFiltersSheet({
  open,
  onOpenChange,
  creators,
  lounges,
  selectedLoungeId,
  setSelectedLoungeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creators: Creator[];
  lounges: Lounge[];
  selectedLoungeId: string | null;
  setSelectedLoungeId: (id: string | null) => void;
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
                {platforms.map((p) => (
                  <div key={p.name} className="flex items-center space-x-2">
                    <Checkbox id={`mobile-platform-${p.name}`} />
                    <label
                      htmlFor={`mobile-platform-${p.name}`}
                      className="text-sm font-medium leading-none"
                    >
                      {p.name}
                    </label>
                  </div>
                ))}
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
  const { logout: curatorLogout } = useCuratorAuth();

  const handleSignOut = async () => {
    await curatorLogout();
  };
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [isTopicModalOpen, setTopicModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [selectedTopic, setSelectedTopic] =
    React.useState<SidebarLounge | null>(null);
  const [selectedCreator, setSelectedCreator] = React.useState<Creator | null>(
    null
  );
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

  // Use the content hook to fetch real content
  const {
    content,
    loading: isLoadingContent,
    hasMore,
    saveContent,
    unsaveContent,
    refreshContent,
    loadMore,
  } = useContent({
    lounge_id: selectedLoungeId || undefined,
  });

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
  const handleDeleteCreator = async (creator: { id: string; name: string }) => {
    if (!confirm(`Are you sure you want to delete ${creator.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/creators/${creator.id}`, {
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
      setCreators((prev) => prev.filter((c) => c.id !== creator.id));
      toast.success(`${creator.name} has been deleted`);
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
        setCreators(data.data?.creators || []);
      }
    } catch {
      // Error fetching creators - handled by loading state
    } finally {
      setIsLoadingCreators(false);
    }
  }, [selectedLoungeId]);

  // Fetch creators on mount and when user/session changes
  React.useEffect(() => {
    fetchCreators();
  }, [fetchCreators]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar
          onTopicCreate={handleCreateTopic}
          onTopicEdit={handleEditTopic}
          onTopicDelete={handleDeleteTopic}
          onCreatorCreate={handleCreateCreator}
          onCreatorEdit={handleEditCreator}
          onCreatorDelete={handleDeleteCreator}
          creators={creators.map((c) => ({
            id: c.id,
            name: c.display_name,
            platform: c.platform || 'website',
            handle: c.platform_user_id || c.display_name,
            category: c.lounges?.[0],
            isActive: c.is_active,
            lastFetchedAt: c.metadata?.last_fetched_at as string | undefined,
          }))}
          isLoadingCreators={isLoadingCreators}
          lounges={lounges}
          isLoadingLounges={isLoadingLounges}
          selectedLoungeId={selectedLoungeId}
          onLoungeSelect={setSelectedLoungeId}
        />
        <SidebarInset className="flex-1 flex flex-col w-full">
          <Header onSignOut={handleSignOut} onRefresh={refreshContent} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-950">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Your Feed
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
                          {platforms.map((p) => (
                            <DropdownMenuCheckboxItem key={p.name}>
                              {p.name}
                            </DropdownMenuCheckboxItem>
                          ))}
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
            {content.length === 0 && !isLoadingContent ? (
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
                  {creators.length === 0 && (
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
                      <Button variant="outline" onClick={refreshContent}>
                        <Brain className="w-4 h-4 mr-2" />
                        Refresh & Generate AI Summaries
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : isLoadingContent ? (
              // Loading state
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
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
                ))}
              </div>
            ) : (
              // Content feed
              <>
                <div className="lg:hidden">
                  <div className="grid grid-cols-1 gap-6">
                    {content.map((item) => (
                      <ContentCard
                        key={item.id}
                        item={{
                          id: item.id,
                          title: item.title || '',
                          description: item.description,
                          ai_summary: item.ai_summary,
                          ai_summary_short: item.ai_summary_short,
                          ai_summary_long: item.ai_summary_long,
                          summary_generated_at: item.summary_generated_at,
                          summary_model: item.summary_model,
                          summary_status: item.summary_status,
                          summary_error_message: item.summary_error_message,
                          url: item.url,
                          platform: item.platform,
                          creator_id: item.creator_id,
                          creator: item.creator,
                          published_at: item.published_at || item.created_at,
                          is_saved: item.is_saved,
                          topics: item.topics,
                        }}
                        creators={creators}
                        onSave={saveContent}
                        onUnsave={unsaveContent}
                      />
                    ))}
                  </div>
                </div>
                <div className="hidden lg:block">
                  {view === 'grid' ? (
                    <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                      {content.map((item) => (
                        <ContentCard
                          key={item.id}
                          item={{
                            id: item.id,
                            title: item.title || '',
                            description: item.description,
                            ai_summary: item.ai_summary,
                            ai_summary_short: item.ai_summary_short,
                            ai_summary_long: item.ai_summary_long,
                            summary_generated_at: item.summary_generated_at,
                            summary_model: item.summary_model,
                            summary_status: item.summary_status,
                            summary_error_message: item.summary_error_message,
                            url: item.url,
                            platform: item.platform,
                            creator_id: item.creator_id,
                            creator: item.creator,
                            published_at: item.published_at || item.created_at,
                            is_saved: item.is_saved,
                            topics: item.topics,
                          }}
                          creators={creators}
                          onSave={saveContent}
                          onUnsave={unsaveContent}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 w-full">
                      {content.map((item) => (
                        <ContentListItem
                          key={item.id}
                          item={{
                            id: item.id,
                            title: item.title || '',
                            description: item.description,
                            ai_summary: item.ai_summary,
                            ai_summary_short: item.ai_summary_short,
                            ai_summary_long: item.ai_summary_long,
                            summary_generated_at: item.summary_generated_at,
                            summary_model: item.summary_model,
                            summary_status: item.summary_status,
                            summary_error_message: item.summary_error_message,
                            url: item.url,
                            platform: item.platform,
                            creator_id: item.creator_id,
                            creator: item.creator,
                            published_at: item.published_at || item.created_at,
                            is_saved: item.is_saved,
                            topics: item.topics,
                          }}
                          creators={creators}
                          onSave={saveContent}
                          onUnsave={unsaveContent}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {/* Infinite scroll sentinel and loading skeletons */}
                <InfiniteScrollSentinel
                  onLoadMore={loadMore}
                  hasMore={hasMore}
                  loading={isLoadingContent}
                />
                {/* Show skeletons while loading more content */}
                {isLoadingContent && content.length > 0 && (
                  <div className="lg:hidden">
                    <div className="grid grid-cols-1 gap-6">
                      {[...Array(3)].map((_, i) => (
                        <ContentSkeleton key={`mobile-skeleton-${i}`} />
                      ))}
                    </div>
                  </div>
                )}
                {isLoadingContent && content.length > 0 && (
                  <div className="hidden lg:block">
                    {view === 'grid' ? (
                      <div className="grid grid-cols-2 xl:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                          <ContentSkeleton key={`desktop-skeleton-${i}`} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4 w-full">
                        {[...Array(4)].map((_, i) => (
                          <ContentSkeletonList key={`list-skeleton-${i}`} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
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
      <MobileFiltersSheet
        open={isMobileFiltersOpen}
        onOpenChange={setMobileFiltersOpen}
        creators={creators}
        lounges={lounges}
        selectedLoungeId={selectedLoungeId}
        setSelectedLoungeId={setSelectedLoungeId}
      />
    </SidebarProvider>
  );
}
