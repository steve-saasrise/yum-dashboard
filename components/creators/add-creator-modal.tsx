'use client';

import { useState, KeyboardEvent, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlatformDetector } from '@/lib/platform-detector';
import { useAuth } from '@/hooks/use-auth';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Creator } from '@/types/creator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import {
  Youtube,
  Linkedin,
  Rss,
  Globe,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';
import { TopicSelector } from '@/components/topics/topic-selector';

// Platform icons mapping
const platformIcons = {
  youtube: Youtube,
  twitter: Icons.x,
  linkedin: Linkedin,
  threads: Icons.threads,
  rss: Rss,
  unknown: Globe,
};

// Form schema
const createCreatorSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
  urls: z.array(
    z.object({
      url: z.string().url(),
      platform: z.enum([
        'youtube',
        'twitter',
        'linkedin',
        'threads',
        'rss',
        'unknown',
      ]),
    })
  ),
  topics: z.array(z.string()).optional(),
});

type CreateCreatorFormData = z.infer<typeof createCreatorSchema>;

interface AddCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatorAdded?: () => void;
  mode?: 'add' | 'edit';
  creator?: Creator;
}

export function AddCreatorModal({
  open,
  onOpenChange,
  onCreatorAdded,
  mode = 'add',
  creator,
}: AddCreatorModalProps) {
  const { state } = useAuth();
  const { session } = state;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const form = useForm<CreateCreatorFormData>({
    resolver: zodResolver(createCreatorSchema),
    defaultValues: {
      display_name: '',
      description: '',
      urls: [],
      topics: [],
    },
  });

  // Initialize form when editing a creator
  useEffect(() => {
    if (mode === 'edit' && creator) {
      form.reset({
        display_name: creator.display_name || '',
        description: creator.bio || '',
        urls:
          creator.creator_urls?.map((url) => ({
            url: url.url,
            platform: url.platform as
              | 'youtube'
              | 'twitter'
              | 'linkedin'
              | 'threads'
              | 'rss'
              | 'unknown',
          })) || [],
        topics: creator.topics || [],
      });
    } else {
      form.reset({
        display_name: '',
        description: '',
        urls: [],
        topics: [],
      });
    }
  }, [mode, creator, form]);

  const urls = form.watch('urls');

  const addUrl = () => {
    setUrlError(null);
    let trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      setUrlError('Please enter a URL');
      return;
    }

    // Auto-add protocol if missing for common platforms
    if (
      !trimmedUrl.startsWith('http://') &&
      !trimmedUrl.startsWith('https://')
    ) {
      // Check if it looks like a domain
      if (trimmedUrl.includes('.') && !trimmedUrl.startsWith('@')) {
        trimmedUrl = 'https://' + trimmedUrl;
      }
    }

    // Check if URL is valid
    try {
      new URL(trimmedUrl);
    } catch {
      setUrlError(
        'Please enter a valid URL (e.g., https://threads.net/@username)'
      );
      return;
    }

    // Detect platform
    try {
      const platformInfo = PlatformDetector.detect(trimmedUrl);
      console.log('Platform detection result:', {
        url: trimmedUrl,
        platform: platformInfo.platform,
        platformUserId: platformInfo.platformUserId,
        fullPlatformInfo: platformInfo
      });

      // Check for duplicates
      const isDuplicate = urls.some(
        (u) => u.platform === platformInfo.platform && u.url === trimmedUrl
      );

      if (isDuplicate) {
        setUrlError('This URL has already been added');
        return;
      }

      // Add the URL
      const newUrls = [
        ...urls,
        {
          url: trimmedUrl,
          platform: platformInfo.platform as
            | 'youtube'
            | 'twitter'
            | 'linkedin'
            | 'threads'
            | 'rss'
            | 'unknown',
        },
      ];
      
      console.log('Adding URL to form:', {
        newUrls,
        currentUrls: urls,
        platformDetected: platformInfo.platform,
        isValidPlatform: ['youtube', 'twitter', 'linkedin', 'threads', 'rss', 'unknown'].includes(platformInfo.platform)
      });

      form.setValue('urls', newUrls, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });

      setUrlInput('');
    } catch (error) {
      console.error('Platform detection error:', error);
      setUrlError('URL not recognized. Please check the URL and try again.');
    }
  };

  const removeUrl = (index: number) => {
    form.setValue(
      'urls',
      urls.filter((_, i) => i !== index)
    );
  };

  const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addUrl();
    }
  };

  const onSubmit = async (data: CreateCreatorFormData) => {
    console.log('Form submitted with data:', data);
    
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to manage creators',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 1500);
      return;
    }

    // Validate URLs are present when adding
    if (mode === 'add' && data.urls.length === 0) {
      toast({
        title: 'URLs required',
        description: 'Please add at least one URL for the creator',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'add') {
        // Use the API endpoint for creator creation
        const requestBody = {
          display_name: data.display_name,
          description: data.description || undefined,
          urls: data.urls.map((u) => u.url),
          topics: data.topics,
        };
        console.log('Sending request to /api/creators:', requestBody);
        
        const response = await fetch('/api/creators', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        console.log('API response:', { status: response.status, ok: response.ok, result });

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create creator');
        }

        toast({
          title: 'Creator added successfully',
          description: `${data.display_name} has been added to your list`,
        });
      } else {
        // Update the creator using Supabase client for edit mode
        const supabase = createBrowserSupabaseClient();

        const { error: updateError } = await supabase
          .from('creators')
          .update({
            display_name: data.display_name,
            bio: data.description || null,
          })
          .eq('id', creator?.id);

        if (updateError) {
          throw new Error(updateError.message || 'Failed to update creator');
        }

        // Update topics
        if (creator?.id) {
          // First, delete existing topics
          await supabase
            .from('creator_topics')
            .delete()
            .eq('creator_id', creator.id);

          // Then add new topics
          if (data.topics && data.topics.length > 0) {
            const { error: topicError } = await supabase
              .from('creator_topics')
              .insert(
                data.topics.map((topicId) => ({
                  creator_id: creator.id,
                  topic_id: topicId,
                }))
              );

            if (topicError) {
              // Failed to update topics - not failing whole operation
              // Don't fail the whole operation if topics fail
            }
          }
        }

        toast({
          title: 'Creator updated successfully',
          description: `${data.display_name} has been updated`,
        });
      }

      form.reset();
      setUrlInput('');
      onOpenChange(false);
      onCreatorAdded?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An unexpected error occurred';
      const isAuthError =
        errorMessage.includes('Authentication expired') ||
        errorMessage.includes('sign in');

      toast({
        title:
          mode === 'add' ? 'Failed to add creator' : 'Failed to update creator',
        description: errorMessage,
        variant: 'destructive',
      });

      // If authentication error, redirect to login after showing the toast
      if (isAuthError) {
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 1500);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add New Creator' : 'Edit Creator'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Add a creator by providing their social media or website URLs'
              : 'Update creator information and topics'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., John Doe"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    The name that will be displayed for this creator
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Brief description of the creator..."
                      className="resize-none"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {mode === 'add' && (
              <div className="space-y-4">
                <FormItem>
                  <FormLabel>Creator URLs</FormLabel>
                  <FormDescription>
                    Add URLs where this creator posts content
                  </FormDescription>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter creator URL (YouTube, X, LinkedIn, RSS...)"
                        value={urlInput}
                        onChange={(e) => {
                          setUrlInput(e.target.value);
                          setUrlError(null);
                        }}
                        onKeyPress={handleKeyPress}
                        disabled={isSubmitting}
                        className={cn(urlError && 'border-red-500')}
                      />
                      <Button
                        type="button"
                        onClick={addUrl}
                        disabled={isSubmitting}
                      >
                        Add
                      </Button>
                    </div>
                    {urlError && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        {urlError}
                      </div>
                    )}
                  </div>

                  {/* URL Chips */}
                  {urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {urls.map((urlItem, index) => {
                        const Icon =
                          platformIcons[
                            urlItem.platform as keyof typeof platformIcons
                          ] || platformIcons.unknown;
                        return (
                          <Badge
                            key={index}
                            variant="secondary"
                            className="pl-2 pr-1 py-1.5 flex items-center gap-2 text-sm"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="max-w-[200px] truncate">
                              {urlItem.url}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeUrl(index)}
                              className="ml-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-full p-0.5 transition-colors"
                              disabled={isSubmitting}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {form.formState.errors.urls && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.urls.message}
                    </p>
                  )}
                </FormItem>
              </div>
            )}

            {mode === 'edit' &&
              creator?.creator_urls &&
              creator.creator_urls.length > 0 && (
                <div className="space-y-4">
                  <FormItem>
                    <FormLabel>Connected Platforms</FormLabel>
                    <FormDescription>
                      Current social media accounts (URL editing coming soon)
                    </FormDescription>
                    <div className="flex flex-wrap gap-2 pt-2">
                      {creator.creator_urls.map((urlItem) => {
                        const Icon =
                          platformIcons[
                            urlItem.platform as keyof typeof platformIcons
                          ] || platformIcons.unknown;
                        return (
                          <Badge
                            key={urlItem.id}
                            variant="secondary"
                            className="pl-2 pr-2 py-1.5 flex items-center gap-2 text-sm"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="max-w-[200px] truncate">
                              {urlItem.url}
                            </span>
                          </Badge>
                        );
                      })}
                    </div>
                  </FormItem>
                </div>
              )}

            <FormField
              control={form.control}
              name="topics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Topics</FormLabel>
                  <FormControl>
                    <TopicSelector
                      selectedTopics={field.value || []}
                      onChange={field.onChange}
                      placeholder="Select topics..."
                      allowCreate={true}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Select or create topics to categorize this creator
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  setUrlInput('');
                  setUrlError(null);
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || (mode === 'add' && urls.length === 0)}
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {mode === 'add' ? 'Add Creator' : 'Update Creator'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
