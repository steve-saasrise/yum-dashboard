// OpenGraph service for fetching metadata from URLs
import { fetchOpenGraphMetadata } from './opengraph-fetcher';
import { AIImageService } from './ai-image-service';
import { UnsplashImageService } from './unsplash-image-service';
import { AIPromptGenerator } from './ai-prompt-generator';

interface OpenGraphData {
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  url: string;
  aiGenerated?: boolean;
}

export class OpenGraphService {
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

    // Try Unsplash first, then fall back to AI if needed
    if (failedItems.length > 0) {
      console.log(
        `Finding images for ${failedItems.length} articles without OG images`
      );

      const unsplashService = UnsplashImageService.getInstance();
      const promptGenerator = new AIPromptGenerator();
      const stillNeedImages: typeof failedItems = [];

      // Try Unsplash for each failed item
      for (const item of failedItems) {
        try {
          // Generate smart search keywords
          const keywords = await promptGenerator.generateUnsplashKeywords({
            title: item.title || '',
            description: item.source,
            category: category,
            isBigStory: item.isBigStory,
          });

          if (keywords) {
            const unsplashImage = await unsplashService.searchImage({
              url: item.url,
              title: item.title,
              source: item.source,
              category: category,
              isBigStory: item.isBigStory,
              searchKeywords: keywords,
            });

            if (unsplashImage) {
              results.set(item.url, unsplashImage.imageUrl);
              console.log(
                `Found Unsplash image for: ${item.title || item.url}`
              );
            } else {
              stillNeedImages.push(item);
            }
          } else {
            stillNeedImages.push(item);
          }
        } catch (error) {
          console.error(`Unsplash error for ${item.url}:`, error);
          stillNeedImages.push(item);
        }
      }

      // Fall back to AI for any remaining items
      if (
        stillNeedImages.length > 0 &&
        (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
      ) {
        console.log(
          `Using AI fallback for ${stillNeedImages.length} remaining articles`
        );

        const aiImages = await aiImageService.generateBulkFallbackImages(
          stillNeedImages.map((item) => ({
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
          }
        });
      }
    }

    return results;
  }
}
