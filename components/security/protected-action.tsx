'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ReAuthModal } from './re-auth-modal';
import { toast } from 'sonner';

interface ProtectedActionProps {
  children: React.ReactNode;
  action: () => void | Promise<void>;
  requireReAuth?: boolean;
  sensitivityLevel?: 'low' | 'medium' | 'high';
}

export function ProtectedAction({
  children,
  action,
  requireReAuth = true,
  sensitivityLevel = 'medium',
}: ProtectedActionProps) {
  const [showReAuth, setShowReAuth] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const supabase = createClient();

  const checkAuthStatus = async () => {
    if (!requireReAuth) {
      await action();
      return;
    }

    try {
      const response = await fetch('/api/security/check-auth', {
        credentials: 'include', // Ensure cookies are sent
      });
      const data = await response.json();

      if (data.requiresReAuth) {
        setNeedsAuth(true);
        setShowReAuth(true);
      } else {
        await action();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      toast.error('Security check failed');
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await checkAuthStatus();
  };

  const handleReAuthSuccess = async () => {
    setShowReAuth(false);
    setNeedsAuth(false);
    await action();
  };

  return (
    <>
      <div onClick={handleClick} style={{ cursor: 'pointer' }}>
        {children}
      </div>

      <ReAuthModal
        isOpen={showReAuth}
        onClose={() => setShowReAuth(false)}
        onSuccess={handleReAuthSuccess}
        reason={
          sensitivityLevel === 'high'
            ? 'This is a highly sensitive action that requires password verification.'
            : undefined
        }
      />
    </>
  );
}
