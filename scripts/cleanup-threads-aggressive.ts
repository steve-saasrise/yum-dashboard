import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function extractImageId(url: string): string | null {
  // Instagram/Threads URLs often have patterns like:
  // https://scontent.cdninstagram.com/v/t51.29350-15/{IMAGE_ID}.jpg?...
  // or contain the image ID in other parts of the URL
  
  // Try to extract a stable identifier from the URL
  const patterns = [
    /\/([A-Za-z0-9_-]{10,})\.jpg/,  // Direct image ID before .jpg
    /\/([A-Za-z0-9_-]{10,})\.png/,  // Direct image ID before .png
    /\/([A-Za-z0-9_-]{10,})\.webp/, // Direct image ID before .webp
    /\/t51\.[\d-]+\/(\d+_\d+_\d+_\w+)/, // Threads/Instagram pattern
    /\/([A-Za-z0-9]{32,})/, // Long hash in path
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // If no pattern matches, use the URL path without query params as ID
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return null;
  }
}

function areImagesSimilar(img1: any, img2: any): boolean {
  // Check if these are the same image by comparing:
  // 1. URL patterns (might be same image, different CDN or params)
  // 2. Dimensions (cropped versions will have different aspect ratios but one dimension might match)
  
  const id1 = extractImageId(img1.url);
  const id2 = extractImageId(img2.url);
  
  // If we can extract IDs and they match, they're the same image
  if (id1 && id2 && id1 === id2) {
    return true;
  }

  // Check if one image might be a crop of the other
  // If images share either width or height, they might be crops
  if (img1.width && img1.height && img2.width && img2.height) {
    const sameWidth = Math.abs(img1.width - img2.width) < 10; // Allow small differences
    const sameHeight = Math.abs(img1.height - img2.height) < 10;
    
    // If they share one dimension, they might be crops
    if (sameWidth || sameHeight) {
      return true;
    }

    // Check if one is a scaled version of the other (same aspect ratio)
    const ratio1 = img1.width / img1.height;
    const ratio2 = img2.width / img2.height;
    const ratioDiff = Math.abs(ratio1 - ratio2);
    
    // If aspect ratios are very close (within 0.01), consider them the same
    if (ratioDiff < 0.01) {
      return true;
    }
  }

  return false;
}

async function cleanupThreadsAggressively() {
  console.log('Starting aggressive Threads duplicate cleanup...\n');

  // Focus on posts with more than 5 images
  const { data: posts, error } = await supabase
    .from('content')
    .select('id, title, media_urls, platform')
    .eq('platform', 'threads')
    .not('media_urls', 'is', null);

  if (error || !posts) {
    console.error('Error fetching posts:', error);
    return;
  }

  // Filter to posts with multiple images
  const problematicPosts = posts.filter(p => 
    p.media_urls && Array.isArray(p.media_urls) && p.media_urls.length > 4
  );

  console.log(`Found ${problematicPosts.length} Threads posts with 5+ images to clean`);

  let fixedCount = 0;
  let totalImagesBefore = 0;
  let totalImagesAfter = 0;

  for (const post of problematicPosts) {
    const originalCount = post.media_urls.length;
    totalImagesBefore += originalCount;

    // Deduplicate images more aggressively
    const uniqueImages: any[] = [];
    
    for (const media of post.media_urls) {
      if (!media.url) continue;

      // Check if this image is similar to any already added
      let isDuplicate = false;
      for (const existing of uniqueImages) {
        if (areImagesSimilar(media, existing)) {
          isDuplicate = true;
          // If this is higher quality (larger), replace the existing one
          if (media.width && existing.width && media.width > existing.width) {
            const index = uniqueImages.indexOf(existing);
            uniqueImages[index] = media;
          }
          break;
        }
      }

      if (!isDuplicate) {
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

  console.log('\n=== Aggressive Cleanup Summary ===');
  console.log(`Posts checked: ${problematicPosts.length}`);
  console.log(`Posts fixed: ${fixedCount}`);
  console.log(`Total images before: ${totalImagesBefore}`);
  console.log(`Total images after: ${totalImagesAfter}`);
  console.log(`Images removed: ${totalImagesBefore - totalImagesAfter}`);

  // Show the current state
  const { data: stillHighPosts } = await supabase
    .from('content')
    .select('id, title, media_urls')
    .eq('platform', 'threads')
    .not('media_urls', 'is', null)
    .order('media_urls', { ascending: false })
    .limit(10);

  if (stillHighPosts && stillHighPosts.length > 0) {
    console.log('\n=== Posts with most images after aggressive cleanup ===');
    for (const post of stillHighPosts) {
      const imageCount = post.media_urls?.length || 0;
      if (imageCount > 4) {
        console.log(`- ${post.title?.substring(0, 50)}... : ${imageCount} images`);
        
        // Show first few URLs to understand the pattern
        if (imageCount > 10 && post.media_urls) {
          console.log('  Sample URLs:');
          post.media_urls.slice(0, 3).forEach((m: any, i: number) => {
            console.log(`    ${i + 1}. ${m.url?.substring(0, 80)}...`);
          });
        }
      }
    }
  }
}

cleanupThreadsAggressively();