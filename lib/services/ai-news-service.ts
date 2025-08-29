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
    const prompt = `Please create a short bulleted summary of the top news and takeaways from the last 24 hours in the field of ${topic}. Limit to six bullet points and a total of 70 words max. Return ONLY 6 bullet points, no introduction or summary text. This is meant to introduce a daily digest newsletter covering the top news from the last 24 hours in this sector. You are creating a quickly scannable morning must-know summary for professionals who work in the field. If there was a large round of funding or an exit/sale/IPO of a well known firm within the SaaS sector, be sure to mention that. Include source URLs when available.`;

    try {
      // Try to use the Responses API with web search
      if ((this.openai as any).responses?.create) {
        try {
          console.log(`Using gpt-4o with web search for ${topic} news...`);

          const response = await (this.openai as any).responses.create({
            model: 'gpt-4o',
            tools: [
              {
                type: 'web_search',
                search_context_size: 'medium',
              },
            ],
            input: prompt,
          });

          // Extract items from the response
          const items: NewsItem[] = [];

          if (response.output_text) {
            console.log(
              `Raw response for ${topic}:`,
              response.output_text.substring(0, 500)
            );

            // Split by newlines and filter out empty lines and introduction text
            const lines = response.output_text
              .split('\n')
              .map((line: string) => line.trim())
              .filter((line: string) => {
                // Skip empty lines
                if (!line) return false;
                // Skip introduction lines
                if (
                  line.toLowerCase().includes('here are') ||
                  line.toLowerCase().includes('top news') ||
                  line.toLowerCase().includes('developments from') ||
                  line.toLowerCase().includes('latest news') ||
                  line.toLowerCase().includes('summary of')
                ) {
                  return false;
                }
                return true;
              });

            // Extract URLs from the text using regex
            const urlRegex = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;

            for (let i = 0; i < Math.min(6, lines.length); i++) {
              const line = lines[i];
              // Remove bullet points, numbers, etc.
              let cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();

              // Extract URL if it's embedded in markdown format
              let sourceUrl: string | undefined;
              const urlMatch = urlRegex.exec(line);
              if (urlMatch) {
                sourceUrl = urlMatch[2];
                // Remove the markdown link from the text
                cleanText = line
                  .replace(urlRegex, '$1')
                  .replace(/^[\s•\-\*\d\.]+/, '')
                  .trim();
              }

              // Also check if there's a plain URL at the end
              const plainUrlMatch = cleanText.match(/\s+(https?:\/\/[^\s]+)$/);
              if (plainUrlMatch) {
                sourceUrl = plainUrlMatch[1];
                cleanText = cleanText.replace(plainUrlMatch[0], '').trim();
              }

              if (cleanText && cleanText.length > 10) {
                // Only add substantial text
                items.push({
                  text: cleanText,
                  sourceUrl,
                });
              }

              // Reset regex lastIndex for next iteration
              urlRegex.lastIndex = 0;
            }

            // Log what we extracted
            console.log(`Extracted ${items.length} items for ${topic}`);
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
      console.log(`Attempting GPT-4o with web search for ${topic} news...`);

      try {
        const response = await (this.openai as any).responses.create({
          model: 'gpt-4o',
          tools: [{ type: 'web_search' }],
          input: prompt,
        });

        // Parse the response similar to above
        const items: NewsItem[] = [];
        if (response.output_text) {
          const lines = response.output_text
            .split('\n')
            .filter((line: string) => line.trim());
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
