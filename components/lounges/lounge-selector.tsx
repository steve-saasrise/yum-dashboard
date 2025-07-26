'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Plus, X, Check, ChevronDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/components/ui/use-mobile';
import type { Lounge, LoungeSelectorProps } from '@/types/lounge';

export function LoungeSelector({
  selectedLounges = [],
  onChange,
  placeholder = 'Select lounges...',
  maxSelections,
  allowCreate = true,
  onCreateLounge,
  disabled = false,
  className,
}: LoungeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingLounge, setCreatingLounge] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state } = useAuth();
  const { session } = state;
  const isMobile = useIsMobile();

  // Fetch lounges on mount and when dropdown opens
  const fetchLounges = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/lounges', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await response.text();
        // Lounges API error - will be thrown
        throw new Error(`Failed to fetch lounges: ${response.status}`);
      }

      const result = await response.json();
      setLounges(result.data.lounges);
    } catch {
      toast.error('Failed to load lounges');
      // Error fetching lounges - handled by toast
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open && lounges.length === 0) {
      setLoading(true);
      fetchLounges();
    }
  }, [open, lounges.length, fetchLounges]);

  // Fetch lounges on mount if we have selected lounges to display
  useEffect(() => {
    if (selectedLounges.length > 0 && lounges.length === 0 && !loading) {
      fetchLounges();
    }
  }, [selectedLounges.length, lounges.length, loading, fetchLounges]);

  const handleLoungeSelect = (loungeId: string) => {
    const isSelected = selectedLounges.includes(loungeId);

    if (isSelected) {
      onChange(selectedLounges.filter((id) => id !== loungeId));
    } else {
      if (maxSelections && selectedLounges.length >= maxSelections) {
        toast.error(`Maximum ${maxSelections} lounges allowed`);
        return;
      }
      onChange([...selectedLounges, loungeId]);
    }
  };

  const handleRemoveLounge = (loungeId: string) => {
    onChange(selectedLounges.filter((id) => id !== loungeId));
  };

  const handleCreateLounge = async () => {
    const loungeName = searchQuery.trim();

    if (!loungeName) {
      toast.error('Please enter a lounge name');
      return;
    }

    if (loungeName.length > 50) {
      toast.error('Lounge name must be 50 characters or less');
      return;
    }

    // Check if lounge already exists
    const existingLounge = lounges.find(
      (t) => t.name.toLowerCase() === loungeName.toLowerCase()
    );

    if (existingLounge) {
      handleLoungeSelect(existingLounge.id);
      setSearchQuery('');
      return;
    }

    setCreatingLounge(true);

    try {
      let newLounge: Lounge;

      if (onCreateLounge) {
        // Use custom creation handler if provided
        newLounge = await onCreateLounge(loungeName);
      } else {
        // Default creation via API
        const response = await fetch('/api/lounges', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: loungeName }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create lounge');
        }

        const result = await response.json();
        newLounge = result.data;
      }

      // Add to local lounges list
      setLounges([...lounges, newLounge]);

      // Select the newly created lounge
      handleLoungeSelect(newLounge.id);

      // Clear search
      setSearchQuery('');

      toast.success(`Lounge "${loungeName}" created`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create lounge'
      );
    } finally {
      setCreatingLounge(false);
    }
  };

  const selectedLoungeDetails = lounges.filter((lounge) =>
    selectedLounges.includes(lounge.id)
  );

  const filteredLounges = lounges.filter(
    (lounge) =>
      lounge.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lounge.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption =
    allowCreate &&
    searchQuery.trim() &&
    !filteredLounges.some(
      (t) => t.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );

  // Common trigger button component
  const TriggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-label="Select lounges"
      disabled={disabled}
      className={cn(
        'w-full justify-between h-10',
        selectedLounges.length > 0 && 'h-auto min-h-10',
        isMobile && 'py-3' // Larger touch target on mobile
      )}
    >
      <div className="flex flex-wrap gap-1">
        {selectedLounges.length > 0 ? (
          selectedLoungeDetails.map((lounge) => (
            <Badge
              key={lounge.id}
              variant="secondary"
              className={cn(
                'mr-1',
                isMobile && 'text-sm py-1' // Slightly larger on mobile
              )}
            >
              {lounge.name}
              <span
                className={cn(
                  'ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer inline-flex items-center justify-center',
                  isMobile && 'ml-2 p-0.5' // Larger touch target on mobile
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemoveLounge(lounge.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveLounge(lounge.id);
                  }
                }}
                aria-label={`Remove ${lounge.name}`}
              >
                <X className={cn('h-3 w-3', isMobile && 'h-4 w-4')} />
              </span>
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
      </div>
      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  // Common command content
  const CommandContent = (
    <div className="pr-1">
      <Command shouldFilter={false} className={cn(isMobile && 'h-full')}>
        <CommandInput
          ref={inputRef}
          placeholder="Search or create lounges..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          className={cn(isMobile && 'text-base py-3')} // Larger on mobile
        />
        <CommandList className={cn(isMobile && 'max-h-[60vh]')}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin mb-2" />
              <span className="text-sm text-muted-foreground">
                Loading lounges...
              </span>
            </div>
          ) : (
            <>
              {filteredLounges.length === 0 && !showCreateOption && (
                <CommandEmpty className="py-6">No lounges found.</CommandEmpty>
              )}

              {showCreateOption && (
                <CommandGroup heading="Create new">
                  <CommandItem
                    onSelect={handleCreateLounge}
                    disabled={creatingLounge}
                    className={cn(
                      'cursor-pointer',
                      isMobile && 'py-3' // Larger touch target on mobile
                    )}
                  >
                    {creatingLounge ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Create "{searchQuery}"
                  </CommandItem>
                </CommandGroup>
              )}

              {filteredLounges.length > 0 && (
                <CommandGroup heading="Lounges">
                  {filteredLounges.map((lounge) => {
                    const isSelected = selectedLounges.includes(lounge.id);
                    return (
                      <CommandItem
                        key={lounge.id}
                        value={lounge.name}
                        onSelect={() => handleLoungeSelect(lounge.id)}
                        className={cn(
                          'cursor-pointer',
                          isMobile && 'py-3' // Larger touch target on mobile
                        )}
                      >
                        <Check
                          className={cn(
                            'mr-2 h-4 w-4',
                            isSelected ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                        <div className="flex-1">
                          <div
                            className={cn(
                              'font-medium',
                              isMobile && 'text-base'
                            )}
                          >
                            {lounge.name}
                          </div>
                          {lounge.description && (
                            <div
                              className={cn(
                                'text-sm text-muted-foreground',
                                isMobile && 'text-sm mt-0.5'
                              )}
                            >
                              {lounge.description}
                            </div>
                          )}
                        </div>
                        {lounge.is_system_lounge && (
                          <Badge variant="outline" className="ml-2">
                            System
                          </Badge>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );

  if (isMobile) {
    return (
      <div className={cn('space-y-2', className)}>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{TriggerButton}</DrawerTrigger>
          <DrawerContent className="px-0">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="text-center">Select Lounges</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">{CommandContent}</div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 border-0"
          align="start"
          side="top"
          sideOffset={8}
          onWheel={(e) => e.stopPropagation()}
          style={{
            boxShadow:
              '0 -10px 15px -3px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          }}
        >
          {CommandContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}
