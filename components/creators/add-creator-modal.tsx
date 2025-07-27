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
import { LoungeSelector } from '@/components/lounges/lounge-selector';

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
  lounge_id: z.string().optional(), // Add lounge_id to form schema
});

type CreateCreatorFormData = z.infer<typeof createCreatorSchema>;

interface AddCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatorAdded?: () => void;
  mode?: 'add' | 'edit';
  creator?: Creator;
  selectedLoungeId?: string | null;
}

export function AddCreatorModal({
  open,
  onOpenChange,
  onCreatorAdded,
  mode = 'add',
  creator,
  selectedLoungeId,
}: AddCreatorModalProps) {
  const { state } = useAuth();
  const { session } = state;
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [deletedUrlIds, setDeletedUrlIds] = useState<string[]>([]);
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null);
  const [editingUrlValue, setEditingUrlValue] = useState<string>('');

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
        urls: [], // In edit mode, we manage existing URLs separately
        topics: creator.lounge_ids || [], // Use lounge_ids for edit mode
        lounge_id: undefined, // Not needed for edit mode
      });
      setDeletedUrlIds([]); // Reset deleted URLs tracking
    } else {
      // Add mode - initialize with selected lounge
      const initialTopics = selectedLoungeId ? [selectedLoungeId] : [];
      form.reset({
        display_name: '',
        description: '',
        urls: [],
        topics: initialTopics,
        lounge_id: selectedLoungeId || undefined,
      });
      setDeletedUrlIds([]);
    }
  }, [mode, creator, form, selectedLoungeId]);

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
        fullPlatformInfo: platformInfo,
      });

      // Check for duplicates
      const isDuplicate = urls.some(
        (u) => u.platform === platformInfo.platform && u.url === trimmedUrl
      );

      if (isDuplicate) {
        setUrlError('This URL has already been added');
        return;
      }

      // In edit mode, check if platform already exists in existing URLs
      if (mode === 'edit' && creator?.creator_urls) {
        const existingPlatform = creator.creator_urls.find(
          (u) =>
            u.platform === platformInfo.platform &&
            !deletedUrlIds.includes(u.id)
        );
        if (existingPlatform) {
          setUrlError(
            `A ${platformInfo.platform} URL already exists for this creator`
          );
          return;
        }
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
        isValidPlatform: [
          'youtube',
          'twitter',
          'linkedin',
          'threads',
          'rss',
          'unknown',
        ].includes(platformInfo.platform),
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

  const handleDeleteExistingUrl = (urlId: string) => {
    // Check if this is the last URL
    const remainingUrls =
      creator?.creator_urls?.filter(
        (u) => u.id !== urlId && !deletedUrlIds.includes(u.id)
      ).length || 0;

    if (remainingUrls === 0 && urls.length === 0) {
      toast({
        title: 'Cannot delete URL',
        description: 'A creator must have at least one URL',
        variant: 'destructive',
      });
      return;
    }

    setDeletedUrlIds([...deletedUrlIds, urlId]);
  };

  const startEditingUrl = (urlId: string, currentUrl: string) => {
    setEditingUrlId(urlId);
    setEditingUrlValue(currentUrl);
  };

  const cancelEditingUrl = () => {
    setEditingUrlId(null);
    setEditingUrlValue('');
  };

  const saveEditedUrl = async () => {
    if (!editingUrlId || !creator?.id) return;

    // Validate the new URL
    try {
      new URL(editingUrlValue);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `/api/creators/${creator.id}/urls/${editingUrlId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for curator auth
          body: JSON.stringify({ url: editingUrlValue }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update URL');
      }

      // Update the URL in the creator object
      if (creator.creator_urls) {
        const updatedUrls = creator.creator_urls.map((u) =>
          u.id === editingUrlId
            ? { ...u, url: editingUrlValue, platform: result.data.platform }
            : u
        );
        creator.creator_urls = updatedUrls;
      }

      toast({
        title: 'URL updated',
        description: 'The URL has been updated successfully',
      });

      setEditingUrlId(null);
      setEditingUrlValue('');
      onCreatorAdded?.(); // Refresh the list
    } catch (error) {
      toast({
        title: 'Failed to update URL',
        description:
          error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
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
        // Get the lounge_id from the form data or use the first selected lounge
        const loungeId =
          data.lounge_id ||
          (data.topics && data.topics.length > 0 ? data.topics[0] : null);

        if (!loungeId) {
          toast({
            title: 'No lounge selected',
            description: 'Please select at least one lounge for this creator',
            variant: 'destructive',
          });
          setIsSubmitting(false);
          return;
        }

        const requestBody = {
          display_name: data.display_name,
          description: data.description || undefined,
          urls: data.urls.map((u) => u.url),
          topics: data.topics,
          lounge_id: loungeId,
        };
        console.log('Sending request to /api/creators:', requestBody);

        const response = await fetch('/api/creators', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include cookies for curator auth
          body: JSON.stringify(requestBody),
        });

        const result = await response.json();
        console.log('API response:', {
          status: response.status,
          ok: response.ok,
          result,
        });

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

        // Handle URL changes
        if (creator?.id) {
          // Delete URLs marked for deletion
          for (const urlId of deletedUrlIds) {
            const { error: deleteError } = await fetch(
              `/api/creators/${creator.id}/urls/${urlId}`,
              {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for curator auth
              }
            ).then((res) => res.json());

            if (deleteError) {
              console.error('Failed to delete URL:', deleteError);
            }
          }

          // Add new URLs
          for (const newUrl of data.urls) {
            const { error: addError } = await fetch(
              `/api/creators/${creator.id}/urls`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include', // Include cookies for curator auth
                body: JSON.stringify({ url: newUrl.url }),
              }
            ).then((res) => res.json());

            if (addError) {
              console.error('Failed to add URL:', addError);
            }
          }
        }

        // Update lounges
        if (creator?.id) {
          // First, delete existing lounges
          await supabase
            .from('creator_lounges')
            .delete()
            .eq('creator_id', creator.id);

          // Then add new lounges
          if (data.topics && data.topics.length > 0) {
            const { error: loungeError } = await supabase
              .from('creator_lounges')
              .insert(
                data.topics.map((loungeId) => ({
                  creator_id: creator.id,
                  lounge_id: loungeId,
                }))
              );

            if (loungeError) {
              // Failed to update lounges - not failing whole operation
              // Don't fail the whole operation if lounges fail
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

            {mode === 'edit' && (
              <div className="space-y-4">
                <FormItem>
                  <FormLabel>Creator URLs</FormLabel>
                  <FormDescription>
                    Manage URLs where this creator posts content. Click on a URL
                    to edit it inline.
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

                  {/* Combined list of existing and new URLs */}
                  {(creator?.creator_urls || urls.length > 0) && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {/* Existing URLs */}
                      {creator?.creator_urls
                        ?.filter((url) => !deletedUrlIds.includes(url.id))
                        .map((urlItem) => {
                          const Icon =
                            platformIcons[
                              urlItem.platform as keyof typeof platformIcons
                            ] || platformIcons.unknown;

                          // Check if only one URL remains
                          const isLastUrl =
                            creator.creator_urls?.filter(
                              (u) => !deletedUrlIds.includes(u.id)
                            ).length === 1 && urls.length === 0;

                          if (editingUrlId === urlItem.id) {
                            // Show inline edit form
                            return (
                              <div
                                key={urlItem.id}
                                className="flex items-center gap-2 w-full"
                              >
                                <Icon className="h-4 w-4" />
                                <Input
                                  value={editingUrlValue}
                                  onChange={(e) =>
                                    setEditingUrlValue(e.target.value)
                                  }
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      saveEditedUrl();
                                    }
                                  }}
                                  className="flex-1"
                                  disabled={isSubmitting}
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={saveEditedUrl}
                                  disabled={isSubmitting}
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelEditingUrl}
                                  disabled={isSubmitting}
                                >
                                  Cancel
                                </Button>
                              </div>
                            );
                          }

                          return (
                            <Badge
                              key={urlItem.id}
                              variant="secondary"
                              className="pl-2 pr-1 py-1.5 flex items-center gap-2 text-sm group"
                            >
                              <Icon className="h-4 w-4" />
                              <span
                                className="max-w-[200px] truncate cursor-pointer hover:underline"
                                onClick={() =>
                                  startEditingUrl(urlItem.id, urlItem.url)
                                }
                                title="Click to edit"
                              >
                                {urlItem.url}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteExistingUrl(urlItem.id)
                                }
                                className={cn(
                                  'ml-1 rounded-full p-0.5 transition-colors',
                                  isLastUrl
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'hover:bg-gray-300 dark:hover:bg-gray-600'
                                )}
                                disabled={isSubmitting || isLastUrl}
                                title={
                                  isLastUrl
                                    ? 'Cannot delete the last URL'
                                    : 'Delete URL'
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          );
                        })}
                      {/* New URLs to be added */}
                      {urls.map((urlItem, index) => {
                        const Icon =
                          platformIcons[
                            urlItem.platform as keyof typeof platformIcons
                          ] || platformIcons.unknown;
                        return (
                          <Badge
                            key={`new-${index}`}
                            variant="outline"
                            className="pl-2 pr-1 py-1.5 flex items-center gap-2 text-sm border-dashed"
                          >
                            <Icon className="h-4 w-4" />
                            <span className="max-w-[200px] truncate">
                              {urlItem.url}
                            </span>
                            <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                              (new)
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

            <FormField
              control={form.control}
              name="topics"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lounges</FormLabel>
                  <FormControl>
                    <LoungeSelector
                      key={`${mode}-${creator?.id || 'new'}-${selectedLoungeId || 'none'}`}
                      selectedLounges={field.value || []}
                      onChange={field.onChange}
                      placeholder="Select lounges..."
                      allowCreate={true}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Select or create lounges to categorize this creator
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
                  setDeletedUrlIds([]);
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
