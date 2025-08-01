'use client';

import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Upload, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createBrowserSupabaseClient } from '@/lib/supabase';

interface CreatorAvatarUploadProps {
  creatorId?: string; // Optional for new creators
  currentAvatar?: string;
  creatorName: string;
  onAvatarChange: (avatarUrl: string) => void;
  disabled?: boolean;
}

export function CreatorAvatarUpload({
  creatorId,
  currentAvatar,
  creatorName,
  onAvatarChange,
  disabled = false,
}: CreatorAvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(
    currentAvatar
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
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

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // For new creators, just store the file and preview
    if (!creatorId) {
      // Store the file in the component for later upload
      (fileInputRef.current as any)._pendingFile = file;
      return;
    }

    // For existing creators, upload immediately
    await handleUpload(file);
  };

  const handleUpload = async (file: File) => {
    if (!creatorId) {
      toast({
        title: 'Upload failed',
        description: 'Creator must be saved before uploading an avatar.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique file path
      const fileExt = file.name.split('.').pop()?.toLowerCase();
      const fileName = `${creatorId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('creators')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from('creators').getPublicUrl(filePath);

      // Delete old avatar if it exists
      if (currentAvatar && currentAvatar !== previewUrl) {
        try {
          const oldPath = currentAvatar.split('/creators/')[1];
          if (oldPath) {
            await supabase.storage.from('creators').remove([oldPath]);
          }
        } catch {
          // Failed to delete old avatar - not critical
        }
      }

      // Update the avatar URL
      onAvatarChange(publicUrl);
      setPreviewUrl(publicUrl);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        (fileInputRef.current as any)._pendingFile = null;
      }

      toast({
        title: 'Avatar updated',
        description: 'Creator avatar has been updated successfully.',
      });
    } catch (error) {
      let errorMessage = 'Failed to update creator avatar. Please try again.';

      if (
        error instanceof Error &&
        error.message?.includes('Storage bucket not found')
      ) {
        errorMessage =
          'Creator avatar storage is not configured. Please contact support.';
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
    if (!currentAvatar) return;

    setIsUploading(true);
    try {
      if (creatorId) {
        const oldPath = currentAvatar.split('/creators/')[1];
        if (oldPath) {
          await supabase.storage.from('creators').remove([oldPath]);
        }
      }

      onAvatarChange('');
      setPreviewUrl(undefined);

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        (fileInputRef.current as any)._pendingFile = null;
      }

      toast({
        title: 'Avatar removed',
        description: 'Creator avatar has been removed.',
      });
    } catch {
      toast({
        title: 'Remove failed',
        description: 'Failed to remove creator avatar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Method to upload pending file (called from parent when creating new creator)
  const uploadPendingFile = async (newCreatorId: string) => {
    const pendingFile = (fileInputRef.current as any)?._pendingFile;
    if (!pendingFile) return null;

    creatorId = newCreatorId;
    const result = await handleUpload(pendingFile);
    return result;
  };

  // Expose method to parent
  if (fileInputRef.current) {
    (fileInputRef.current as any).uploadPendingFile = uploadPendingFile;
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar className="h-16 w-16">
          <AvatarImage src={previewUrl} alt={creatorName} />
          <AvatarFallback className="text-sm">
            {getInitials(creatorName)}
          </AvatarFallback>
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
        disabled={disabled || isUploading}
      />

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {isUploading ? 'Uploading...' : 'Upload Image'}
        </Button>

        {previewUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemoveAvatar}
            disabled={disabled || isUploading}
            className="gap-2 text-destructive hover:text-destructive"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}
