import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';

interface GenerateImageOptions {
  url: string;
  title?: string;
  source?: string;
  category?: string;
  description?: string;
}

interface GeneratedImage {
  imageUrl: string;
  prompt: string;
  cached: boolean;
}

export class AIImageService {
  private openai: OpenAI | null = null;
  private supabase: ReturnType<typeof createClient> | null = null;
  private static instance: AIImageService | null = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && !this.openai) {
      this.openai = new OpenAI({ apiKey });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey && !this.supabase) {
      this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  static getInstance(): AIImageService {
    if (!AIImageService.instance) {
      AIImageService.instance = new AIImageService();
    }
    return AIImageService.instance;
  }

  /**
   * Generate a contextual image for an article using DALL-E 3
   */
  async generateFallbackImage(
    options: GenerateImageOptions
  ): Promise<GeneratedImage | null> {
    if (!this.openai) {
      console.error('OpenAI API key not configured');
      return null;
    }

    try {
      // Create a hash of the URL for caching
      const urlHash = crypto
        .createHash('sha256')
        .update(options.url)
        .digest('hex');

      // Check if we already have a generated image for this URL
      const cachedImage = await this.getCachedImage(urlHash);
      if (cachedImage) {
        console.log(`Using cached AI image for: ${options.url}`);
        return {
          imageUrl: cachedImage.generated_image_url,
          prompt: cachedImage.prompt_used,
          cached: true,
        };
      }

      // Generate a contextual prompt based on the article metadata
      const prompt = this.generatePrompt(options);

      console.log(`Generating AI image for: ${options.url}`);
      console.log(`Prompt: ${prompt}`);

      // Call DALL-E 3 to generate the image
      const response = await this.openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard', // Use 'standard' for cost efficiency
        style: 'natural', // Natural style for news articles
      });

      const generatedImageUrl = response.data?.[0]?.url;
      if (!generatedImageUrl) {
        console.error('No image URL returned from DALL-E 3');
        return null;
      }

      // Store the generated image URL in our cache
      await this.cacheGeneratedImage(
        urlHash,
        options.url,
        generatedImageUrl,
        prompt
      );

      return {
        imageUrl: generatedImageUrl,
        prompt,
        cached: false,
      };
    } catch (error) {
      console.error('Error generating AI image:', error);
      return null;
    }
  }

  /**
   * Generate a smart prompt based on article metadata
   */
  private generatePrompt(options: GenerateImageOptions): string {
    const { title, source, category, description } = options;

    // Build a contextual prompt
    let prompt =
      'Create a professional, editorial-style image for a news article';

    // Add category context if available
    if (category) {
      const categoryPrompts: Record<string, string> = {
        SaaS: 'about SaaS software and cloud technology',
        AI: 'about artificial intelligence and machine learning',
        Security: 'about cybersecurity and data protection',
        Startup: 'about startups and entrepreneurship',
        Finance: 'about financial technology and markets',
        Developer: 'about software development and programming',
        Product: 'about product management and design',
        Marketing: 'about digital marketing and growth',
      };

      const categoryContext = categoryPrompts[category] || `about ${category}`;
      prompt += ` ${categoryContext}`;
    }

    // Add title context if available
    if (title) {
      // Extract key themes from the title
      const keywords = this.extractKeywords(title);
      if (keywords.length > 0) {
        prompt += `. The article discusses ${keywords.join(', ')}`;
      }
    }

    // Add source context for style
    if (source) {
      const sourceStyles: Record<string, string> = {
        TechCrunch: 'Use modern, tech-forward visuals',
        Reuters: 'Use professional, journalistic style',
        'The Verge': 'Use contemporary, digital aesthetic',
        Forbes: 'Use business-professional imagery',
        VentureBeat: 'Use startup and innovation themes',
      };

      const styleHint = sourceStyles[source];
      if (styleHint) {
        prompt += `. ${styleHint}`;
      }
    }

    // Add universal requirements
    prompt +=
      '. Use abstract or conceptual imagery, no text or logos, professional color palette, suitable for email newsletter header. Modern, clean, minimalist style.';

    return prompt;
  }

  /**
   * Extract keywords from title for better prompt generation
   */
  private extractKeywords(title: string): string[] {
    const techTerms = [
      'AI',
      'API',
      'cloud',
      'data',
      'security',
      'automation',
      'platform',
      'integration',
      'analytics',
      'infrastructure',
      'blockchain',
      'crypto',
      'machine learning',
      'neural',
      'quantum',
      'robotics',
      'IoT',
      '5G',
      'AR',
      'VR',
      'funding',
      'acquisition',
      'IPO',
      'valuation',
      'growth',
    ];

    const words = title.toLowerCase().split(/\s+/);
    const keywords: string[] = [];

    for (const term of techTerms) {
      if (title.toLowerCase().includes(term.toLowerCase())) {
        keywords.push(term);
      }
    }

    // Also extract company names (capitalized words)
    const properNouns =
      title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    keywords.push(...properNouns.slice(0, 2)); // Limit to 2 company names

    return keywords.slice(0, 5); // Return top 5 keywords
  }

  /**
   * Get cached image from database (with 30-day expiration check)
   */
  private async getCachedImage(urlHash: string): Promise<any | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      const { data, error } = await this.supabase
        .from('generated_images')
        .select('*')
        .eq('url_hash', urlHash)
        .single();

      if (error || !data) {
        return null;
      }

      // Check if image is expired (older than 30 days)
      const createdAt = new Date(data.created_at as string);
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - 30);

      if (createdAt < expirationDate) {
        console.log(`Image expired for hash ${urlHash}, will regenerate`);
        // Delete the expired record
        await this.supabase
          .from('generated_images')
          .delete()
          .eq('url_hash', urlHash);

        // Delete from storage if it exists
        const imageUrl = data.generated_image_url as string;
        const fileName = imageUrl.includes('.jpg')
          ? `${urlHash}.jpg`
          : `${urlHash}.png`;
        await this.supabase.storage.from('ai-images').remove([fileName]);

        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching cached image:', error);
      return null;
    }
  }

  /**
   * Clean up expired images (run via cron job)
   * Removes images older than 30 days to save storage space
   */
  async cleanupExpiredImages(): Promise<{
    deleted: number;
    freedBytes: number;
  }> {
    if (!this.supabase) {
      return { deleted: 0, freedBytes: 0 };
    }

    try {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() - 30);

      // Find expired images
      const { data: expiredImages, error: fetchError } = await this.supabase
        .from('generated_images')
        .select('url_hash, generated_image_url')
        .lt('created_at', expirationDate.toISOString());

      if (fetchError || !expiredImages || expiredImages.length === 0) {
        console.log('No expired images to clean up');
        return { deleted: 0, freedBytes: 0 };
      }

      console.log(`Found ${expiredImages.length} expired images to clean up`);

      let deletedCount = 0;
      let totalFreedBytes = 0;

      // Delete from storage and database
      for (const image of expiredImages) {
        try {
          // Extract filename from URL
          const imageUrl = image.generated_image_url as string;
          const fileName = imageUrl.includes('.jpg')
            ? `${image.url_hash}.jpg`
            : `${image.url_hash}.png`;

          // Get file size before deletion (optional)
          const { data: fileData } = await this.supabase.storage
            .from('ai-images')
            .list('', {
              limit: 1,
              search: fileName,
            });

          const fileSize = fileData?.[0]?.metadata?.size || 0;

          // Delete from storage
          const { error: storageError } = await this.supabase.storage
            .from('ai-images')
            .remove([fileName]);

          if (!storageError) {
            totalFreedBytes += fileSize;
            deletedCount++;
          }
        } catch (err) {
          console.error(`Error deleting file for hash ${image.url_hash}:`, err);
        }
      }

      // Batch delete from database
      const { error: deleteError } = await this.supabase
        .from('generated_images')
        .delete()
        .lt('created_at', expirationDate.toISOString());

      if (deleteError) {
        console.error(
          'Error deleting expired images from database:',
          deleteError
        );
      }

      console.log(
        `Cleanup complete: deleted ${deletedCount} images, freed ${(totalFreedBytes / 1024 / 1024).toFixed(2)} MB`
      );

      return {
        deleted: deletedCount,
        freedBytes: totalFreedBytes,
      };
    } catch (error) {
      console.error('Error during cleanup:', error);
      return { deleted: 0, freedBytes: 0 };
    }
  }

  /**
   * Download and store image permanently in Supabase Storage with compression
   */
  private async storePermanentImage(
    temporaryUrl: string,
    urlHash: string
  ): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      // First, ensure the ai-images bucket exists
      const { data: buckets } = await this.supabase.storage.listBuckets();
      const bucketExists = buckets?.some((b) => b.name === 'ai-images');

      if (!bucketExists) {
        const { error: createError } = await this.supabase.storage.createBucket(
          'ai-images',
          {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          }
        );
        if (createError) {
          console.error('Error creating ai-images bucket:', createError);
          return null;
        }
      }

      // Download the image from the temporary URL
      const response = await fetch(temporaryUrl);
      if (!response.ok) {
        console.error('Failed to download image from temporary URL');
        return null;
      }

      const imageBuffer = await response.buffer();

      // Compress the image using sharp
      // Reduce to 800px width for email use, convert to JPEG for smaller size
      const compressedBuffer = await sharp(imageBuffer)
        .resize(800, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .jpeg({
          quality: 85, // Good quality/size balance
          progressive: true,
        })
        .toBuffer();

      const fileName = `${urlHash}.jpg`;

      console.log(
        `Compressed image from ${imageBuffer.length} to ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / imageBuffer.length) * 100)}% reduction)`
      );

      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from('ai-images')
        .upload(fileName, compressedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        console.error('Error uploading image to storage:', error);
        return null;
      }

      // Get the public URL for the stored image
      const {
        data: { publicUrl },
      } = this.supabase.storage.from('ai-images').getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error storing permanent image:', error);
      return null;
    }
  }

  /**
   * Cache generated image in database
   */
  private async cacheGeneratedImage(
    urlHash: string,
    originalUrl: string,
    imageUrl: string,
    prompt: string
  ): Promise<void> {
    if (!this.supabase) {
      return;
    }

    try {
      // First, store the image permanently
      const permanentUrl = await this.storePermanentImage(imageUrl, urlHash);

      if (!permanentUrl) {
        console.error('Failed to store image permanently, using temporary URL');
      }

      const { error } = await this.supabase.from('generated_images').insert({
        url_hash: urlHash,
        original_url: originalUrl,
        generated_image_url: permanentUrl || imageUrl, // Use permanent URL if available
        prompt_used: prompt,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error caching generated image:', error);
      } else {
        console.log(`Cached AI-generated image for: ${originalUrl}`);
      }
    } catch (error) {
      console.error('Error in cacheGeneratedImage:', error);
    }
  }

  /**
   * Batch generate images for multiple articles
   */
  async generateBulkFallbackImages(
    articles: GenerateImageOptions[]
  ): Promise<Map<string, GeneratedImage | null>> {
    const results = new Map<string, GeneratedImage | null>();

    // Process in small batches to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const promises = batch.map(async (article) => {
        const image = await this.generateFallbackImage(article);
        return { url: article.url, image };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ url, image }) => {
        results.set(url, image);
      });

      // Add delay between batches to respect rate limits
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
