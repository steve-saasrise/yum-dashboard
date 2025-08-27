import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface DigestSubscriptionData {
  subscribed: boolean;
}

async function fetchDigestSubscription(
  loungeId: string
): Promise<DigestSubscriptionData> {
  const response = await fetch(`/api/lounges/${loungeId}/digest`);
  if (!response.ok) {
    throw new Error('Failed to fetch subscription status');
  }
  return response.json();
}

async function updateDigestSubscription(
  loungeId: string,
  subscribed: boolean
): Promise<DigestSubscriptionData> {
  const response = await fetch(`/api/lounges/${loungeId}/digest`, {
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

export function useDigestSubscription(loungeId: string | null) {
  const queryClient = useQueryClient();

  // Query for fetching subscription status
  const { data, isLoading } = useQuery({
    queryKey: ['lounge-digest-subscription', loungeId],
    queryFn: () => fetchDigestSubscription(loungeId!),
    enabled: !!loungeId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mutation for updating subscription
  const mutation = useMutation({
    mutationFn: (newStatus: boolean) =>
      updateDigestSubscription(loungeId!, newStatus),
    onMutate: async (newStatus) => {
      // Cancel any outgoing refetches to prevent overwriting our optimistic update
      await queryClient.cancelQueries({
        queryKey: ['lounge-digest-subscription', loungeId],
      });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<DigestSubscriptionData>([
        'lounge-digest-subscription',
        loungeId,
      ]);

      // Optimistically update to the new value
      queryClient.setQueryData<DigestSubscriptionData>(
        ['lounge-digest-subscription', loungeId],
        { subscribed: newStatus }
      );

      // Return a context object with the snapshotted value
      return { previousData };
    },
    onSuccess: (data, newStatus) => {
      // Show success toast
      toast.success(
        newStatus
          ? '📧 Daily digest enabled for this lounge'
          : 'Daily digest disabled for this lounge'
      );

      // No need to invalidate content queries for digest subscription
      // as it doesn't affect the feed display
    },
    onError: (error, newStatus, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousData) {
        queryClient.setQueryData(
          ['lounge-digest-subscription', loungeId],
          context.previousData
        );
      }

      console.error('Error toggling digest subscription:', error);
      toast.error('Failed to update digest subscription');
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're synced with server
      queryClient.invalidateQueries({
        queryKey: ['lounge-digest-subscription', loungeId],
      });
    },
  });

  const toggleSubscription = () => {
    if (!loungeId || mutation.isPending) return;

    const newStatus = !(data?.subscribed ?? false);
    mutation.mutate(newStatus);
  };

  return {
    subscribed: data?.subscribed ?? false,
    loading: isLoading || mutation.isPending,
    toggleSubscription,
  };
}
