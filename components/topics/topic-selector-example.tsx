'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TopicSelector } from './topic-selector';
import { Button } from '@/components/ui/button';
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
import { toast } from 'sonner';

// Example form schema with topics
const creatorFormSchema = z.object({
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().max(500).optional(),
  topics: z.array(z.string()).min(1, 'At least one topic is required'),
});

type CreatorFormData = z.infer<typeof creatorFormSchema>;

/**
 * Example component showing how to integrate TopicSelector with React Hook Form
 * This example demonstrates:
 * - Integration with react-hook-form
 * - Form validation with Zod
 * - Custom topic creation handler
 * - Proper error handling
 */
export function TopicSelectorExample() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CreatorFormData>({
    resolver: zodResolver(creatorFormSchema),
    defaultValues: {
      display_name: '',
      description: '',
      topics: [],
    },
  });

  const onSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Form submitted successfully
      toast.success('Creator added successfully!');

      // Reset form
      form.reset();
    } catch {
      toast.error('Failed to add creator');
      // Error handled by toast
    } finally {
      setIsSubmitting(false);
    }
  };

  // Example custom topic creation handler
  const handleCustomTopicCreation = async (name: string) => {
    // You could add custom logic here, like:
    // - Adding a prefix to topic names
    // - Setting default descriptions
    // - Creating topics in a specific parent category

    const response = await fetch('/api/topics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('supabase.auth.token')}`,
      },
      body: JSON.stringify({
        name,
        description: `Topic created from creator form`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create topic');
    }

    const result = await response.json();
    return result.data;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Add New Creator</h2>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="display_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
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
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Brief description of the creator..."
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Optional description about this creator
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="topics"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Topics</FormLabel>
                <FormControl>
                  <TopicSelector
                    selectedTopics={field.value}
                    onChange={field.onChange}
                    placeholder="Select or create topics..."
                    maxSelections={5}
                    onCreateTopic={handleCustomTopicCreation}
                  />
                </FormControl>
                <FormDescription>
                  Choose topics that best describe this creator's content. You
                  can create new topics if needed.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Adding Creator...
                </>
              ) : (
                'Add Creator'
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={isSubmitting}
            >
              Reset
            </Button>
          </div>
        </form>
      </Form>

      {/* Example of displaying selected topics outside the form */}
      {form.watch('topics').length > 0 && (
        <div className="mt-6 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">Selected Topics:</h3>
          <div className="flex flex-wrap gap-2">
            {form.watch('topics').map((topicId) => (
              <div
                key={topicId}
                className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
              >
                Topic ID: {topicId}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Standalone example without form integration
 */
export function TopicSelectorStandalone() {
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  return (
    <div className="max-w-md mx-auto p-6">
      <h3 className="text-lg font-semibold mb-4">Standalone Topic Selector</h3>

      <TopicSelector
        selectedTopics={selectedTopics}
        onChange={setSelectedTopics}
        placeholder="Choose your interests..."
        allowCreate={true}
      />

      {selectedTopics.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            You have selected {selectedTopics.length} topic(s)
          </p>
        </div>
      )}
    </div>
  );
}
