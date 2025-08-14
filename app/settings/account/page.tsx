'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProtectedAction } from '@/components/security/protected-action';
import { toast } from 'sonner';
import { User, Mail, Key, CreditCard, Trash2, Loader2 } from 'lucide-react';

export default function AccountSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const supabase = createClient();

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: email,
      });

      if (error) throw error;

      toast.success('Verification email sent to new address');
      setEmail('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'Are you sure you want to delete your account? This action cannot be undone.'
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // In production, you'd call an API endpoint to delete the user
      toast.success(
        'Account deletion requested. You will receive a confirmation email.'
      );
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const handleViewBilling = async () => {
    // Redirect to billing page or show billing modal
    toast.info('Redirecting to billing...');
  };

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <User className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Account Settings</h1>
      </div>

      {/* Password Change - High Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>
            Update your account password. This requires re-authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </div>
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
            />
          </div>
          <ProtectedAction
            action={handleChangePassword}
            sensitivityLevel="high"
          >
            <Button disabled={loading || !newPassword || !confirmPassword}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Password'
              )}
            </Button>
          </ProtectedAction>
        </CardContent>
      </Card>

      {/* Email Change - Medium Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            <CardTitle>Change Email</CardTitle>
          </div>
          <CardDescription>
            Update your account email address. Requires verification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="new-email">New Email Address</Label>
            <Input
              id="new-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter new email address"
            />
          </div>
          <ProtectedAction action={handleChangeEmail} sensitivityLevel="medium">
            <Button disabled={loading || !email}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Email'
              )}
            </Button>
          </ProtectedAction>
        </CardContent>
      </Card>

      {/* Billing - High Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <CardTitle>Billing & Subscription</CardTitle>
          </div>
          <CardDescription>
            Manage your subscription and payment methods
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProtectedAction action={handleViewBilling} sensitivityLevel="high">
            <Button variant="outline">View Billing Details</Button>
          </ProtectedAction>
        </CardContent>
      </Card>

      {/* Account Deletion - High Security */}
      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Permanently delete your account and all associated data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProtectedAction action={handleDeleteAccount} sensitivityLevel="high">
            <Button variant="destructive" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Delete Account'
              )}
            </Button>
          </ProtectedAction>
        </CardContent>
      </Card>
    </div>
  );
}
