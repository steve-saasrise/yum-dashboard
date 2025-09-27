// OpenGraph service for fetching metadata from URLs
import { fetchOpenGraphMetadata } from './opengraph-fetcher';
import { AIImageService } from './ai-image-service';

interface OpenGraphData {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  url: string;
  aiGenerated?: boolean;
}

export class OpenGraphService {
  private static sessionImageUrls = new Map<string, string>(); // Track first valid image per domain
  private static globalUsedImages = new Set<string>(); // Track all used images across the entire digest session
  private static sessionActive = false; // Track if we're in an active session

  /**
   * Start a new digest session (call at the beginning of digest generation)
   */
  static startDigestSession(): void {
    this.sessionActive = true;
    this.sessionImageUrls.clear();
    this.globalUsedImages.clear();
    console.log(
      '[OpenGraphService] Started new digest session - sessionActive set to:',
      this.sessionActive
    );
  }

  /**
   * End the digest session (call at the end of digest generation)
   */
  static endDigestSession(): void {
    this.sessionActive = false;
    this.sessionImageUrls.clear();
    this.globalUsedImages.clear();
    console.log('Ended digest session - cleared all image caches');
  }

  /**
   * Clear session cache (deprecated - use startDigestSession instead)
   */
  static clearSessionCache(): void {
    // Only clear if not in an active session
    if (!this.sessionActive) {
      this.sessionImageUrls.clear();
      this.globalUsedImages.clear();
      console.log('Cleared OpenGraph session image cache');
    }
  }
  /**
   * Fetch OpenGraph metadata from a URL
   * Now uses direct function call instead of HTTP request for better performance
   * and reliability in server-side contexts
   */
  static async fetchMetadata(url: string): Promise<OpenGraphData | null> {
    try {
      // Direct function call - no HTTP request needed
      const metadata = await fetchOpenGraphMetadata(url);
      return metadata;
    } catch (error) {
      console.error(`Error fetching OpenGraph data for ${url}:`, error);
      return null;
    }
  }

  /**
   * Fetch OpenGraph images for multiple URLs in parallel with AI fallback
   */
  static async fetchBulkImages(
    items: Array<{
      url: string;
      id?: string;
      title?: string;
      source?: string;
      isBigStory?: boolean;
      imagePrompt?: {
        concept: string;
        style: string;
        mood: string;
        colors: string;
        elements: string[];
        composition: string;
        avoid: string[];
      };
    }>,
    category?: string
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const aiImageService = AIImageService.getInstance();

    // Only clear caches if not in an active session
    console.log(
      '[OpenGraphService] Session active status:',
      this.sessionActive
    );
    if (!this.sessionActive) {
      console.log('[OpenGraphService] No active session, clearing caches');
      this.clearSessionCache();
    } else {
      console.log('[OpenGraphService] Session is active, NOT clearing caches');
    }

    const failedItems: Array<{
      url: string;
      title?: string;
      source?: string;
      isBigStory?: boolean;
      imagePrompt?: {
        concept: string;
        style: string;
        mood: string;
        colors: string;
        elements: string[];
        composition: string;
        avoid: string[];
      };
    }> = [];

    // Process in batches to avoid overwhelming the service
    const batchSize = 5;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const promises = batch.map(async (item) => {
        const metadata = await this.fetchMetadata(item.url);

        if (metadata?.imageUrl) {
          console.log(`OG image found for ${item.url}: ${metadata.imageUrl}`);

          // Check if this exact image URL has already been used globally
          if (this.globalUsedImages.has(metadata.imageUrl)) {
            console.log(
              `✓ Duplicate OG image detected globally for ${item.url}, will use fallback`
            );
            // Track as failed to trigger fallback image generation
            failedItems.push({
              url: item.url,
              title: item.title,
              source: item.source,
              isBigStory: item.isBigStory,
              imagePrompt: item.imagePrompt,
            });
            return { url: item.url, imageUrl: null };
          }

          // Extract domain from article URL
          const domain = new URL(item.url).hostname.replace('www.', '');

          // Check if this domain already has a representative image
          const existingDomainImage = this.sessionImageUrls.get(domain);

          if (existingDomainImage) {
            // Check if this is the same image (domain logo/default image)
            if (metadata.imageUrl === existingDomainImage) {
              console.log(
                `✓ Duplicate domain image for ${domain}, will use fallback`
              );
              failedItems.push({
                url: item.url,
                title: item.title,
                source: item.source,
                isBigStory: item.isBigStory,
                imagePrompt: item.imagePrompt,
              });
              return { url: item.url, imageUrl: null };
            }
          } else {
            // First image from this domain, store it
            this.sessionImageUrls.set(domain, metadata.imageUrl);
            console.log(
              `First image for domain ${domain}: ${metadata.imageUrl}`
            );
          }

          // Mark this image as used globally
          this.globalUsedImages.add(metadata.imageUrl);

          return { url: item.url, imageUrl: metadata.imageUrl };
        } else {
          // Track items that need AI fallback
          failedItems.push({
            url: item.url,
            title: item.title,
            source: item.source,
            isBigStory: item.isBigStory,
            imagePrompt: item.imagePrompt,
          });
          return { url: item.url, imageUrl: null };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach((result) => {
        results.set(result.url, result.imageUrl);
      });
    }

    // Use AI generation exclusively for all items needing images
    if (failedItems.length > 0) {
      console.log(
        `Generating AI images for ${failedItems.length} articles without OG images`
      );

      // Generate AI images for ALL failed items
      const aiImages = await aiImageService.generateBulkFallbackImages(
        failedItems.map((item) => ({
          url: item.url,
          title: item.title,
          source: item.source,
          category: category || 'Technology',
          isBigStory: item.isBigStory,
          imagePrompt: item.imagePrompt,
        }))
      );

      // Update results with AI-generated images
      aiImages.forEach((image, url) => {
        if (image && image.imageUrl) {
          results.set(url, image.imageUrl);
          console.log(`AI generated photorealistic image for: ${url}`);
        }
      });
    }

    return results;
  }
}
