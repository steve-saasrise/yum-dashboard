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
    items: Array<{ url: string; id?: string; title?: string; source?: string }>,
    category?: string
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    const aiImageService = AIImageService.getInstance();
    const failedItems: Array<{ url: string; title?: string; source?: string }> =
      [];

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
          });
          return { url: item.url, imageUrl: null };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach((result) => {
        results.set(result.url, result.imageUrl);
      });
    }

    // Generate AI images for failed items
    if (
      failedItems.length > 0 &&
      (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY)
    ) {
      console.log(
        `Generating AI fallback images for ${failedItems.length} articles`
      );

      const aiImages = await aiImageService.generateBulkFallbackImages(
        failedItems.map((item) => ({
          url: item.url,
          title: item.title,
          source: item.source,
          category: category || 'Technology',
        }))
      );

      // Update results with AI-generated images
      aiImages.forEach((image, url) => {
        if (image && image.imageUrl) {
          results.set(url, image.imageUrl);
        }
      });
    }

    return results;
  }

  /**
   * Get a fallback image based on the domain
   */
  static getFallbackImage(url: string): string | null {
    try {
      const domain = new URL(url).hostname.toLowerCase();

      // Common tech news sites and their logos
      const fallbacks: Record<string, string> = {
        'techcrunch.com':
          'https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png',
        'theverge.com':
          'https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395359/ios-icon.0.png',
        'wired.com':
          'https://www.wired.com/verso/static/wired/assets/favicon.ico',
        'arstechnica.com': 'https://cdn.arstechnica.net/favicon.ico',
        'venturebeat.com':
          'https://venturebeat.com/wp-content/themes/vb-news/img/favicon.ico',
        'forbes.com': 'https://i.forbesimg.com/48X48-F.png',
        'bloomberg.com':
          'https://assets.bbhub.io/company/sites/51/2019/08/favicon.png',
        'reuters.com':
          'https://www.reuters.com/pf/resources/images/reuters/favicon.ico',
        'wsj.com': 'https://s.wsj.net/img/meta/wsj-social-share.png',
        'ft.com':
          'https://www.ft.com/__origami/service/image/v2/images/raw/ftlogo-v1%3Abrand-ft-logo-square-coloured?source=update-logos',
        'businessinsider.com': 'https://i.insider.com/5e7c3c2ec0232254067e7b03',
        'zdnet.com':
          'https://www.zdnet.com/a/fly/bundles/zdnetcore/images/logos/zdnet-logo-192x192.png',
        'engadget.com':
          'https://s.yimg.com/os/engadget/media/engadget-favicon-192.png',
        'mashable.com': 'https://mashable.com/apple-touch-icon.png',
        'thenextweb.com':
          'https://next.tnwcdn.com/assets/img/favicon/favicon-192x192.png',
        'tnw.com':
          'https://next.tnwcdn.com/assets/img/favicon/favicon-192x192.png',
      };

      // Check if we have a fallback for this domain
      for (const [key, value] of Object.entries(fallbacks)) {
        if (domain.includes(key)) {
          return value;
        }
      }

      // Generic tech news placeholder
      return 'https://via.placeholder.com/120x80/e0e7ff/4338ca?text=News';
    } catch {
      return null;
    }
  }
}
