'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Curator } from '@/types/curator';

export function useCuratorAuth() {
  const router = useRouter();
  const [curator, setCurator] = useState<Curator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const response = await fetch('/api/curator/me');
      if (response.ok) {
        const data = await response.json();
        setCurator(data.curator);
      } else {
        setCurator(null);
      }
    } catch (error) {
      console.error('Error checking curator auth:', error);
      setCurator(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch('/api/curator/logout', { method: 'POST' });
      setCurator(null);
      router.push('/curator/login');
      router.refresh();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }

  return {
    curator,
    loading,
    isAuthenticated: !!curator,
    logout,
    checkAuth,
  };
}
