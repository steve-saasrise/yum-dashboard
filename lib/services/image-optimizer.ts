import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export class ImageOptimizer {
  private static supabase: ReturnType<typeof createClient> | null = null;

  private static getSupabaseClient() {
    if (!this.supabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        this.supabase = createClient(supabaseUrl, supabaseServiceKey);
      }
    }
    return this.supabase;
  }

  /**
   * Crop and resize any image to exact dimensions for email digest
   * Always fills the container perfectly with center cropping
   */
  static async cropForEmailHero(
    imageUrl: string,
    width: number = 560,
    height: number = 315
  ): Promise<string | null> {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) {
        console.error('Supabase client not initialized');
        return imageUrl; // Return original if we can't store the cropped version
      }

      // Generate a unique hash for this image + dimensions combination
      const cacheKey = crypto
        .createHash('md5')
        .update(`${imageUrl}-${width}x${height}`)
        .digest('hex');
      const fileName = `${cacheKey}.jpg`;
      const bucketName = 'email-images';

      // Check if we already have this cropped image
      const { data: existingFile } = await supabase.storage
        .from(bucketName)
        .list('', {
          limit: 1,
          search: fileName,
        });

      if (existingFile && existingFile.length > 0) {
        // Return the existing cropped image URL
        const {
          data: { publicUrl },
        } = supabase.storage.from(bucketName).getPublicUrl(fileName);
        console.log('Using cached cropped image:', publicUrl);
        return publicUrl;
      }

      // Fetch and crop the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`Failed to fetch image: ${imageUrl}`);
        return imageUrl;
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Crop to exact dimensions, centered, always fills the space
      const processedBuffer = await sharp(imageBuffer)
        .resize(width, height, {
          fit: 'cover', // This ensures it fills the space
          position: 'center', // Center crop
        })
        .jpeg({
          quality: 85,
          progressive: true,
        })
        .toBuffer();

      // Ensure the bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === bucketName);

      if (!bucketExists) {
        console.log('Creating email-images bucket...');
        const { error: createError } = await supabase.storage.createBucket(
          bucketName,
          {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          }
        );
        if (createError && !createError.message?.includes('already exists')) {
          console.error('Error creating bucket:', createError);
          return imageUrl;
        }
      }

      // Upload the cropped image
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, processedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Error uploading cropped image:', uploadError);
        return imageUrl;
      }

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(fileName);

      console.log('Cropped image uploaded successfully:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error cropping image:', error);
      return imageUrl; // Fallback to original
    }
  }

  /**
   * Clean up old cropped images (older than 30 days)
   * Can be called via cron job to maintain storage
   */
  static async cleanupOldImages(): Promise<{ deleted: number }> {
    try {
      const supabase = this.getSupabaseClient();
      if (!supabase) {
        return { deleted: 0 };
      }

      const bucketName = 'email-images';
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // List all files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list();

      if (listError || !files) {
        console.error('Error listing files:', listError);
        return { deleted: 0 };
      }

      let deletedCount = 0;
      const filesToDelete: string[] = [];

      // Check each file's age
      for (const file of files) {
        if (file.created_at) {
          const createdDate = new Date(file.created_at);
          if (createdDate < thirtyDaysAgo) {
            filesToDelete.push(file.name);
          }
        }
      }

      // Delete old files in batches
      if (filesToDelete.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(bucketName)
          .remove(filesToDelete);

        if (deleteError) {
          console.error('Error deleting files:', deleteError);
        } else {
          deletedCount = filesToDelete.length;
          console.log(`Deleted ${deletedCount} old cropped images`);
        }
      }

      return { deleted: deletedCount };
    } catch (error) {
      console.error('Error cleaning up old images:', error);
      return { deleted: 0 };
    }
  }
}
