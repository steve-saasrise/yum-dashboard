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
import type { Topic, TopicSelectorProps } from '@/types/topic';

export function TopicSelector({
  selectedTopics = [],
  onChange,
  placeholder = 'Select topics...',
  maxSelections,
  allowCreate = true,
  onCreateTopic,
  disabled = false,
  className,
}: TopicSelectorProps) {
  const [open, setOpen] = useState(false);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { state } = useAuth();
  const { session } = state;
  const isMobile = useIsMobile();

  // Fetch topics on mount and when dropdown opens
  const fetchTopics = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/topics', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await response.text();
        // Topics API error - will be thrown
        throw new Error(`Failed to fetch topics: ${response.status}`);
      }

      const result = await response.json();
      setTopics(result.data.topics);
    } catch {
      toast.error('Failed to load topics');
      // Error fetching topics - handled by toast
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (open || selectedTopics.length > 0) {
      fetchTopics();
    }
  }, [open, selectedTopics.length, fetchTopics]);

  const handleTopicSelect = (topicId: string) => {
    const isSelected = selectedTopics.includes(topicId);

    if (isSelected) {
      onChange(selectedTopics.filter((id) => id !== topicId));
    } else {
      if (maxSelections && selectedTopics.length >= maxSelections) {
        toast.error(`Maximum ${maxSelections} topics allowed`);
        return;
      }
      onChange([...selectedTopics, topicId]);
    }
  };

  const handleRemoveTopic = (topicId: string) => {
    onChange(selectedTopics.filter((id) => id !== topicId));
  };

  const handleCreateTopic = async () => {
    const topicName = searchQuery.trim();

    if (!topicName) {
      toast.error('Please enter a topic name');
      return;
    }

    if (topicName.length > 50) {
      toast.error('Topic name must be 50 characters or less');
      return;
    }

    // Check if topic already exists
    const existingTopic = topics.find(
      (t) => t.name.toLowerCase() === topicName.toLowerCase()
    );

    if (existingTopic) {
      handleTopicSelect(existingTopic.id);
      setSearchQuery('');
      return;
    }

    setCreatingTopic(true);

    try {
      let newTopic: Topic;

      if (onCreateTopic) {
        // Use custom creation handler if provided
        newTopic = await onCreateTopic(topicName);
      } else {
        // Default creation via API
        const response = await fetch('/api/topics', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: topicName }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to create topic');
        }

        const result = await response.json();
        newTopic = result.data;
      }

      // Add to local topics list
      setTopics([...topics, newTopic]);

      // Select the newly created topic
      handleTopicSelect(newTopic.id);

      // Clear search
      setSearchQuery('');

      toast.success(`Topic "${topicName}" created`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create topic'
      );
    } finally {
      setCreatingTopic(false);
    }
  };

  const selectedTopicDetails = topics.filter((topic) =>
    selectedTopics.includes(topic.id)
  );

  const filteredTopics = topics.filter(
    (topic) =>
      topic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      topic.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const showCreateOption =
    allowCreate &&
    searchQuery.trim() &&
    !filteredTopics.some(
      (t) => t.name.toLowerCase() === searchQuery.trim().toLowerCase()
    );

  // Common trigger button component
  const TriggerButton = (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      aria-label="Select topics"
      disabled={disabled}
      className={cn(
        'w-full justify-between',
        selectedTopics.length > 0 && 'h-auto min-h-10',
        isMobile && 'py-3' // Larger touch target on mobile
      )}
    >
      <div className="flex flex-wrap gap-1 py-1">
        {selectedTopics.length > 0 ? (
          selectedTopicDetails.map((topic) => (
            <Badge
              key={topic.id}
              variant="secondary"
              className={cn(
                'mr-1 mb-1',
                isMobile && 'text-sm py-1' // Slightly larger on mobile
              )}
            >
              {topic.name}
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
                  handleRemoveTopic(topic.id);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemoveTopic(topic.id);
                  }
                }}
                aria-label={`Remove ${topic.name}`}
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
    <Command shouldFilter={false} className={cn(isMobile && 'h-full')}>
      <CommandInput
        ref={inputRef}
        placeholder="Search or create topics..."
        value={searchQuery}
        onValueChange={setSearchQuery}
        className={cn(isMobile && 'text-base py-3')} // Larger on mobile
      />
      <CommandList className={cn(isMobile && 'max-h-[60vh]')}>
        {loading ? (
          <CommandEmpty className="py-6">
            <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
            Loading topics...
          </CommandEmpty>
        ) : (
          <>
            {filteredTopics.length === 0 && !showCreateOption && (
              <CommandEmpty className="py-6">No topics found.</CommandEmpty>
            )}

            {showCreateOption && (
              <CommandGroup heading="Create new">
                <CommandItem
                  onSelect={handleCreateTopic}
                  disabled={creatingTopic}
                  className={cn(
                    'cursor-pointer',
                    isMobile && 'py-3' // Larger touch target on mobile
                  )}
                >
                  {creatingTopic ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 h-4 w-4" />
                  )}
                  Create "{searchQuery}"
                </CommandItem>
              </CommandGroup>
            )}

            {filteredTopics.length > 0 && (
              <CommandGroup heading="Topics">
                {filteredTopics.map((topic) => {
                  const isSelected = selectedTopics.includes(topic.id);
                  return (
                    <CommandItem
                      key={topic.id}
                      value={topic.name}
                      onSelect={() => handleTopicSelect(topic.id)}
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
                          className={cn('font-medium', isMobile && 'text-base')}
                        >
                          {topic.name}
                        </div>
                        {topic.description && (
                          <div
                            className={cn(
                              'text-sm text-muted-foreground',
                              isMobile && 'text-sm mt-0.5'
                            )}
                          >
                            {topic.description}
                          </div>
                        )}
                      </div>
                      {topic.is_system_topic && (
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
  );

  if (isMobile) {
    return (
      <div className={cn('space-y-2', className)}>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{TriggerButton}</DrawerTrigger>
          <DrawerContent className="px-0">
            <DrawerHeader className="pb-0">
              <DrawerTitle className="text-center">Select Topics</DrawerTitle>
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
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          {CommandContent}
        </PopoverContent>
      </Popover>
    </div>
  );
}
