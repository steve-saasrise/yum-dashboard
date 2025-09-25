import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface UnsplashSearchOptions {
  url: string;
  title?: string;
  source?: string;
  category?: string;
  description?: string;
  isBigStory?: boolean;
  searchKeywords?: {
    primary: string[];
    fallback: string[];
    orientation?: 'landscape' | 'portrait' | 'squarish';
    color?: string;
  };
}

interface UnsplashImage {
  imageUrl: string;
  thumbnailUrl: string;
  photographerName: string;
  photographerUrl: string;
  unsplashUrl: string;
  cached: boolean;
}

interface UnsplashAPIPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  user: {
    name: string;
    links: {
      html: string;
    };
  };
  links: {
    html: string;
  };
  description?: string;
  alt_description?: string;
}

export class UnsplashImageService {
  private supabase: ReturnType<typeof createClient> | null = null;
  private accessKey: string | null = null;
  private static instance: UnsplashImageService | null = null;
  private readonly baseUrl = 'https://api.unsplash.com';

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    this.accessKey = process.env.UNSPLASH_ACCESS_KEY || null;

    if (!this.accessKey) {
      console.warn(
        'Unsplash Access Key not configured. Unsplash service will be unavailable.'
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey && !this.supabase) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  static getInstance(): UnsplashImageService {
    if (!UnsplashImageService.instance) {
      UnsplashImageService.instance = new UnsplashImageService();
    }
    return UnsplashImageService.instance;
  }

  /**
   * Search for an image on Unsplash using keywords
   */
  async searchImage(
    options: UnsplashSearchOptions
  ): Promise<UnsplashImage | null> {
    if (!this.accessKey) {
      console.error('Unsplash API key not configured');
      return null;
    }

    try {
      // Skip caching - always get fresh images for variety
      // This ensures digest emails get different images each time

      // Use provided keywords or generate basic ones from title
      let searchQuery: string;
      let orientation: string | undefined;

      if (options.searchKeywords) {
        // Try primary keywords first
        searchQuery = options.searchKeywords.primary.join(' ');
        orientation = options.searchKeywords.orientation;
      } else {
        // Fallback to basic keyword extraction from title
        searchQuery = this.extractBasicKeywords(
          options.title,
          options.category
        );
        orientation = options.isBigStory ? 'landscape' : 'squarish';
      }

      console.log(`Searching Unsplash for: ${searchQuery}`);

      // Search Unsplash
      let photo = await this.performSearch(searchQuery, orientation);

      // If no results with primary keywords, try fallback
      if (!photo && options.searchKeywords?.fallback) {
        console.log('No results with primary keywords, trying fallback...');
        searchQuery = options.searchKeywords.fallback.join(' ');
        photo = await this.performSearch(searchQuery, orientation);
      }

      // If still no results, try a very broad search based on category
      if (!photo) {
        console.log(
          'No results with specific keywords, trying category search...'
        );
        searchQuery = this.getCategoryFallback(options.category);
        photo = await this.performSearch(searchQuery, orientation);
      }

      if (!photo) {
        console.log('No suitable images found on Unsplash');
        return null;
      }

      // Prepare the image data
      const imageData: UnsplashImage = {
        imageUrl: photo.urls.regular, // 1080px wide
        thumbnailUrl: photo.urls.small, // 400px wide
        photographerName: photo.user.name,
        photographerUrl: photo.user.links.html,
        unsplashUrl: photo.links.html,
        cached: false,
      };

      // Skip caching to ensure fresh images each time
      // await this.cacheImage(urlHash, options.url, imageData, searchQuery);

      // Track download for Unsplash API guidelines
      await this.trackDownload(photo.links.html);

      return imageData;
    } catch (error) {
      console.error('Error searching Unsplash:', error);
      return null;
    }
  }

  /**
   * Perform actual Unsplash API search
   */
  private async performSearch(
    query: string,
    orientation?: string
  ): Promise<UnsplashAPIPhoto | null> {
    try {
      const params = new URLSearchParams({
        query,
        per_page: '30', // Get more results for variety
        client_id: this.accessKey!,
      });

      if (orientation) {
        params.append('orientation', orientation);
      }

      const response = await fetch(
        `${this.baseUrl}/search/photos?${params.toString()}`,
        {
          headers: {
            'Accept-Version': 'v1',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403) {
          console.error('Unsplash API rate limit exceeded');
        } else {
          console.error(`Unsplash API error: ${response.status}`);
        }
        return null;
      }

      const data = await response.json();

      if (!data.results || data.results.length === 0) {
        return null;
      }

      // Get previously used image IDs to avoid repetition
      const usedIds = await this.getRecentlyUsedIds();

      // Filter out recently used images
      const availablePhotos = data.results.filter(
        (photo: UnsplashAPIPhoto) => !usedIds.includes(photo.id)
      );

      // If all photos have been used, just use the original results
      const photosToChooseFrom =
        availablePhotos.length > 0 ? availablePhotos : data.results;

      // Randomly select from top results for variety
      const maxIndex = Math.min(10, photosToChooseFrom.length);
      const randomIndex = Math.floor(Math.random() * maxIndex);

      return photosToChooseFrom[randomIndex];
    } catch (error) {
      console.error('Error calling Unsplash API:', error);
      return null;
    }
  }

  /**
   * Track photo download per Unsplash guidelines
   */
  private async trackDownload(downloadUrl: string): Promise<void> {
    try {
      // Unsplash requires tracking downloads for their statistics
      // This doesn't actually download the image, just increments the counter
      const downloadTrackUrl = `${downloadUrl}/download?client_id=${this.accessKey}`;
      await fetch(downloadTrackUrl);
    } catch (error) {
      // Non-critical error, just log it
      console.error('Error tracking Unsplash download:', error);
    }
  }

  /**
   * Extract basic keywords from title and category
   */
  private extractBasicKeywords(title?: string, category?: string): string {
    if (!title && !category) {
      return 'modern office technology';
    }

    const keywords: string[] = [];

    // Extract key terms from title
    if (title) {
      // Remove person names and focus on concepts
      const cleanedTitle = title
        .replace(/\b(CEO|founder|president|executive|manager)\b/gi, '')
        .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '') // Remove likely person names
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '');

      const importantWords = cleanedTitle
        .split(' ')
        .filter(
          (word) =>
            word.length > 4 &&
            ![
              'with',
              'from',
              'about',
              'their',
              'these',
              'those',
              'after',
              'before',
              'person',
              'people',
            ].includes(word)
        )
        .slice(0, 3);

      keywords.push(...importantWords);
    }

    // Add category-based keyword
    if (category) {
      const cleanCategory = category
        .replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '')
        .trim()
        .toLowerCase();

      if (!keywords.includes(cleanCategory)) {
        keywords.push(cleanCategory);
      }
    }

    // If we have no good keywords, use safe defaults based on category
    if (keywords.length === 0) {
      return this.getCategoryFallback(category);
    }

    return keywords.join(' ');
  }

  /**
   * Get broad category fallback search term
   */
  private getCategoryFallback(category?: string): string {
    if (!category) return 'abstract business';

    const categoryMap: Record<string, string> = {
      SaaS: 'software technology',
      AI: 'artificial intelligence',
      Security: 'cybersecurity',
      Startup: 'startup office',
      Finance: 'finance business',
      Developer: 'programming code',
      Product: 'product design',
      Marketing: 'digital marketing',
      Venture: 'venture capital',
      Crypto: 'cryptocurrency',
      Growth: 'business growth',
    };

    const cleanCategory = category
      .replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '')
      .trim();

    return categoryMap[cleanCategory] || 'modern office';
  }

  /**
   * Get cached image from database
   */
  private async getCachedImage(urlHash: string): Promise<any | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('unsplash_cached_images')
        .select('*')
        .eq('url_hash', urlHash)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if image is expired (older than 7 days for variety)
      const createdAt = new Date(data.created_at as string);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - 7);

      if (createdAt < expirationDate) {
        console.log(
          `Cached image expired for hash ${urlHash}, will search for new one`
        );
        // Delete the expired record
        await this.supabase
          .from('unsplash_cached_images')
          .delete()
          .eq('url_hash', urlHash);

        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching cached image:', error);
      return null;
    }
  }

  /**
   * Cache image data in database
   */
  private async cacheImage(
    urlHash: string,
    originalUrl: string,
    imageData: UnsplashImage,
    searchQuery: string
  ): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('unsplash_cached_images')
        .upsert(
          {
            url_hash: urlHash,
            original_url: originalUrl,
            image_url: imageData.imageUrl,
            thumbnail_url: imageData.thumbnailUrl,
            photographer_name: imageData.photographerName,
            photographer_url: imageData.photographerUrl,
            unsplash_url: imageData.unsplashUrl,
            search_query: searchQuery,
            created_at: new Date().toISOString(),
          },
          {
            onConflict: 'url_hash',
          }
        );

      if (error) {
        console.error('Error caching Unsplash image:', error);
      } else {
        console.log(`Cached Unsplash image for: ${originalUrl}`);
      }

      // Also track this as a used image
      await this.trackUsedImage(
        imageData.imageUrl.match(/photo-([^-]+)/)?.[1] || ''
      );
    } catch (error) {
      console.error('Error in cacheImage:', error);
    }
  }

  /**
   * Track used image IDs to avoid repetition
   */
  private async trackUsedImage(unsplashId: string): Promise<void> {
    if (!this.supabase || !unsplashId) {
      return;
    }

    try {
      await this.supabase.from('used_unsplash_images').upsert(
        {
          unsplash_id: unsplashId,
          used_at: new Date().toISOString(),
          usage_count: 1,
        },
        {
          onConflict: 'unsplash_id',
          ignoreDuplicates: false,
        }
      );
    } catch (error) {
      console.error('Error tracking used image:', error);
    }
  }

  /**
   * Get recently used image IDs
   */
  private async getRecentlyUsedIds(): Promise<string[]> {
    if (!this.supabase) {
      return [];
    }

    try {
      // Get images used in the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await this.supabase
        .from('used_unsplash_images')
        .select('unsplash_id')
        .gte('used_at', thirtyDaysAgo.toISOString())
        .limit(500);

      if (error || !data) {
        return [];
      }

      return data.map((item) => item.unsplash_id as string);
    } catch (error) {
      console.error('Error fetching recently used images:', error);
      return [];
    }
  }

  /**
   * Batch search images for multiple articles
   */
  async searchBulkImages(
    articles: UnsplashSearchOptions[]
  ): Promise<Map<string, UnsplashImage | null>> {
    const results = new Map<string, UnsplashImage | null>();

    // Process in small batches to respect rate limits
    const batchSize = 5;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const promises = batch.map(async (article) => {
        const image = await this.searchImage(article);
        return { url: article.url, image };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ url, image }) => {
        results.set(url, image);
      });

      // Add delay between batches to respect rate limits (50 per hour = ~1 per 72 seconds)
      // But we can burst a bit since it's averaged over the hour
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }
}
