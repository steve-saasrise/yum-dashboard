import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractInstagramImageId(url: string): string | null {
  // Instagram/Threads image URLs contain a unique identifier like:
  // 519644274_17916530556112190_2138150983724420103
  // This appears before .webp, .jpg, .png etc

  const patterns = [
    // Main pattern: long number sequence before file extension
    /\/(\d+_\d+_\d+)_n\./,
    // Alternative pattern
    /\/(\d{10,}_\d{10,}_\d{10,})/,
    // Video pattern
    /\/v\d+\.[\d-]+\/([A-Za-z0-9_-]+)\./,
    // Fallback to any long alphanumeric sequence
    /\/([A-Za-z0-9_-]{20,})(?:\.|\/|$)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // If no pattern matches, use the full path as a fallback
  try {
    const urlObj = new URL(url);
    // Remove size parameters and return the path
    const pathWithoutParams = urlObj.pathname.replace(
      /s\d+x\d+|c[\d.]+a?_dst-jpg/g,
      ''
    );
    return pathWithoutParams;
  } catch {
    return null;
  }
}

async function fixThreadsFinal() {
  console.log('Starting FINAL Threads cleanup with proper deduplication...\n');

  // Get all Threads posts
  const { data: posts, error } = await supabase
    .from('content')
    .select('id, title, media_urls, platform')
    .eq('platform', 'threads')
    .not('media_urls', 'is', null);

  if (error || !posts) {
    console.error('Error fetching posts:', error);
    return;
  }

  console.log(`Found ${posts.length} Threads posts to check`);

  let fixedCount = 0;
  let totalImagesBefore = 0;
  let totalImagesAfter = 0;

  for (const post of posts) {
    if (!post.media_urls || !Array.isArray(post.media_urls)) continue;

    const originalCount = post.media_urls.length;
    totalImagesBefore += originalCount;

    // Track unique image IDs
    const seenImageIds = new Set<string>();
    const uniqueImages: any[] = [];

    for (const media of post.media_urls) {
      if (!media.url) continue;

      // Extract the unique image ID from the URL
      const imageId = extractInstagramImageId(media.url);

      if (imageId && seenImageIds.has(imageId)) {
        // This is a duplicate - check if we should replace with higher quality
        const existingIndex = uniqueImages.findIndex((img) => {
          const existingId = extractInstagramImageId(img.url);
          return existingId === imageId;
        });

        if (existingIndex !== -1) {
          const existing = uniqueImages[existingIndex];
          // Keep the larger/higher quality version
          if (media.width && existing.width && media.width > existing.width) {
            uniqueImages[existingIndex] = media;
          }
        }
      } else {
        // New unique image
        if (imageId) {
          seenImageIds.add(imageId);
        }
        uniqueImages.push(media);
      }
    }

    const newCount = uniqueImages.length;
    totalImagesAfter += newCount;

    // Only update if we actually removed duplicates
    if (newCount < originalCount) {
      const { error: updateError } = await supabase
        .from('content')
        .update({
          media_urls: uniqueImages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', post.id);

      if (updateError) {
        console.error(`Error updating post ${post.id}:`, updateError);
      } else {
        console.log(
          `✓ Fixed: ${post.title?.substring(0, 50)}... (${originalCount} → ${newCount} images)`
        );
        fixedCount++;
      }
    }
  }

  console.log('\n=== Final Cleanup Summary ===');
  console.log(`Posts checked: ${posts.length}`);
  console.log(`Posts fixed: ${fixedCount}`);
  console.log(`Total images before: ${totalImagesBefore}`);
  console.log(`Total images after: ${totalImagesAfter}`);
  console.log(`Images removed: ${totalImagesBefore - totalImagesAfter}`);

  // Verify the worst cases are fixed
  const { data: checkPosts } = await supabase
    .from('content')
    .select('id, title, media_urls')
    .eq('platform', 'threads')
    .not('media_urls', 'is', null)
    .order('media_urls', { ascending: false })
    .limit(10);

  if (checkPosts) {
    console.log('\n=== Top posts by image count after cleanup ===');
    let hasHighCount = false;
    for (const post of checkPosts) {
      const imageCount = post.media_urls?.length || 0;
      if (imageCount > 3) {
        hasHighCount = true;
        console.log(
          `- ${post.title?.substring(0, 50)}... : ${imageCount} images`
        );
      }
    }
    if (!hasHighCount) {
      console.log('✅ All posts now have 3 or fewer images!');
    }
  }
}

fixThreadsFinal();
