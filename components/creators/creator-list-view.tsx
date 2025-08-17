'use client';

import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { useLounges } from '@/hooks/use-lounges';
import { useCreators } from '@/hooks/use-creators';
import { useAuth } from '@/hooks/use-auth';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import type {
  Creator,
  CreatorFilters as CreatorFiltersType,
} from '@/types/creator';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Youtube,
  Linkedin,
  Rss,
  AtSign,
  Filter,
  Search,
  RefreshCw,
  ChevronDown,
  Trash2,
  Power,
  Plus,
  Globe,
  Edit,
} from 'lucide-react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { AddCreatorModal } from './add-creator-modal';

// Platform icons mapping
const platformIcons = {
  youtube: Youtube,
  twitter: Icons.x,
  x: Icons.x,
  linkedin: Linkedin,
  threads: Icons.threads,
  rss: Rss,
  website: Globe,
};

// Get platform display name
const getPlatformDisplayName = (platform: string) => {
  if (platform?.toLowerCase() === 'twitter') return 'X';
  if (platform?.toLowerCase() === 'x') return 'X';
  return platform?.charAt(0).toUpperCase() + platform?.slice(1) || 'Website';
};

// Search component with debouncing - Memoized to prevent re-renders
const CreatorSearch = memo(function CreatorSearch({
  value,
  onChange,
  placeholder = 'Search creators...',
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isLoading?: boolean;
}) {
  const [localValue, setLocalValue] = useState(value);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Update local value when prop changes (for external updates like clear)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set new timeout for debounced update
      timeoutRef.current = setTimeout(() => {
        onChange(newValue);
      }, 600);
    },
    [onChange]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={handleChange}
        className="pl-9 pr-9"
        disabled={isLoading}
      />
      {isLoading && localValue && (
        <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
    </div>
  );
});

// Filter component
function CreatorFilters({
  filters,
  onFiltersChange,
  onClearFilters,
}: {
  filters: CreatorFiltersType;
  onFiltersChange: (filters: Partial<CreatorFiltersType>) => void;
  onClearFilters: () => void;
}) {
  const platforms = [
    { value: 'youtube', label: 'YouTube' },
    { value: 'twitter', label: 'X' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'threads', label: 'Threads' },
    { value: 'rss', label: 'RSS' },
  ];

  // Use dynamic lounges from the database
  const { lounges: dynamicLounges, loading: loungesLoading } = useLounges();
  const lounges = dynamicLounges.map((lounge) => ({
    value: lounge.id,
    label: lounge.name,
  }));

  const hasActiveFilters =
    filters.platform || filters.lounge || filters.status !== 'all';

  return (
    <div className="flex flex-wrap gap-2">
      {/* Platform Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="platform-filter">
            <Filter className="h-4 w-4 mr-2" />
            Platform
            {filters.platform && (
              <Badge variant="secondary" className="ml-2">
                {filters.platform}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => onFiltersChange({ platform: undefined })}
          >
            All Platforms
          </DropdownMenuItem>
          {platforms.map((platform) => (
            <DropdownMenuItem
              key={platform.value}
              onClick={() =>
                onFiltersChange({
                  platform: platform.value as CreatorFiltersType['platform'],
                })
              }
            >
              {platform.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Topic Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            data-testid="lounge-filter"
            disabled={loungesLoading}
          >
            Lounge
            {filters.lounge && (
              <Badge variant="secondary" className="ml-2">
                {lounges.find((l) => l.value === filters.lounge)?.label ||
                  filters.lounge}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onClick={() => onFiltersChange({ lounge: undefined })}
          >
            All Lounges
          </DropdownMenuItem>
          {lounges.map((lounge) => (
            <DropdownMenuItem
              key={lounge.value}
              onClick={() => onFiltersChange({ lounge: lounge.value })}
            >
              {lounge.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="status-filter">
            Status
            {filters.status !== 'all' && (
              <Badge variant="secondary" className="ml-2">
                {filters.status}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onFiltersChange({ status: 'all' })}>
            All
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onFiltersChange({ status: 'active' })}
          >
            Active Only
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onFiltersChange({ status: 'inactive' })}
          >
            Inactive Only
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// Table view for desktop
function CreatorTable({
  creators,
  selectedCreators,
  onSelectCreator,
  onSelectAll,
  onSort,
  sortField,
  sortOrder,
  onEdit,
  onDelete,
  canManageCreators,
}: {
  creators: Creator[];
  selectedCreators: Set<string>;
  onSelectCreator: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onSort: (field: string) => void;
  sortField?: string;
  sortOrder?: string;
  onEdit?: (creator: Creator) => void;
  onDelete?: (id: string) => void;
  canManageCreators: boolean;
}) {
  const allSelected =
    creators.length > 0 && creators.every((c) => selectedCreators.has(c.id));

  return (
    <div data-testid="creators-table">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={onSelectAll}
                data-testid="select-all"
              />
            </TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => onSort('display_name')}
              data-testid="sort-name"
            >
              Name
              {sortField === 'display_name' && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Lounges</TableHead>
            <TableHead>Status</TableHead>
            <TableHead
              className="cursor-pointer"
              onClick={() => onSort('created_at')}
              data-testid="sort-created"
            >
              Created
              {sortField === 'created_at' && (
                <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
              )}
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {creators.map((creator) => {
            const Icon =
              creator.platform && creator.platform in platformIcons
                ? platformIcons[creator.platform as keyof typeof platformIcons]
                : platformIcons.website;
            return (
              <TableRow key={creator.id}>
                <TableCell>
                  <Checkbox
                    checked={selectedCreators.has(creator.id)}
                    onCheckedChange={(checked) =>
                      onSelectCreator(creator.id, !!checked)
                    }
                    data-testid="creator-checkbox"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={creator.avatar_url} />
                      <AvatarFallback>
                        {creator.display_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{creator.display_name}</div>
                      {creator.bio && (
                        <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {creator.bio}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>
                      {getPlatformDisplayName(creator.platform || 'website')}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {creator.lounges?.slice(0, 2).map((lounge, index) => {
                      const loungeName = typeof lounge === 'string' ? lounge : lounge.name;
                      const key = typeof lounge === 'string' ? lounge : lounge.id;
                      return (
                        <Badge
                          key={key || index}
                          variant="secondary"
                          className="text-xs"
                        >
                          {loungeName}
                        </Badge>
                      );
                    })}
                    {creator.lounges && creator.lounges.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{creator.lounges.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        creator.is_active ? 'bg-green-500' : 'bg-gray-400'
                      )}
                    />
                    <span className="text-sm">
                      {creator.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(creator.created_at).toLocaleDateString()}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {canManageCreators && (
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit?.(creator)}
                        className="h-8 w-8"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete?.(creator.id)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Card view for mobile
function CreatorCards({
  creators,
  selectedCreators,
  onSelectCreator,
  onEdit,
  onDelete,
  canManageCreators,
}: {
  creators: Creator[];
  selectedCreators: Set<string>;
  onSelectCreator: (id: string, selected: boolean) => void;
  onEdit?: (creator: Creator) => void;
  onDelete?: (id: string) => void;
  canManageCreators: boolean;
}) {
  return (
    <div className="grid gap-4" data-testid="creators-cards">
      {creators.map((creator) => {
        const Icon =
          creator.platform && creator.platform in platformIcons
            ? platformIcons[creator.platform as keyof typeof platformIcons]
            : platformIcons.website;
        return (
          <Card key={creator.id} className="p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedCreators.has(creator.id)}
                onCheckedChange={(checked) =>
                  onSelectCreator(creator.id, !!checked)
                }
                data-testid="creator-checkbox"
              />
              <Avatar className="h-10 w-10">
                <AvatarImage src={creator.avatar_url} />
                <AvatarFallback>
                  {creator.display_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium truncate">
                    {creator.display_name}
                  </h4>
                  <div className="flex items-center gap-1">
                    <Icon className="h-4 w-4" />
                    <div
                      className={cn(
                        'h-2 w-2 rounded-full',
                        creator.is_active ? 'bg-green-500' : 'bg-gray-400'
                      )}
                    />
                  </div>
                </div>
                {creator.bio && (
                  <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                    {creator.bio}
                  </p>
                )}
                <div className="flex flex-wrap gap-1">
                  {creator.lounges?.slice(0, 3).map((lounge, index) => {
                    const loungeName = typeof lounge === 'string' ? lounge : lounge.name;
                    const key = typeof lounge === 'string' ? lounge : lounge.id;
                    return (
                      <Badge key={key || index} variant="secondary" className="text-xs">
                        {loungeName}
                      </Badge>
                    );
                  })}
                </div>
              </div>
              {canManageCreators && (
                <div className="flex items-center gap-1 ml-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit?.(creator)}
                    className="h-8 w-8"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete?.(creator.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Main Creator List View component
export function CreatorListView() {
  const {
    creators,
    loading,
    error,
    filters,
    pagination,
    updateFilters,
    clearFilters,
    refreshCreators,
  } = useCreators();

  const { state: authState } = useAuth();
  const userRole = authState.profile?.role;
  const canManageCreators = userRole === 'curator' || userRole === 'admin';

  const [selectedCreators, setSelectedCreators] = useState<Set<string>>(
    new Set()
  );
  const { toast } = useToast();

  const [isMobile, setIsMobile] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedCreatorForEdit, setSelectedCreatorForEdit] = useState<
    Creator | undefined
  >(undefined);

  const selectCreator = useCallback((creatorId: string, selected: boolean) => {
    setSelectedCreators((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(creatorId);
      } else {
        newSet.delete(creatorId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(
    (selected: boolean) => {
      if (selected) {
        setSelectedCreators(new Set(creators.map((c) => c.id)));
      } else {
        setSelectedCreators(new Set());
      }
    },
    [creators]
  );

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSort = useCallback(
    (field: string) => {
      const newOrder =
        filters.sort === field && filters.order === 'asc' ? 'desc' : 'asc';
      updateFilters({
        sort: field as CreatorFiltersType['sort'],
        order: newOrder,
      });
      setSelectedCreators(new Set());
    },
    [filters.sort, filters.order, updateFilters]
  );

  const handlePageChange = useCallback(
    (page: number) => {
      updateFilters({ page });
    },
    [updateFilters]
  );

  const handleEditCreator = useCallback((creator: Creator) => {
    setSelectedCreatorForEdit(creator);
    setModalMode('edit');
    setShowAddModal(true);
  }, []);

  const handleAddCreator = useCallback(() => {
    setSelectedCreatorForEdit(undefined);
    setModalMode('add');
    setShowAddModal(true);
  }, []);

  const handleDeleteCreator = useCallback(
    async (creatorId: string) => {
      try {
        const supabase = createBrowserSupabaseClient();
        const { error } = await supabase
          .from('creators')
          .delete()
          .eq('id', creatorId);

        if (error) {
          throw error;
        }

        toast({
          title: 'Creator deleted',
          description: 'The creator has been successfully removed.',
        });

        refreshCreators();
      } catch (error) {
        toast({
          title: 'Failed to delete creator',
          description:
            error instanceof Error
              ? error.message
              : 'An error occurred while deleting the creator',
          variant: 'destructive',
        });
      }
    },
    [refreshCreators, toast]
  );

  // Stable callback for search to prevent input focus loss
  const handleSearchChange = useCallback(
    (search: string) => {
      updateFilters({ search });
    },
    [updateFilters]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedCreators.size === 0) return;

    try {
      const supabase = createBrowserSupabaseClient();
      const creatorIds = Array.from(selectedCreators);

      const { error } = await supabase
        .from('creators')
        .delete()
        .in('id', creatorIds);

      if (error) {
        throw error;
      }

      toast({
        title: 'Creators deleted',
        description: `${selectedCreators.size} creator(s) have been successfully removed.`,
      });

      setSelectedCreators(new Set());
      refreshCreators();
    } catch (error) {
      toast({
        title: 'Failed to delete creators',
        description:
          error instanceof Error
            ? error.message
            : 'An error occurred while deleting the creators',
        variant: 'destructive',
      });
    }
  }, [selectedCreators, refreshCreators, toast]);

  if (loading && creators.length === 0) {
    return (
      <div className="space-y-4" data-testid="creators-loading">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    const isAuthError = error.includes('sign in');
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <p className="text-lg font-medium text-destructive">
          {isAuthError ? 'Authentication Required' : 'Failed to load creators'}
        </p>
        <p className="text-sm text-muted-foreground">{error}</p>
        {isAuthError ? (
          <Button
            onClick={() => (window.location.href = '/auth/login')}
            variant="default"
          >
            Sign In
          </Button>
        ) : (
          <Button onClick={refreshCreators} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Creators</h1>
        <div className="flex items-center gap-3">
          <CreatorSearch
            value={filters.search || ''}
            onChange={handleSearchChange}
            isLoading={false} // Never disable the search input
          />
          {canManageCreators && (
            <Button onClick={handleAddCreator}>
              <Plus className="h-4 w-4 mr-2" />
              Add Creator
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <CreatorFilters
        filters={filters}
        onFiltersChange={updateFilters}
        onClearFilters={clearFilters}
      />

      {/* Empty State */}
      {creators.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <h3 className="text-lg font-medium">No creators found</h3>
          <p className="text-sm text-muted-foreground">
            Add your first creator to get started
          </p>
          {canManageCreators && (
            <Button onClick={handleAddCreator}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Creator
            </Button>
          )}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedCreators.size > 0 && canManageCreators && (
        <div
          className="flex items-center gap-4 p-4 bg-muted rounded-lg"
          data-testid="bulk-actions"
        >
          <span className="text-sm font-medium">
            {selectedCreators.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="outline" size="sm">
              <Power className="h-4 w-4 mr-2" />
              Toggle Status
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      {creators.length > 0 && (
        <>
          {isMobile ? (
            <CreatorCards
              creators={creators}
              selectedCreators={selectedCreators}
              onSelectCreator={selectCreator}
              onEdit={handleEditCreator}
              onDelete={handleDeleteCreator}
              canManageCreators={canManageCreators}
            />
          ) : (
            <CreatorTable
              creators={creators}
              selectedCreators={selectedCreators}
              onSelectCreator={selectCreator}
              onSelectAll={selectAll}
              onSort={handleSort}
              sortField={filters.sort}
              sortOrder={filters.order}
              onEdit={handleEditCreator}
              onDelete={handleDeleteCreator}
              canManageCreators={canManageCreators}
            />
          )}
        </>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center" data-testid="pagination">
          <Pagination>
            <PaginationContent>
              {pagination.page > 1 && (
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => handlePageChange(pagination.page - 1)}
                  />
                </PaginationItem>
              )}

              {Array.from(
                { length: Math.min(5, pagination.totalPages) },
                (_, i) => {
                  const page = i + 1;
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        onClick={() => handlePageChange(page)}
                        isActive={pagination.page === page}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  );
                }
              )}

              {pagination.page < pagination.totalPages && (
                <PaginationItem>
                  <PaginationNext
                    onClick={() => handlePageChange(pagination.page + 1)}
                  />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Add/Edit Creator Modal */}
      <AddCreatorModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        onCreatorAdded={refreshCreators}
        mode={modalMode}
        creator={selectedCreatorForEdit}
      />
    </div>
  );
}
