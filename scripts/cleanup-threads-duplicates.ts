import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanupThreadsDuplicates() {
  console.log('Starting Threads duplicate image cleanup...\n');

  // Get all Threads posts with multiple images
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

    // Group images by their base URL (without size parameters)
    // or by dimensions to identify duplicates
    const uniqueImages = new Map<string, any>();
    const seenDimensions = new Set<string>();

    for (const media of post.media_urls) {
      if (!media.url) continue;

      // Create a key based on dimensions if available
      // Images with the same content but different resolutions will have proportional dimensions
      const dimensionKey = media.width && media.height 
        ? `${media.type}_${Math.round((media.width / media.height) * 100)}` 
        : media.url;

      // For Threads, if we see the same aspect ratio, it's likely the same image
      // Keep only the first (highest quality) version
      if (!seenDimensions.has(dimensionKey)) {
        seenDimensions.add(dimensionKey);
        uniqueImages.set(media.url, media);
      }
    }

    const cleanedMediaUrls = Array.from(uniqueImages.values());
    const newCount = cleanedMediaUrls.length;
    totalImagesAfter += newCount;

    // Only update if we actually removed duplicates
    if (newCount < originalCount) {
      const { error: updateError } = await supabase
        .from('content')
        .update({ 
          media_urls: cleanedMediaUrls,
          updated_at: new Date().toISOString()
        })
        .eq('id', post.id);

      if (updateError) {
        console.error(`Error updating post ${post.id}:`, updateError);
      } else {
        console.log(`✓ Fixed: ${post.title?.substring(0, 50)}... (${originalCount} → ${newCount} images)`);
        fixedCount++;
      }
    }
  }

  console.log('\n=== Cleanup Summary ===');
  console.log(`Posts checked: ${posts.length}`);
  console.log(`Posts fixed: ${fixedCount}`);
  console.log(`Total images before: ${totalImagesBefore}`);
  console.log(`Total images after: ${totalImagesAfter}`);
  console.log(`Images removed: ${totalImagesBefore - totalImagesAfter}`);

  // Show some examples of the most affected posts
  const { data: worstPosts } = await supabase
    .from('content')
    .select('id, title, media_urls')
    .eq('platform', 'threads')
    .not('media_urls', 'is', null)
    .order('media_urls', { ascending: false })
    .limit(5);

  if (worstPosts && worstPosts.length > 0) {
    console.log('\n=== Posts with most images after cleanup ===');
    for (const post of worstPosts) {
      const imageCount = post.media_urls?.length || 0;
      console.log(`- ${post.title?.substring(0, 50)}... : ${imageCount} images`);
    }
  }
}

cleanupThreadsDuplicates();