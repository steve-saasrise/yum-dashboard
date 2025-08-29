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

    // Build the prompt for web search
    const prompt = `Search for and summarize the top news and takeaways from the last 24 hours in the field of ${topic}. Focus on the most important and impactful news, including any major funding rounds, acquisitions, or IPOs. Create exactly 6 bullet points with a total of 70 words maximum. Include source URLs.`;

    try {
      // Try to use the Responses API with web search
      if ((this.openai as any).responses?.create) {
        try {
          console.log(
            `Using gpt-4o-mini with web search for ${topic} news...`
          );

          const response = await (this.openai as any).responses.create({
            model: 'gpt-4o-mini',
            tools: [{ 
              type: 'web_search',
              search_context_size: 'medium'
            }],
            input: prompt,
          });

          // Extract items from the response
          let items: NewsItem[] = [];
          
          // The response will have citations in annotations
          if (response.output_text) {
            // Parse the structured response
            const lines = response.output_text.split('\n').filter((line: string) => line.trim());
            const annotations = response.content?.[0]?.annotations || [];
            
            for (let i = 0; i < Math.min(6, lines.length); i++) {
              const line = lines[i];
              const cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();
              
              // Try to find a matching citation
              const citation = annotations.find((ann: any) => 
                ann.type === 'url_citation' && 
                response.output_text.substring(ann.start_index, ann.end_index).includes(cleanText.substring(0, 20))
              );
              
              if (cleanText) {
                items.push({ 
                  text: cleanText,
                  sourceUrl: citation?.url
                });
              }
            }
          }

          return {
            items: this.validateAndTrimItems(items),
            topic,
            generatedAt: new Date().toISOString(),
          };
        } catch (searchError: any) {
          console.error('Responses API error:', searchError.message);
          console.log('Trying alternative web search approach...');
        }
      }

      // Alternative: Try gpt-4o with web search if available
      console.log(
        `Attempting GPT-4o with web search for ${topic} news...`
      );
      
      try {
        const response = await (this.openai as any).responses.create({
          model: 'gpt-4o',
          tools: [{ type: 'web_search' }],
          input: prompt,
        });

        // Parse the response similar to above
        let items: NewsItem[] = [];
        if (response.output_text) {
          const lines = response.output_text.split('\n').filter((line: string) => line.trim());
          for (const line of lines.slice(0, 6)) {
            const cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();
            if (cleanText) {
              items.push({ text: cleanText });
            }
          }
        }

        return {
          items: this.validateAndTrimItems(items),
          topic,
          generatedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error('GPT-4o web search error:', error.message);
      }

      // Final fallback: Standard chat completion (will generate synthetic news)
      console.log(
        `WARNING: Falling back to GPT-4o-mini without web search for ${topic} - results may not be current`
      );
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a news curator. Create plausible news summaries for the given topic. Since you cannot search the web, create realistic but hypothetical news items that would be typical for this industry.',
          },
          {
            role: 'user',
            content: `Create 6 brief bullet points (70 words total) about typical recent developments in ${topic}. Format as JSON with "items" array containing objects with "text" field.`,
          },
        ],
        temperature: 0.3,
        max_tokens: 400,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error('No response from OpenAI');
      }

      let items: NewsItem[] = [];
      try {
        const parsed = JSON.parse(response);
        items = Array.isArray(parsed)
          ? parsed
          : parsed.items || parsed.news || parsed.bullets || [];
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', parseError);
        items = this.extractItemsFromText(response);
      }

      return {
        items: this.validateAndTrimItems(items),
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
