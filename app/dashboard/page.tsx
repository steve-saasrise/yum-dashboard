'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth, useUser, useProfile, useAuthLoading } from '@/hooks/use-auth';
import { LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { signOut } = useAuth();
  const user = useUser();
  const profile = useProfile();
  const loading = useAuthLoading();
  const router = useRouter();

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleSignOut} variant="outline">
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>User Profile</span>
              </CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage
                    src={profile?.avatar_url || user.user_metadata?.avatar_url}
                    alt={profile?.full_name || user.email || 'User'}
                  />
                  <AvatarFallback>
                    {(profile?.full_name || user.email || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <h3 className="font-semibold">
                    {profile?.full_name ||
                      user.user_metadata?.full_name ||
                      'No name set'}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  {profile?.username && (
                    <p className="text-sm text-muted-foreground">
                      @{profile.username}
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">User ID:</span>
                  <span className="text-muted-foreground font-mono">
                    {user.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Email:</span>
                  <span className="text-muted-foreground">{user.email}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Provider:</span>
                  <span className="text-muted-foreground capitalize">
                    {user.app_metadata?.provider || 'email'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Last Sign In:</span>
                  <span className="text-muted-foreground">
                    {user.last_sign_in_at
                      ? new Date(user.last_sign_in_at).toLocaleDateString()
                      : 'Never'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <span className="font-medium">Created:</span>
                  <span className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Authentication Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Authentication Status</CardTitle>
              <CardDescription>Current session information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    ✓ Authenticated
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <span className="font-medium">Email Confirmed:</span>
                    <span className="text-muted-foreground">
                      {user.email_confirmed_at ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="font-medium">Phone Confirmed:</span>
                    <span className="text-muted-foreground">
                      {user.phone_confirmed_at ? '✓ Yes' : '✗ No'}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-2">Available Features:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>✓ Profile management</li>
                    <li>✓ OAuth authentication</li>
                    <li>✓ Magic link login</li>
                    <li>✓ Secure session management</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Testing Authentication</CardTitle>
            <CardDescription>
              OAuth authentication is now working! You successfully logged in
              using{' '}
              <span className="font-semibold capitalize">
                {user.app_metadata?.provider || 'email'}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>✅ Database schema created with user profiles table</p>
              <p>✅ Row Level Security (RLS) policies configured</p>
              <p>✅ OAuth provider integration working</p>
              <p>✅ Automatic profile creation on signup</p>
              <p>✅ Session management and routing</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
