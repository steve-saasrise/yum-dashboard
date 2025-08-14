import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export function useDigestSubscription(loungeId: string | null) {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loungeId) {
      setLoading(false);
      return;
    }

    // Fetch current subscription status
    fetch(`/api/lounges/${loungeId}/digest`)
      .then((res) => res.json())
      .then((data) => {
        setSubscribed(data.subscribed || false);
      })
      .catch((error) => {
        console.error('Error fetching subscription status:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [loungeId]);

  const toggleSubscription = async () => {
    if (!loungeId) return;

    const newStatus = !subscribed;
    setSubscribed(newStatus); // Optimistic update

    try {
      const response = await fetch(`/api/lounges/${loungeId}/digest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subscribed: newStatus }),
      });

      if (!response.ok) {
        throw new Error('Failed to update subscription');
      }

      toast.success(
        newStatus
          ? '📧 Daily digest enabled for this lounge'
          : 'Daily digest disabled for this lounge'
      );
    } catch (error) {
      console.error('Error toggling subscription:', error);
      setSubscribed(!newStatus); // Revert on error
      toast.error('Failed to update digest subscription');
    }
  };

  return {
    subscribed,
    loading,
    toggleSubscription,
  };
}