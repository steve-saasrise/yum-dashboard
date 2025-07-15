'use client';

import { useState, KeyboardEvent } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlatformDetector } from '@/lib/platform-detector';
import { useAuth } from '@/hooks/use-auth';
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
  AtSign,
  Rss,
  Globe,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';
import { Icons } from '@/components/icons';
import { cn } from '@/lib/utils';

// Platform icons mapping
const platformIcons = {
  youtube: Youtube,
  twitter: Icons.x,
  linkedin: Linkedin,
  threads: AtSign,
  rss: Rss,
  unknown: Globe,
};

// Form schema
const createCreatorSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
  urls: z
    .array(
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
    )
    .min(1, 'At least one URL is required'),
  topics: z.array(z.string()).optional(),
});

type CreateCreatorFormData = z.infer<typeof createCreatorSchema>;

interface AddCreatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreatorAdded?: () => void;
}

export function AddCreatorModal({
  open,
  onOpenChange,
  onCreatorAdded,
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

  const urls = form.watch('urls');

  const addUrl = () => {
    setUrlError(null);
    let trimmedUrl = urlInput.trim();

    if (!trimmedUrl) {
      setUrlError('Please enter a URL');
      return;
    }

    // Auto-add protocol if missing for common platforms
    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      // Check if it looks like a domain
      if (trimmedUrl.includes('.') && !trimmedUrl.startsWith('@')) {
        trimmedUrl = 'https://' + trimmedUrl;
      }
    }

    // Check if URL is valid
    try {
      new URL(trimmedUrl);
    } catch {
      setUrlError('Please enter a valid URL (e.g., https://threads.net/@username)');
      return;
    }

    // Detect platform
    try {
      const platformInfo = PlatformDetector.detect(trimmedUrl);

      // Check for duplicates
      const isDuplicate = urls.some(
        (u) => u.platform === platformInfo.platform && u.url === trimmedUrl
      );

      if (isDuplicate) {
        setUrlError('This URL has already been added');
        return;
      }

      // Add the URL
      form.setValue('urls', [
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
      ]);

      setUrlInput('');
    } catch (error) {
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
    if (!session) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to add creators',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Create the creator
      const response = await fetch('/api/creators', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          display_name: data.display_name,
          description: data.description,
          urls: data.urls.map((u) => u.url),
          topics: data.topics,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create creator');
      }

      toast({
        title: 'Creator added successfully',
        description: `${data.display_name} has been added to your list`,
      });

      form.reset();
      setUrlInput('');
      onOpenChange(false);
      onCreatorAdded?.();
    } catch (error) {
      toast({
        title: 'Failed to add creator',
        description:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Creator</DialogTitle>
          <DialogDescription>
            Add a creator by providing their social media or website URLs
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

            <div className="space-y-4">
              <FormItem>
                <FormLabel>Creator URLs</FormLabel>
                <FormDescription>
                  Add URLs where this creator posts content
                </FormDescription>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste any creator URL or channel link from YouTube, X, LinkedIn, Threads, or RSS feeds"
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
                      const Icon = platformIcons[urlItem.platform];
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
                disabled={isSubmitting || urls.length === 0}
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Add Creator
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
