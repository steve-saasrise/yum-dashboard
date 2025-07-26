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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  User,
  Mail,
  Calendar,
  Settings,
  Edit3,
  X,
  Shield,
  Clock,
  Bell,
} from 'lucide-react';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ProfileEditForm } from '@/components/profile/profile-edit-form';
import { AvatarUpload } from '@/components/profile/avatar-upload';
import { ProfileDataExport } from '@/components/profile/profile-data-export';
import { AccountDeletion } from '@/components/profile/account-deletion';
import { GdprConsentManagement } from '@/components/profile/gdpr-consent-management';

// Mock topics data - in a real app, this would come from your data source
const topics = [
  { id: 1, name: 'AI & Machine Learning', color: 'bg-blue-100 text-blue-800' },
  { id: 2, name: 'Web Development', color: 'bg-green-100 text-green-800' },
  { id: 3, name: 'Startup News', color: 'bg-purple-100 text-purple-800' },
  { id: 4, name: 'Design', color: 'bg-pink-100 text-pink-800' },
  { id: 5, name: 'Product Management', color: 'bg-orange-100 text-orange-800' },
];

export default function ProfilePage() {
  const { updateProfile } = useAuth();
  const user = useUser();
  const profile = useProfile();
  const loading = useAuthLoading();
  const router = useRouter();
  const { toast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Notification settings state
  const [emailDigest, setEmailDigest] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [selectedLounges, setSelectedTopics] = useState<number[]>([1, 2, 3]);

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

  const handleProfileUpdate = async (updates: Record<string, unknown>) => {
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
    } catch {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotificationUpdate = async (
    type: 'email' | 'push' | 'topics',
    value: boolean | number[]
  ) => {
    try {
      // In a real app, you'd save these to your backend
      if (type === 'email') {
        setEmailDigest(value as boolean);
      } else if (type === 'push') {
        setPushNotifications(value as boolean);
      } else if (type === 'topics') {
        setSelectedTopics(value as number[]);
      }

      toast({
        title: 'Settings Updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update notification settings',
        variant: 'destructive',
      });
    }
  };

  const handleTopicToggle = (topicId: number) => {
    const newTopics = selectedLounges.includes(topicId)
      ? selectedLounges.filter((id) => id !== topicId)
      : [...selectedLounges, topicId];
    handleNotificationUpdate('topics', newTopics);
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto py-8 px-4 max-w-6xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/dashboard">Dashboard</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Profile & Settings</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Profile & Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage your personal information, notifications, and preferences
            </p>
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
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profile Information Card */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <User className="h-5 w-5" />
                  Profile Information
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
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
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                            {profile.full_name || 'No name set'}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {profile.email}
                          </p>
                          {profile.username && (
                            <p className="text-gray-600 dark:text-gray-400">
                              @{profile.username}
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600 dark:text-gray-400">
                              Joined:
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {formatDate(profile.created_at)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-gray-600 dark:text-gray-400">
                              Last login:
                            </span>
                            <span className="text-gray-900 dark:text-white">
                              {formatDate(profile.last_sign_in_at)}
                            </span>
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

            {/* Notifications Card */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-white">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Manage your email and push notification preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Email Digest Settings */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                    <Label
                      htmlFor="email-digest"
                      className="font-normal text-gray-900 dark:text-white"
                    >
                      Receive daily email digest
                    </Label>
                    <Switch
                      id="email-digest"
                      checked={emailDigest}
                      onCheckedChange={(checked) =>
                        handleNotificationUpdate('email', checked)
                      }
                    />
                  </div>

                  {emailDigest && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Select lounges for your digest:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topics.map((topic) => (
                          <Badge
                            key={topic.id}
                            variant={
                              selectedLounges.includes(topic.id)
                                ? 'default'
                                : 'outline'
                            }
                            className={`cursor-pointer transition-colors ${
                              selectedLounges.includes(topic.id)
                                ? topic.color
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            onClick={() => handleTopicToggle(topic.id)}
                          >
                            {topic.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Push Notifications */}
                <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
                  <Label
                    htmlFor="push-notifications"
                    className="font-normal text-gray-900 dark:text-white"
                  >
                    Enable push notifications
                  </Label>
                  <Switch
                    id="push-notifications"
                    checked={pushNotifications}
                    onCheckedChange={(checked) =>
                      handleNotificationUpdate('push', checked)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            {/* GDPR Consent Management Card */}
            <GdprConsentManagement />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Avatar Upload Card */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  Profile Picture
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Upload a new avatar image
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AvatarUpload
                  currentAvatar={profile.avatar_url}
                  userInitials={getInitials(profile.full_name)}
                  onAvatarUpdate={handleProfileUpdate}
                />
              </CardContent>
            </Card>

            {/* Account Settings Card */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-gray-900 dark:text-white">
                  <Settings className="h-4 w-4" />
                  Account Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Advanced security settings are configured through your
                    authentication provider.
                  </p>
                </div>

                <Separator />

                <ProfileDataExport />

                <Separator />

                <AccountDeletion />
              </CardContent>
            </Card>

            {/* Account Status Card */}
            <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="text-lg text-gray-900 dark:text-white">
                  Account Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Status
                  </span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    Active
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Email verified
                  </span>
                  <Badge
                    variant="default"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    Verified
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    2FA enabled
                  </span>
                  <Badge
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600"
                  >
                    Not configured
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
