'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser, useAuthLoading, useProfile } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Mail,
  Calendar,
  Settings,
  Edit3,
  Save,
  X,
  Download,
  Trash2,
  ArrowLeft,
  Shield,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { ProfileDataExport } from '@/components/profile/profile-data-export';
import { AccountDeletion } from '@/components/profile/account-deletion';

export default function ProfilePage() {
  const { updateProfile, signOut } = useAuth();
  const user = useUser();
  const profile = useProfile();
  const loading = useAuthLoading();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Redirect if not authenticated
  if (!loading && !user) {
    router.push('/auth/login?redirectTo=/profile');
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  const handleProfileUpdate = async (updates: any) => {
    setIsUpdating(true);
    try {
      const { error } = await updateProfile(updates);

      if (error) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to update profile',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Profile Updated',
          description: 'Your profile has been successfully updated.',
        });
        setIsEditing(false);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return profile.email?.[0]?.toUpperCase() || 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Profile</h1>
              <p className="text-muted-foreground">
                Manage your personal information and preferences
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)} className="gap-2">
                <Edit3 className="h-4 w-4" />
                Edit Profile
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsEditing(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Overview Card */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription>
                  Your personal details and account information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!isEditing ? (
                  <>
                    {/* Profile Display */}
                    <div className="flex items-start gap-6">
                      <div className="flex-shrink-0">
                        <Avatar className="h-24 w-24">
                          <AvatarImage
                            src={profile.avatar_url}
                            alt={profile.full_name || profile.email}
                          />
                          <AvatarFallback className="text-lg">
                            {getInitials(profile.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </div>

                      <div className="flex-1 space-y-4">
                        <div>
                          <h3 className="text-xl font-semibold">
                            {profile.full_name || 'No name set'}
                          </h3>
                          <p className="text-muted-foreground flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {profile.email}
                          </p>
                          {profile.username && (
                            <p className="text-muted-foreground">
                              @{profile.username}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Joined:
                            </span>
                            <span>{formatDate(profile.created_at)}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              Last login:
                            </span>
                            <span>{formatDate(profile.last_sign_in_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Profile Edit Form */
                  <ProfileEditForm
                    profile={profile}
                    onSave={handleProfileUpdate}
                    onCancel={() => setIsEditing(false)}
                    isLoading={isUpdating}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Avatar Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Profile Picture</CardTitle>
                <CardDescription>Upload a new avatar image</CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUpload
                  currentAvatar={profile.avatar_url}
                  userInitials={getInitials(profile.full_name)}
                  onAvatarUpdate={handleProfileUpdate}
                />
              </CardContent>
            </Card>

            {/* Account Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  asChild
                >
                  <Link href="/settings">
                    <Shield className="h-4 w-4" />
                    Privacy & Security
                  </Link>
                </Button>

                <Separator />

                <ProfileDataExport />

                <Separator />

                <AccountDeletion />
              </CardContent>
            </Card>

            {/* Account Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Account Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Email verified
                  </span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800"
                  >
                    Verified
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    2FA enabled
                  </span>
                  <Badge variant="outline">Not configured</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
