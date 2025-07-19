'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import { useUser } from '@/hooks/use-auth';

interface AvatarUploadProps {
  currentAvatar?: string;
  userInitials: string;
  onAvatarUpdate: (updates: { avatar_url: string }) => Promise<void>;
}

export function AvatarUpload({
  currentAvatar,
  userInitials,
  onAvatarUpdate,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const user = useUser();
  const supabase = createBrowserSupabaseClient();

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (PNG, JPG, or WebP).',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 2MB.',
        variant: 'destructive',
      });
      return;
    }

    // Auto-upload immediately after selection
    await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!user?.id) {
      toast({
        title: 'Upload failed',
        description: 'Please log in to upload an avatar.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        // Upload error - will be thrown below
        throw new Error(uploadError.message);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

      // Delete old avatar if it exists
      if (currentAvatar) {
        try {
          const oldPath = currentAvatar.split('/avatars/')[1];
          if (oldPath && oldPath !== fileName) {
            const { error: deleteError } = await supabase.storage
              .from('avatars')
              .remove([`avatars/${oldPath}`]);

            if (deleteError) {
              // Failed to delete old avatar - not critical
            }
          }
        } catch {
          // Failed to delete old avatar - not critical
        }
      }

      // Update profile
      await onAvatarUpdate({ avatar_url: publicUrl });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully.',
      });
    } catch (error) {
      // Avatar upload error - handled by toast

      let errorMessage =
        'Failed to update your profile picture. Please try again.';

      if (
        error instanceof Error &&
        error.message?.includes('Storage bucket not found')
      ) {
        errorMessage =
          'Avatar storage is not configured. Please contact support.';
      } else if (
        error instanceof Error &&
        error.message?.includes('Duplicate')
      ) {
        errorMessage = 'Upload conflict detected. Please try again.';
      } else if (
        error instanceof Error &&
        error.message?.includes('permission')
      ) {
        errorMessage =
          "You don't have permission to upload avatars. Please contact support.";
      } else if (error instanceof Error && error.message?.includes('policy')) {
        errorMessage =
          'Storage permissions are not configured. Please contact support.';
      }

      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatar || !user?.id) return;

    setIsUploading(true);
    try {
      const oldPath = currentAvatar.split('/avatars/')[1];
      if (oldPath) {
        const { error: deleteError } = await supabase.storage
          .from('avatars')
          .remove([`avatars/${oldPath}`]);

        if (deleteError) {
          // Delete error - will be thrown below
          throw new Error(deleteError.message);
        }
      }

      await onAvatarUpdate({ avatar_url: '' });

      toast({
        title: 'Avatar removed',
        description: 'Your profile picture has been removed.',
      });
    } catch {
      // Remove avatar error - handled by toast
      toast({
        title: 'Remove failed',
        description: 'Failed to remove your profile picture. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={currentAvatar} alt="Profile picture" />
            <AvatarFallback className="text-lg">{userInitials}</AvatarFallback>
          </Avatar>

          {/* Loading overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </Button>

          {currentAvatar && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={isUploading}
              className="gap-2 text-destructive hover:text-destructive"
            >
              <X className="h-4 w-4" />
              Remove Avatar
            </Button>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        PNG, JPG or WebP. Max size 2MB.
      </p>
    </div>
  );
}
