import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import sharp from 'sharp';
import { AIPromptGenerator } from './ai-prompt-generator';

interface GenerateImageOptions {
  url: string;
  title?: string;
  source?: string;
  category?: string;
  description?: string;
  isBigStory?: boolean; // Flag to indicate if this is for the big story hero image
  imagePrompt?: {
    // Pre-generated prompt from GPT
    concept: string;
    style: string;
    mood: string;
    colors: string;
    elements: string[];
    composition: string;
    avoid: string[];
  };
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
  private promptGenerator: AIPromptGenerator;

  constructor() {
    this.initializeServices();
    this.promptGenerator = new AIPromptGenerator();
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

      // CACHING DISABLED - Always generate fresh images
      // const cachedImage = await this.getCachedImage(urlHash);
      // if (cachedImage) {
      //   console.log(`Using cached AI image for: ${options.url}`);
      //   return {
      //     imageUrl: cachedImage.generated_image_url,
      //     prompt: cachedImage.prompt_used,
      //     cached: true,
      //   };
      // }

      // First, try to generate a smart prompt using GPT-4o-mini if we have title
      let prompt: string;

      if (options.title && this.promptGenerator) {
        console.log(
          `Generating smart prompt with GPT-4o-mini for: ${options.title}`
        );
        const generatedPrompt = await this.promptGenerator.generateImagePrompt({
          title: options.title,
          description: options.description,
          source: options.source,
          category: options.category,
          isBigStory: options.isBigStory,
        });

        if (generatedPrompt) {
          prompt = generatedPrompt.prompt;
          console.log(`AI-generated prompt: ${prompt}`);
        } else {
          // Fallback to template-based prompt
          console.log(
            'GPT-4o-mini prompt generation failed, falling back to template'
          );
          prompt = this.generatePrompt(options);
        }
      } else {
        // Use template-based prompt if no title or prompt generator unavailable
        prompt = this.generatePrompt(options);
      }

      console.log(`Generating AI image for: ${options.url}`);
      console.log(`Final prompt: ${prompt}`);

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

      // Store the image permanently but don't cache for reuse
      // Generate a unique filename using timestamp and random string to avoid conflicts
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      let permanentUrl = await this.storePermanentImage(
        generatedImageUrl,
        uniqueId
      );

      if (!permanentUrl) {
        console.error('Warning: First storage attempt failed, retrying...');
        // Retry with longer timeout
        await new Promise((resolve) => setTimeout(resolve, 3000));
        permanentUrl = await this.storePermanentImage(
          generatedImageUrl,
          uniqueId
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
   * Generate a simple, effective prompt for article images
   */
  private generatePrompt(options: GenerateImageOptions): string {
    const { title, description, isBigStory } = options;

    // Extract key concept from the article
    const text = `${title || ''} ${description || ''}`.toLowerCase();

    // Try to identify specific technologies or products mentioned
    let visualElement = '';

    // Check for specific technology mentions
    if (text.includes('ai') || text.includes('artificial intelligence')) {
      visualElement = 'neural network visualization on computer screen';
    } else if (text.includes('cloud')) {
      visualElement = 'modern data center with server racks';
    } else if (text.includes('app') || text.includes('application')) {
      visualElement = 'mobile app interface on smartphone';
    } else if (text.includes('api')) {
      visualElement = 'API documentation and code on developer screen';
    } else if (text.includes('database') || text.includes('data')) {
      visualElement = 'database schema and analytics dashboard';
    } else if (text.includes('security') || text.includes('cyber')) {
      visualElement = 'cybersecurity monitoring dashboard';
    } else if (text.includes('code') || text.includes('programming')) {
      visualElement = 'developer writing code on multiple monitors';
    } else if (text.includes('startup')) {
      visualElement = 'startup workspace with whiteboards and laptops';
    } else if (text.includes('investment') || text.includes('funding')) {
      visualElement = 'financial charts and investment documents';
    } else if (text.includes('automation')) {
      visualElement = 'automated workflow diagram on screen';
    } else if (text.includes('blockchain') || text.includes('crypto')) {
      visualElement = 'blockchain network visualization';
    } else if (text.includes('machine learning') || text.includes('ml')) {
      visualElement = 'machine learning model training graphs';
    } else if (text.includes('devops')) {
      visualElement = 'CI/CD pipeline dashboard';
    } else if (text.includes('saas')) {
      visualElement = 'SaaS dashboard with metrics and charts';
    } else {
      // Last resort - extract the first noun from the title
      const titleWords = (title || '').split(' ');
      const techWord = titleWords.find(
        (word) =>
          word.length > 4 &&
          !['with', 'from', 'into', 'over', 'under'].includes(
            word.toLowerCase()
          )
      );
      visualElement = techWord
        ? `${techWord.toLowerCase()} technology interface`
        : 'modern technology workspace';
    }

    const composition = isBigStory
      ? 'wide angle, cinematic'
      : 'centered, balanced';

    // Create contextual photorealistic prompt
    const prompt = `Photorealistic image of ${visualElement}, ${composition} composition, natural lighting, professional photography style, high quality, detailed, no text or logos`;

    return prompt;
  }

  /**
   * Simplified fallback if needed
   */
  private generateSimplePrompt(): string {
    const concepts = [
      'innovation',
      'growth',
      'technology',
      'collaboration',
      'progress',
    ];
    const randomConcept = concepts[Math.floor(Math.random() * concepts.length)];
    return `Professional photograph representing ${randomConcept}, modern aesthetic, clean composition, photorealistic`;
  }

  /**
   * Simplify overly technical concepts for better visual representation
   */
  private simplifyTechConcept(concept: string): string {
    // Map complex tech terms to simpler visual metaphors
    const simplifications: { [key: string]: string } = {
      'artificial intelligence': 'intelligent systems and learning',
      'machine learning': 'pattern recognition and adaptation',
      blockchain: 'connected network of trust',
      cryptocurrency: 'digital value exchange',
      'neural network': 'interconnected pathways',
      'cloud computing': 'distributed resources',
      'API integration': 'seamless connections',
      'data pipeline': 'flowing information streams',
      cybersecurity: 'protection and safety',
      automation: 'efficient workflows',
      scalability: 'growth and expansion',
      infrastructure: 'foundation and support',
      algorithm: 'logical patterns',
      encryption: 'secure communication',
      'quantum computing': 'advanced computation',
      IoT: 'connected devices',
      'SaaS platform': 'software services',
      'venture capital': 'investment and growth',
      'startup funding': 'business support',
      IPO: 'public market debut',
      acquisition: 'business combination',
      merger: 'joining forces',
    };

    let simplified = concept.toLowerCase();

    // Replace technical jargon with simpler concepts
    for (const [tech, simple] of Object.entries(simplifications)) {
      simplified = simplified.replace(new RegExp(tech, 'gi'), simple);
    }

    // Remove overly technical modifiers
    const techModifiers = [
      'cutting-edge',
      'next-generation',
      'revolutionary',
      'disruptive',
      'state-of-the-art',
      'enterprise-grade',
      'high-performance',
      'real-time',
      'cloud-native',
      'AI-powered',
      'blockchain-based',
      'quantum-enabled',
    ];

    for (const modifier of techModifiers) {
      simplified = simplified.replace(new RegExp(modifier, 'gi'), '');
    }

    // Clean up extra spaces and return
    return simplified.replace(/\s+/g, ' ').trim() || 'business innovation';
  }

  /**
   * Get style guidance based on content source
   */
  private getSourceStyle(source?: string): string {
    if (!source) return 'modern and professional';

    const sourceStyles: Record<string, string> = {
      TechCrunch: 'modern tech-forward with bold colors and innovative design',
      Reuters: 'professional journalistic with authoritative visual elements',
      'The Verge':
        'contemporary digital with cutting-edge design sensibilities',
      Forbes: 'business professional with corporate sophistication',
      VentureBeat: 'startup energy with innovation themes',
      'Wall Street Journal': 'financial professional with clean aesthetics',
      Bloomberg: 'data-driven with financial market themes',
      Wired: 'futuristic technology with bold visual style',
      'Hacker News': 'developer-focused with technical aesthetics',
      'Product Hunt': 'product-centric with modern UI patterns',
    };

    return sourceStyles[source] || 'modern and professional';
  }

  /**
   * Extract simple, non-technical keywords from title
   */
  private extractSimpleKeywords(title: string): string[] {
    // Focus on business concepts rather than technical details
    const businessTerms = [
      'growth',
      'success',
      'innovation',
      'partnership',
      'expansion',
      'leadership',
      'transformation',
      'collaboration',
      'strategy',
      'opportunity',
      'achievement',
      'milestone',
      'breakthrough',
      'launch',
      'investment',
    ];

    const keywords: string[] = [];
    const titleLower = title.toLowerCase();

    // Look for business-oriented terms
    for (const term of businessTerms) {
      if (titleLower.includes(term)) {
        keywords.push(term);
      }
    }

    // Avoid technical jargon - return only simple business concepts
    return keywords.slice(0, 3); // Maximum 3 keywords for simplicity
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
    // But filter out common words, articles, and platform-specific terms
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
          'Tweet',
          'Thread',
          'Post',
          'Story',
          'Share',
          'Retweet',
          'Reply',
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

    // First, generate all prompts in bulk using GPT-4o-mini (if titles are available)
    const articlesWithTitles = articles.filter((a) => a.title);
    const promptMap = new Map<string, string>();

    if (articlesWithTitles.length > 0 && this.promptGenerator) {
      console.log(
        `Generating ${articlesWithTitles.length} prompts with GPT-4o-mini...`
      );
      const generatedPrompts =
        await this.promptGenerator.generateBulkImagePrompts(
          articlesWithTitles.map((a) => ({
            title: a.title!,
            description: a.description,
            source: a.source,
            category: a.category,
            isBigStory: a.isBigStory,
          }))
        );

      // Store the generated prompts
      generatedPrompts.forEach((prompt, title) => {
        promptMap.set(title, prompt.prompt);
      });
    }

    // Process in small batches to avoid rate limiting
    const batchSize = 3;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const promises = batch.map(async (article) => {
        // If we have a pre-generated prompt, add it to the options
        if (article.title && promptMap.has(article.title)) {
          const aiPrompt = promptMap.get(article.title)!;
          // Create a temporary imagePrompt structure to use the AI-generated prompt
          article.imagePrompt = {
            concept: aiPrompt,
            style: 'professional',
            mood: 'optimistic',
            colors: 'harmonious',
            elements: [],
            composition: 'balanced',
            avoid: ['text', 'letters', 'numbers'],
          };
        }

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
