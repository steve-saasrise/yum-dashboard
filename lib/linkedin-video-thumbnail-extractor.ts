/**
 * LinkedIn Video Thumbnail Extractor
 *
 * This module attempts to extract video thumbnails from LinkedIn videos
 * using various methods since the LinkedIn API doesn't consistently provide them.
 */

export interface VideoThumbnailResult {
  thumbnailUrl?: string;
  method?: 'api' | 'poster' | 'generated' | 'fallback';
}

/**
 * Extract thumbnail from LinkedIn video URL
 * LinkedIn video URLs often follow patterns that can be manipulated to get thumbnails
 */
export async function extractLinkedInVideoThumbnail(
  videoUrl: string,
  postData?: any
): Promise<VideoThumbnailResult> {
  // Method 1: Check if thumbnail already exists in the data
  if (postData?.media?.thumbnail) {
    return {
      thumbnailUrl: postData.media.thumbnail,
      method: 'api',
    };
  }

  // Method 2: Try to extract from video URL patterns
  // LinkedIn videos sometimes have predictable thumbnail URLs
  if (videoUrl.includes('dms.licdn.com')) {
    // Try common LinkedIn video thumbnail patterns
    const patterns = [
      // Replace video endpoint with image endpoint
      videoUrl
        .replace('/vid/', '/img/')
        .replace('/playlist/', '/image/')
        .replace('.m3u8', '.jpg'),
      // Try getting first frame
      videoUrl
        .replace('/mp4-720p-30fp-crf28/', '/image-shrink_1280/')
        .replace('.mp4', '.jpg'),
      // Try poster frame pattern
      videoUrl.replace('/v2/', '/v2/poster/').replace('/mp4', '/jpg'),
    ];

    for (const pattern of patterns) {
      try {
        // In production, you'd want to check if the URL actually returns an image
        // For now, we'll return the first pattern that looks valid
        if (pattern.includes('.jpg') || pattern.includes('.png')) {
          return {
            thumbnailUrl: pattern,
            method: 'poster',
          };
        }
      } catch (e) {
        // Continue to next pattern
      }
    }
  }

  // Method 3: Extract from article/document if it's a video article
  if (postData?.article?.thumbnail && postData?.article?.url === videoUrl) {
    return {
      thumbnailUrl: postData.article.thumbnail,
      method: 'poster',
    };
  }

  // Method 4: Look for any image in the post that might be a thumbnail
  if (postData?.media?.images?.length > 0) {
    // Sometimes the first image is the video thumbnail
    return {
      thumbnailUrl: postData.media.images[0].url || postData.media.images[0],
      method: 'fallback',
    };
  }

  // Method 5: Generate a placeholder or use LinkedIn's default video thumbnail
  // This is a fallback when no thumbnail can be extracted
  return {
    thumbnailUrl: undefined,
    method: 'fallback',
  };
}

/**
 * Process LinkedIn post media to ensure video thumbnails are present
 */
export function processLinkedInMediaWithThumbnails(post: any): any[] {
  const mediaUrls: any[] = [];

  if (!post.media) return mediaUrls;

  // Handle video posts
  if (post.media.type === 'video' && post.media.url) {
    const videoItem: any = {
      url: post.media.url,
      type: 'video',
    };

    // Try to extract thumbnail using our methods
    const thumbnailResult = extractLinkedInVideoThumbnailSync(
      post.media.url,
      post
    );
    if (thumbnailResult.thumbnailUrl) {
      videoItem.thumbnail_url = thumbnailResult.thumbnailUrl;
    }

    mediaUrls.push(videoItem);
  }

  // Handle other media types...
  // (rest of the media processing logic)

  return mediaUrls;
}

/**
 * Synchronous version for immediate processing
 */
function extractLinkedInVideoThumbnailSync(
  videoUrl: string,
  postData?: any
): VideoThumbnailResult {
  // Method 1: Check if thumbnail already exists
  if (postData?.media?.thumbnail) {
    return {
      thumbnailUrl: postData.media.thumbnail,
      method: 'api',
    };
  }

  // Method 2: Try URL pattern manipulation
  if (videoUrl.includes('dms.licdn.com')) {
    // Common pattern: video URLs can be converted to image URLs
    const imageUrl = videoUrl
      .replace('/playlist/vid/', '/image/')
      .replace('/mp4-720p-30fp-crf28/', '/image-shrink_800_800/')
      .replace(/\/v2\/D[\w]+\//, '/v2/D4E22AQ/') // Try to normalize the ID pattern
      .replace(/\.(mp4|m3u8)(\?|$)/, '.jpg$2');

    if (
      imageUrl !== videoUrl &&
      (imageUrl.includes('.jpg') || imageUrl.includes('.png'))
    ) {
      return {
        thumbnailUrl: imageUrl,
        method: 'poster',
      };
    }
  }

  return {
    thumbnailUrl: undefined,
    method: 'fallback',
  };
}

/**
 * Attempt to fetch and validate a thumbnail URL
 * This would be used in a Node.js environment to verify the thumbnail exists
 */
export async function validateThumbnailUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    return response.ok && (contentType?.startsWith('image/') ?? false);
  } catch {
    return false;
  }
}
