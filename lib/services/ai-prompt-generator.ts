import OpenAI from 'openai';

interface ImagePromptOptions {
  title: string;
  description?: string;
  source?: string;
  category?: string;
  isBigStory?: boolean;
}

interface GeneratedPrompt {
  prompt: string;
  concept: string;
  style: string;
}

interface UnsplashKeywords {
  primary: string[];
  fallback: string[];
  orientation: 'landscape' | 'portrait' | 'squarish';
  color?: string;
}

export class AIPromptGenerator {
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generate Unsplash search keywords using GPT-4o-mini
   */
  async generateUnsplashKeywords(
    options: ImagePromptOptions
  ): Promise<UnsplashKeywords | null> {
    if (!this.openai) {
      console.error('OpenAI API key not configured for keyword generation');
      return null;
    }

    try {
      const { title, description, source, category, isBigStory } = options;
      const orientation = isBigStory ? 'landscape' : 'squarish';

      const systemPrompt = `You are an expert at finding relevant TECHNOLOGY stock photos on Unsplash. Generate search keywords that will find professional, high-quality images.

CRITICAL RULES:
1. NEVER use person names, CEO names, or specific individual identities as keywords
2. AVOID generic terms like "person", "people", "man", "woman", "portrait"
3. Focus on CONCEPTS, OBJECTS, and ENVIRONMENTS rather than people
4. For company/product news, use the product/technology/industry, NOT the people
5. Generate 2-3 specific keywords that match the article's TOPIC, not individuals
6. Keywords should represent the business/technology/concept being discussed
7. UNDERSTAND TECH CONTEXT - "wallpaper" in tech means desktop background, not wall decoration

CONTEXT AWARENESS:
- "Wallpaper" in Windows/OS context → use "desktop computer", "monitor display", "windows interface"
- "Apple" in tech context → use "iphone", "macbook", "apple devices" (not fruit)
- "Python" in programming → use "programming code", "software development" (not snake)
- "Java" in tech → use "programming", "code" (not coffee)
- "Cloud" in tech → use "cloud computing", "data center", "servers" (not weather)
- "Bug" in software → use "software debugging", "code error" (not insect)

Examples of GOOD keywords:
- For "Windows 11 adds video wallpapers" → ["windows laptop", "desktop computer", "monitor display"]
- For "Elon Musk announces new Tesla feature" → ["electric vehicle", "tesla car", "autonomous driving"]
- For "CEO reveals AI strategy" → ["artificial intelligence", "neural network", "data center"]
- For "Founder raises $10M" → ["startup office", "venture capital", "funding round"]

Examples of BAD keywords (never use these):
- Person names: "elon musk", "jeff bezos", "sam altman"
- Generic people: "person", "businessman", "entrepreneur", "portrait"
- Job titles alone: "CEO", "founder", "developer"
- Literal interpretations: "wallpaper" (wall decoration), "apple" (fruit), "python" (snake)

Return a JSON object with:
- primary: Array of 2-3 specific CONCEPT/OBJECT keywords (NO people/names)
- fallback: Array of 2-3 general industry/technology terms
- orientation: "${orientation}" (do not change)
- color: Optional color preference if relevant ("blue", "green", "teal", "purple", "orange", "red", "yellow", "black_and_white", "black", "white", "magenta")`;

      const userPrompt = `Find Unsplash search keywords for this article:
Title: ${title}
${description ? `Description: ${description}` : ''}
${source ? `Source: ${source}` : ''}
${category ? `Category: ${category}` : ''}

Generate keywords that will find relevant, professional stock photos.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 150,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.primary || !Array.isArray(result.primary)) {
        console.error('GPT-4o-mini did not return valid keywords');
        return null;
      }

      console.log('Generated Unsplash keywords:', result);

      return {
        primary: result.primary,
        fallback: result.fallback || ['business', 'technology'],
        orientation: orientation,
        color: result.color,
      };
    } catch (error) {
      console.error('Error generating Unsplash keywords:', error);
      return null;
    }
  }

  /**
   * Generate bulk Unsplash keywords for multiple articles
   */
  async generateBulkUnsplashKeywords(
    articles: ImagePromptOptions[]
  ): Promise<Map<string, UnsplashKeywords>> {
    const results = new Map<string, UnsplashKeywords>();

    // Process in batches to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const promises = batch.map(async (article) => {
        const keywords = await this.generateUnsplashKeywords(article);
        return { title: article.title, keywords };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ title, keywords }) => {
        if (keywords) {
          results.set(title, keywords);
        }
      });

      // Small delay between batches
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Generate an image prompt using GPT-4o-mini
   */
  async generateImagePrompt(
    options: ImagePromptOptions
  ): Promise<GeneratedPrompt | null> {
    if (!this.openai) {
      console.error('OpenAI API key not configured for prompt generation');
      return null;
    }

    try {
      const { title, description, source, category, isBigStory } = options;
      const aspectRatio = isBigStory ? '16:9 widescreen' : 'square';

      // Randomly select a style for variety - all professional and suitable for SaaS/business
      const styles = [
        'minimalist gradient illustration',
        'clean geometric pattern',
        'modern flat design',
        'abstract gradient mesh',
        'isometric 3D illustration',
        'soft gradient background with simple shapes',
        'corporate Memphis style illustration',
        'subtle line art illustration',
        'modern vector illustration',
        'glassmorphism design',
      ];
      const randomStyle = styles[Math.floor(Math.random() * styles.length)];

      const systemPrompt = `You are an expert at creating SIMPLE, CLEAN image generation prompts for Gemini AI. Your task is to create minimal, uncluttered prompts for newsletter images.

IMPORTANT RULES:
1. The prompt must explicitly state "no text, letters, numbers, or words in the image"
2. Keep concepts SIMPLE and MINIMAL - avoid busy or complex scenes
3. Use abstract or symbolic representations rather than literal interpretations
4. Maximum 2-3 visual elements in the entire image
5. Focus on calm, peaceful compositions with lots of empty space
6. The image should be ${aspectRatio} format
7. The style MUST be: ${randomStyle}

Return a JSON object with:
- prompt: A SHORT, SIMPLE image generation prompt (max 1 sentence) that creates a MINIMAL, UNCLUTTERED image
- concept: The main visual concept (2-3 words max)
- style: MUST be exactly "${randomStyle}" (do not change this)`;

      const userPrompt = `Create an image generation prompt for this article:
Title: ${title}
${description ? `Description: ${description}` : ''}
${source ? `Source: ${source}` : ''}
${category ? `Category: ${category}` : ''}

Generate a specific, contextual prompt that visually represents the article's content.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 200,
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');

      if (!result.prompt) {
        console.error('GPT-4o-mini did not return a valid prompt');
        return null;
      }

      console.log('Generated image prompt:', result.prompt);
      return result as GeneratedPrompt;
    } catch (error) {
      console.error('Error generating image prompt with GPT-4o-mini:', error);
      return null;
    }
  }

  /**
   * Generate prompts for multiple articles in batch
   */
  async generateBulkImagePrompts(
    articles: ImagePromptOptions[]
  ): Promise<Map<string, GeneratedPrompt>> {
    const results = new Map<string, GeneratedPrompt>();

    // Process in small batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < articles.length; i += batchSize) {
      const batch = articles.slice(i, i + batchSize);

      const promises = batch.map(async (article) => {
        const prompt = await this.generateImagePrompt(article);
        return { title: article.title, prompt };
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach(({ title, prompt }) => {
        if (prompt) {
          results.set(title, prompt);
        }
      });

      // Small delay between batches to respect rate limits
      if (i + batchSize < articles.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}
