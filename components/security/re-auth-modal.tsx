'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  reason?: string;
}

export function ReAuthModal({
  isOpen,
  onClose,
  onSuccess,
  reason,
}: ReAuthModalProps) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createClient();

  const handleReAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error('No user session');

      // Re-authenticate with password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (authError) {
        if (authError.message.includes('Invalid login')) {
          setError('Incorrect password. Please try again.');

          // Track failed attempt
          await fetch('/api/security/failed-auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', // Ensure cookies are sent
            body: JSON.stringify({ email: user.email }),
          });
        } else {
          setError(authError.message);
        }
        return;
      }

      // Update last password verification timestamp
      await fetch('/api/security/verify-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Ensure cookies are sent
      });

      toast.success('Authentication verified');
      setPassword('');
      onSuccess();
    } catch (error: any) {
      console.error('Re-authentication error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <DialogTitle>Verify Your Identity</DialogTitle>
          </div>
          <DialogDescription>
            {reason ||
              'For your security, please re-enter your password to continue with this sensitive action.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleReAuthenticate} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
