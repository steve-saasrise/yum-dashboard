'use client';

import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

export function useSessionTracking() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    // Track session on mount
    const trackSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        try {
          const response = await fetch('/api/auth/session-tracking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Ensure cookies are sent
          });

          const data = await response.json();

          if (data.suspicious) {
            // Could show a warning or require additional verification
            console.warn('Suspicious activity detected');
          }
        } catch (error) {
          console.error('Error tracking session:', error);
        }
      }
    };

    trackSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await trackSession();
      }

      // Logout handling is managed in use-auth.tsx to avoid conflicts
      // if (event === 'SIGNED_OUT') {
      //   router.push('/auth/login');
      // }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);
}
