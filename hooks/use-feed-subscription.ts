import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface FeedSubscriptionData {
  subscribed: boolean;
}

async function fetchFeedSubscription(
  loungeId: string
): Promise<FeedSubscriptionData> {
  const response = await fetch(`/api/lounges/${loungeId}/feed`);
  if (!response.ok) {
    throw new Error('Failed to fetch subscription status');
  }
  return response.json();
}

async function updateFeedSubscription(
  loungeId: string,
  subscribed: boolean
): Promise<FeedSubscriptionData> {
  const response = await fetch(`/api/lounges/${loungeId}/feed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscribed }),
  });

  if (!response.ok) {
    throw new Error('Failed to update subscription');
  }

  return response.json();
}

export function useFeedSubscription(loungeId: string | null) {
  const queryClient = useQueryClient();

  // Query for fetching subscription status
  const { data, isLoading } = useQuery({
    queryKey: ['lounge-feed-subscription', loungeId],
    queryFn: () => fetchFeedSubscription(loungeId!),
    enabled: !!loungeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mutation for updating subscription
  const mutation = useMutation({
    mutationFn: (newStatus: boolean) =>
      updateFeedSubscription(loungeId!, newStatus),
    onMutate: async (newStatus) => {
      // Cancel any outgoing refetches to prevent overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: ['lounge-feed-subscription', loungeId],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<FeedSubscriptionData>([
        'lounge-feed-subscription',
        loungeId,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData<FeedSubscriptionData>(
        ['lounge-feed-subscription', loungeId],
        { subscribed: newStatus }
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onSuccess: (data, newStatus) => {
      // Show success toast
      toast.success(
        newStatus
          ? '✓ This lounge will appear in your feed'
          : 'This lounge has been hidden from your feed'
      );

      // Invalidate content queries to refresh the feed
      // More targeted invalidation for better performance
      queryClient.invalidateQueries({
        queryKey: ['content', 'infinite'],
        exact: false,
      });
    },
    onError: (error, newStatus, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          ['lounge-feed-subscription', loungeId],
          context.previousData
        );
      }

      console.error('Error toggling feed subscription:', error);
      toast.error('Failed to update feed subscription');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're synced with server
      queryClient.invalidateQueries({
        queryKey: ['lounge-feed-subscription', loungeId],
      });
    },
  });

  const toggleSubscription = () => {
    if (!loungeId || mutation.isPending) return;

    const newStatus = !(data?.subscribed ?? true);
    mutation.mutate(newStatus);
  };

  return {
    subscribed: data?.subscribed ?? true,
    loading: isLoading || mutation.isPending,
    toggleSubscription,
  };
}
