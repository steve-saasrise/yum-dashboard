import { GoogleGenAI } from '@google/genai';
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
  isBigStory?: boolean; // Flag to indicate if this is for the big story hero image
}

interface GeneratedImage {
  imageUrl: string;
  prompt: string;
  cached: boolean;
}

export class AIImageService {
  private genAI: GoogleGenAI | null = null;
  private supabase: ReturnType<typeof createClient> | null = null;
  private static instance: AIImageService | null = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (apiKey && !this.genAI) {
      this.genAI = new GoogleGenAI({ apiKey });
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
   * Generate a contextual image for an article using Google Gemini 2.5 Flash
   */
  async generateFallbackImage(
    options: GenerateImageOptions
  ): Promise<GeneratedImage | null> {
    if (!this.genAI) {
      console.error('Google API key not configured');
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

      // Call Gemini 2.5 Flash Image Preview model (aka "Nano Banana")
      const response = await this.genAI.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          temperature: 0.4,
          topK: 32,
          topP: 1,
        },
      });

      console.log(
        'Raw response structure:',
        JSON.stringify(response, null, 2).substring(0, 1000)
      );

      // Extract the base64 image from the response
      let base64Image: string | null = null;
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          console.log('Part type:', part);
          if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Image) {
        console.error('No image generated from Gemini 2.5 Flash');
        console.log('Full response:', JSON.stringify(response, null, 2));
        return null;
      }

      // Convert base64 to a data URL for temporary storage
      const generatedImageUrl = `data:image/png;base64,${base64Image}`;

      // Store the generated image URL in our cache and get permanent URL
      let permanentUrl = await this.cacheGeneratedImage(
        urlHash,
        options.url,
        generatedImageUrl,
        prompt
      );

      if (!permanentUrl) {
        console.error('Warning: First storage attempt failed, retrying...');
        // Retry with longer timeout
        await new Promise((resolve) => setTimeout(resolve, 3000));
        permanentUrl = await this.storePermanentImage(
          generatedImageUrl,
          urlHash
        );

        if (!permanentUrl) {
          console.error('Error: Storage failed after retry.');
          return null;
        }
      }

      return {
        imageUrl: permanentUrl,
        prompt,
        cached: false,
      };
    } catch (error: any) {
      // Handle specific error types
      if (error.status === 429) {
        console.error(
          'Gemini API quota exceeded. Please wait or upgrade your plan.'
        );
        console.error('Details:', error.message);
      } else {
        console.error('Error generating AI image:', error);
        console.error('Full error details:', JSON.stringify(error, null, 2));
      }
      return null;
    }
  }

  /**
   * Generate a smart prompt based on article metadata
   * Using descriptive sentences instead of keywords for better Gemini results
   */
  private generatePrompt(options: GenerateImageOptions): string {
    const { title, source, category, description } = options;

    // Build a descriptive prompt using natural language
    let prompt =
      'Please generate a professional and visually appealing editorial image ';

    // Add category context with descriptive sentences
    if (category) {
      // Clean up category name by removing "Coffee" and similar suffixes
      const cleanCategory = category
        .replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '')
        .trim();

      const categoryDescriptions: Record<string, string> = {
        SaaS: 'that represents cloud-based software services with modern technology elements and digital transformation themes',
        AI: 'that illustrates artificial intelligence concepts with neural networks, data patterns, or futuristic technology visualizations',
        Security:
          'that conveys cybersecurity and data protection through visual metaphors of shields, locks, or secure digital environments',
        Startup:
          'that captures the entrepreneurial spirit with imagery of innovation, growth, and dynamic business environments',
        Finance:
          'that depicts financial technology and markets through abstract representations of data, charts, or digital currency',
        Developer:
          'that represents software development and programming with clean code aesthetics or abstract technology patterns',
        Product:
          'that illustrates product management and design thinking through visual representations of user interfaces or product workflows',
        Marketing:
          'that shows digital marketing and growth strategies through creative visual metaphors of audience engagement and brand reach',
        Venture:
          'that captures venture capital and startup ecosystem with imagery of innovation, investment, and growth',
        Crypto:
          'that depicts cryptocurrency and blockchain technology through abstract representations of decentralized networks and digital assets',
        Growth:
          'that shows B2B growth strategies and marketing through visual metaphors of scaling, expansion, and business development',
      };

      // Check if this is a theme description (longer text about content)
      if (category.toLowerCase().includes('content about')) {
        // This is already a theme description, use it directly
        prompt += `for ${category}`;
      } else {
        // Try to match with predefined categories
        const categoryDescription = categoryDescriptions[cleanCategory];
        if (categoryDescription) {
          prompt += categoryDescription;
        } else {
          // Use the cleaned category name
          prompt += `related to ${cleanCategory} topics`;
        }
      }
    }

    // Add title context with natural language
    if (title) {
      const keywords = this.extractKeywords(title);
      if (keywords.length > 0) {
        prompt += `. The image should subtly reference themes related to ${keywords.join(' and ')}`;
      }
    }

    // Add source-based style guidance
    if (source) {
      const sourceStyles: Record<string, string> = {
        TechCrunch:
          'The visual style should be modern and tech-forward with bold colors and innovative design',
        Reuters:
          'The image should have a professional and journalistic quality with authoritative visual elements',
        'The Verge':
          'The aesthetic should be contemporary and digital with cutting-edge design sensibilities',
        Forbes:
          'The imagery should convey business professionalism and corporate sophistication',
        VentureBeat:
          'The visual should capture startup energy and innovation themes',
      };

      const styleDescription = sourceStyles[source];
      if (styleDescription) {
        prompt += `. ${styleDescription}`;
      }
    }

    // Add detailed requirements in natural language
    prompt +=
      '. The image must be abstract or conceptual without any text, words, or logos. ' +
      'It should use a professional color palette that works well in email newsletters. ' +
      'The overall design should be modern, clean, and minimalist while being visually engaging. ';

    // Add aspect ratio specification based on use case
    if (options.isBigStory) {
      // 16:9 landscape for big story hero images (better for email headers)
      prompt +=
        'The image should be in a 16:9 landscape aspect ratio, perfectly suited as a hero banner image for the main story in an email newsletter. ' +
        'The composition should be horizontally balanced with visual weight distributed across the wide frame.';
    } else {
      // Square for regular article thumbnails
      prompt +=
        'The image should be in a square 1:1 aspect ratio, suitable as a thumbnail for article listings. ' +
        'The composition should be centered and balanced within the square frame.';
    }

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

    const keywords: string[] = [];
    const titleLower = title.toLowerCase();

    // Use word boundary matching for tech terms
    for (const term of techTerms) {
      const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
      if (regex.test(title)) {
        keywords.push(term);
      }
    }

    // Extract significant capitalized words (company names, products)
    // But filter out common words and articles
    const properNouns = title.match(/\b[A-Z][a-z]+\b/g) || [];
    const filteredProperNouns = properNouns.filter(
      (word) =>
        ![
          'The',
          'New',
          'Latest',
          'Breaking',
          'Exclusive',
          'Update',
          'Report',
          'Critical',
        ].includes(word)
    );
    keywords.push(...filteredProperNouns.slice(0, 2)); // Limit to 2 company/product names

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
      console.error('Supabase client not initialized');
      return null;
    }

    try {
      // First, ensure the ai-images bucket exists
      const { data: buckets, error: listError } =
        await this.supabase.storage.listBuckets();

      if (listError) {
        console.error('Error listing buckets:', listError);
        return null;
      }

      const bucketExists = buckets?.some((b) => b.name === 'ai-images');

      if (!bucketExists) {
        console.log('Creating ai-images bucket...');
        const { error: createError } = await this.supabase.storage.createBucket(
          'ai-images',
          {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
          }
        );
        if (createError) {
          console.error('Error creating ai-images bucket:', createError);
          // If bucket creation fails, it might already exist
          if (!createError.message?.includes('already exists')) {
            return null;
          }
        } else {
          console.log('ai-images bucket created successfully');
        }
      }

      // Handle base64 data URL or regular URL
      let imageBuffer: Buffer;
      if (temporaryUrl.startsWith('data:image')) {
        // Extract base64 data from data URL
        const base64Data = temporaryUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Download from regular URL
        const response = await fetch(temporaryUrl);
        if (!response.ok) {
          console.error('Failed to download image from temporary URL');
          return null;
        }
        imageBuffer = await response.buffer();
      }

      // Gemini outputs are already optimized, but ensure consistent format and size
      // Reduce to 800px width for email use, convert to JPEG for consistency
      const compressedBuffer = await sharp(imageBuffer)
        .resize(800, null, {
          withoutEnlargement: true,
          fit: 'inside',
        })
        .jpeg({
          quality: 90, // Higher quality since Gemini outputs are pre-optimized
          progressive: true,
        })
        .toBuffer();

      const fileName = `${urlHash}.jpg`;

      console.log(
        `Compressed image from ${imageBuffer.length} to ${compressedBuffer.length} bytes (${Math.round((1 - compressedBuffer.length / imageBuffer.length) * 100)}% reduction)`
      );

      // Upload to Supabase Storage with retry logic
      let uploadError = null;
      let uploadAttempts = 0;
      const maxAttempts = 3;

      while (uploadAttempts < maxAttempts) {
        uploadAttempts++;
        const { data, error } = await this.supabase.storage
          .from('ai-images')
          .upload(fileName, compressedBuffer, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!error) {
          console.log(
            `Image uploaded successfully on attempt ${uploadAttempts}:`,
            fileName
          );
          uploadError = null;
          break;
        }

        uploadError = error;
        console.error(`Upload attempt ${uploadAttempts} failed:`, error);

        if (uploadAttempts < maxAttempts) {
          // Wait before retry with exponential backoff
          const waitTime = Math.pow(2, uploadAttempts) * 1000;
          console.log(`Retrying upload in ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      if (uploadError) {
        console.error('Failed to upload after all retries:', uploadError);
        console.error('Error details:', JSON.stringify(uploadError, null, 2));
        // Don't throw - return null so fallback can be used
        return null;
      }

      // Get the public URL for the stored image
      const {
        data: { publicUrl },
      } = this.supabase.storage.from('ai-images').getPublicUrl(fileName);

      console.log('Public URL generated:', publicUrl);

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
  ): Promise<string | null> {
    if (!this.supabase) {
      return null;
    }

    try {
      // First, store the image permanently
      const permanentUrl = await this.storePermanentImage(imageUrl, urlHash);

      if (!permanentUrl) {
        console.error(
          'Failed to store image permanently - cannot cache without proper URL'
        );
        // Return null to indicate failure - we don't want to cache base64 URLs
        return null;
      }

      const { error } = await this.supabase.from('generated_images').insert({
        url_hash: urlHash,
        original_url: originalUrl,
        generated_image_url: permanentUrl, // Only store permanent URL
        prompt_used: prompt,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error caching generated image:', error);
        return null;
      } else {
        console.log(`Cached AI-generated image for: ${originalUrl}`);
        return permanentUrl;
      }
    } catch (error) {
      console.error('Error in cacheGeneratedImage:', error);
      return null;
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

      // Add delay between batches to respect rate limits (10 RPM for free tier)
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 7000)); // 7 seconds ensures < 10 RPM
      }
    }

    return results;
  }
}
