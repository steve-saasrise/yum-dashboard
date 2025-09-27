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

      // Add some randomization to encourage variety
      const perspectives = [
        'Focus on the main subject or product',
        'Show an individual person in action',
        'Depict the environment or setting',
        'Illustrate the process or workflow',
        'Visualize data or information',
        'Show tools or equipment being used',
        'Create a symbolic or metaphorical representation',
        'Show close-up details',
        'Depict a wide establishing shot',
        'Focus on hands or human interaction',
        'Show the before and after contrast',
        'Illustrate cause and effect',
        'Depict motion or movement',
        'Show scale or comparison',
        'Focus on textures and materials',
        'Create an abstract interpretation',
        'Show the view from a unique angle',
        'Depict time progression',
        'Focus on patterns or repetition',
        'Show the emotional or human element',
      ];
      const randomPerspective =
        perspectives[Math.floor(Math.random() * perspectives.length)];

      const systemPrompt = `You are creating an image generation prompt for Gemini AI.

Read and understand the article content, then create an appropriate visual representation.

Perspective hint: ${randomPerspective}

Requirements:
1. The image must be photorealistic
2. Include "no text, letters, numbers, or words in the image" in your prompt
3. The image should be ${aspectRatio} format
4. Keep visuals grounded in current reality - contemporary real-world settings and existing technology only
5. ABSOLUTELY NO: boardrooms, meeting rooms, conference rooms, people sitting around tables, business meetings, presentations to groups, or office meetings of any kind
6. NO science fiction elements - no holograms, no floating displays, no glowing orbs, no neon grids, no futuristic interfaces

Return a JSON object with:
- prompt: Your image generation prompt, ending with "photorealistic, no text, letters, numbers, or words in the image"
- concept: The main visual concept (2-4 words)
- style: Always return "photorealistic"`;

      const userPrompt = `Article:
Title: ${title}
${description ? `Description: ${description}` : ''}
${source ? `Source: ${source}` : ''}
${category ? `Category: ${category}` : ''}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.8, // Increased from 0.5 for more variety
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
