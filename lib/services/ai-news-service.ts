import OpenAI from 'openai';

interface NewsItem {
  text: string;
  sourceUrl?: string;
}

interface GenerateNewsResult {
  items: NewsItem[];
  topic: string;
  generatedAt: string;
}

export class AINewsService {
  private openai: OpenAI | null = null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Clean topic name by removing "Coffee" and similar suffixes
   */
  private getCleanTopic(
    loungeName: string,
    loungeDescription?: string
  ): string {
    // Use description if available
    if (loungeDescription) {
      return loungeDescription;
    }

    // Otherwise clean the name (remove "Coffee" and similar suffixes)
    return loungeName.replace(/\s*(Coffee|Lounge|Room|Hub)$/i, '').trim();
  }

  /**
   * Generate news summary for a specific topic using AI with web search
   */
  async generateNews(
    loungeName: string,
    loungeDescription?: string
  ): Promise<GenerateNewsResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const topic = this.getCleanTopic(loungeName, loungeDescription);

    // Build the prompt with the specified template
    const prompt = `Please search for and create a short bulleted summary of the top REAL news and takeaways from the last 24 hours in the field of ${topic}. 

Requirements:
- Exactly 6 bullet points with a total of 70 words maximum
- Each bullet must summarize REAL news from actual sources
- Include the actual source URL for each bullet point
- Focus on the most important and impactful news
- If there was a large round of funding or an exit/sale/IPO of a well known firm within the sector, prioritize mentioning it
- This is for a daily digest for professionals in the field

Format your response as a JSON object with an "items" array:
{
  "items": [
    {"text": "Brief summary of actual news", "sourceUrl": "https://actual-source.com/article"},
    ...
  ]
}`;

    try {
      // Use o4-mini-deep-research with web search
      // Note: The responses API is a newer feature, we'll handle both cases
      const useDeepResearch = true;

      if (useDeepResearch && (this.openai as any).responses?.create) {
        try {
          console.log(
            `Using o4-mini-deep-research to search for ${topic} news...`
          );

          const response = await (this.openai as any).responses.create({
            model: 'o4-mini-deep-research',
            tools: [{ type: 'web_search' }],
            input: prompt,
          });

          // Parse the response
          let items: NewsItem[] = [];
          try {
            const parsed = JSON.parse(response.output_text || '{"items":[]}');
            items = parsed.items || [];
          } catch (parseErr) {
            console.error('Error parsing deep research response:', parseErr);
            // Try to extract from plain text if JSON parsing fails
            items = this.extractItemsFromText(response.output_text || '');
          }

          return {
            items: this.validateAndTrimItems(items),
            topic,
            generatedAt: new Date().toISOString(),
          };
        } catch (searchError: any) {
          console.error('Deep research model error:', searchError.message);
          console.log('Falling back to standard GPT-4o-mini...');
        }
      }

      // Fallback to standard chat completion with emphasis on real news
      console.log(
        `Using GPT-4o-mini for ${topic} news (without web search)...`
      );
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional news curator. Create concise, accurate daily summaries for industry professionals. Search for and include only REAL, verifiable news from the last 24 hours with actual source URLs.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more factual content
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      // Parse the JSON response
      let items: NewsItem[] = [];
      try {
        const parsed = JSON.parse(response);
        // Handle both array and object with array property
        items = Array.isArray(parsed)
          ? parsed
          : parsed.items || parsed.news || parsed.bullets || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        // Fallback: create simple items from text
        items = this.extractItemsFromText(response);
      }

      // Validate and trim items
      items = this.validateAndTrimItems(items);

      return {
        items,
        topic,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error generating news:', error);
      throw error;
    }
  }

  /**
   * Extract news items from plain text response (fallback)
   */
  private extractItemsFromText(text: string): NewsItem[] {
    const lines = text.split('\n').filter((line) => line.trim());
    const items: NewsItem[] = [];

    for (const line of lines) {
      // Remove bullet markers like •, -, *, numbers
      const cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();
      if (cleanText) {
        items.push({ text: cleanText });
      }
    }

    return items;
  }

  /**
   * Validate and ensure items meet requirements
   */
  private validateAndTrimItems(items: NewsItem[]): NewsItem[] {
    // Limit to 6 items
    const trimmedItems = items.slice(0, 6);

    // Count total words
    let totalWords = 0;
    const validItems: NewsItem[] = [];

    for (const item of trimmedItems) {
      const words = item.text.split(/\s+/).filter((w) => w.length > 0);
      if (totalWords + words.length <= 70) {
        validItems.push(item);
        totalWords += words.length;
      } else {
        // Trim the last item to fit within limit
        const remainingWords = 70 - totalWords;
        if (remainingWords > 3) {
          const trimmedText = words.slice(0, remainingWords).join(' ') + '...';
          validItems.push({ ...item, text: trimmedText });
        }
        break;
      }
    }

    return validItems;
  }
}
