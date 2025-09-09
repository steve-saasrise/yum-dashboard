import OpenAI from 'openai';

interface NewsItem {
  text: string;
  summary?: string;
  sourceUrl?: string;
  source?: string;
  amount?: string; // For fundraising items (e.g., "$500M")
  series?: string; // For fundraising items (e.g., "Series H")
}

interface BigStory {
  title: string;
  summary: string;
  source?: string;
  sourceUrl?: string;
}

interface GenerateNewsResult {
  items: NewsItem[];
  bigStory?: BigStory;
  specialSection?: NewsItem[];
  specialSectionTitle?: string;
  topic: string;
  generatedAt: string;
}

interface RateLimitInfo {
  limit: number;
  used: number;
  requested: number;
  retryAfter: number; // in milliseconds
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
   * Parse rate limit information from OpenAI error message
   */
  private parseRateLimitError(errorMessage: string): RateLimitInfo | null {
    // Pattern: "Rate limit reached for gpt-5-mini... Limit 200000, Used 158615, Requested 49168. Please try again in 2.334s"
    const limitMatch = errorMessage.match(
      /Limit\s+(\d+),\s*Used\s+(\d+),\s*Requested\s+(\d+)/
    );
    const retryMatch = errorMessage.match(/try again in ([\d.]+)s/);

    if (limitMatch && retryMatch) {
      return {
        limit: parseInt(limitMatch[1]),
        used: parseInt(limitMatch[2]),
        requested: parseInt(limitMatch[3]),
        retryAfter: Math.ceil(parseFloat(retryMatch[1]) * 1000), // Convert to ms and round up
      };
    }

    return null;
  }

  /**
   * Check if an error is a rate limit error
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;

    // Check for 429 status code
    if (error.status === 429 || error.response?.status === 429) {
      return true;
    }

    // Check for rate limit message in error text
    const errorMessage = error.message || error.toString();
    return (
      errorMessage.includes('429') ||
      errorMessage.includes('Rate limit') ||
      errorMessage.includes('rate limit')
    );
  }

  /**
   * Calculate backoff with jitter for scalability
   */
  private calculateBackoff(retryCount: number, baseDelay?: number): number {
    // If we have a specific retry-after from the API, use it
    if (baseDelay) {
      // Add 20-40% jitter to prevent thundering herd
      const jitter = baseDelay * (0.2 + Math.random() * 0.2);
      // Add extra buffer for safety
      return Math.ceil(baseDelay + jitter + 1000);
    }

    // Otherwise use exponential backoff with jitter
    // Start with longer initial delay for GPT-5-mini
    const baseDelayMs = 2000; // Start with 2 seconds
    const exponentialDelay = Math.min(
      baseDelayMs * Math.pow(2, retryCount),
      120000
    ); // Max 2 minutes
    const jitter = exponentialDelay * Math.random() * 0.5; // Up to 50% jitter
    return Math.ceil(exponentialDelay + jitter);
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
   * Validate that the response contains actual news items, not a conversational response
   */
  private isValidNewsResponse(items: NewsItem[]): boolean {
    // Must have at least 3 items to be considered valid
    if (items.length < 3) {
      console.log(`Invalid response: Only ${items.length} items found`);
      return false;
    }

    // Check if any item looks like a conversational response
    const conversationalPhrases = [
      'i can do that',
      'do you want me to',
      'would you like',
      "i'll help you",
      'let me help',
      'i can help',
      'shall i',
      'should i generate',
      'should i create',
    ];

    for (const item of items) {
      const lowerText = item.text.toLowerCase();

      // Check for conversational phrases
      for (const phrase of conversationalPhrases) {
        if (lowerText.includes(phrase)) {
          console.log(
            `Invalid response detected - conversational phrase found: "${phrase}" in "${item.text}"`
          );
          return false;
        }
      }

      // Check if the text looks like malformed JSON
      if (
        item.text.startsWith('{') ||
        item.text.includes('\\"') ||
        item.text.includes('"summary"')
      ) {
        console.log(
          `Invalid response detected - malformed JSON in: "${item.text}"`
        );
        return false;
      }

      // Full URLs should not be in the text itself
      const hasFullUrl =
        item.text.includes('http://') || item.text.includes('https://');
      if (hasFullUrl) {
        console.log(
          `Invalid response detected - full URL in text: "${item.text}"`
        );
        return false;
      }

      // Each item should be at least 10 characters and not too long
      if (item.text.length < 10 || item.text.length > 200) {
        console.log(
          `Invalid response detected - inappropriate length: ${item.text.length} characters`
        );
        return false;
      }

      // Text should look like a news headline (contains some key indicators)
      // Made less restrictive - many valid headlines don't have these specific words
      const hasNewsIndicators =
        /\b(raises?|secures?|closes?|announces?|launches?|acquires?|buys?|sells?|partners?|reports?|reveals?|shows?|introduces?|expands?|opens?|shuts?|files?|sues?|wins?|loses?|gains?|drops?|surges?|falls?|jumps?|climbs?|plunges?|soars?|debuts?|rolls?|builds?|creates?|develops?|releases?|updates?|improves?|enhances?|adds?|removes?|cuts?|increases?|decreases?|grows?|shrinks?|consolidates?|merges?|splits?|pivots?|shifts?|moves?|enters?|exits?|joins?|leaves?|starts?|stops?|begins?|ends?|hits?|reaches?|passes?|exceeds?|\$|€|£|¥|billion|million|funding|round|series|ipo|merger|acquisition|deal|unicorn|valuation|revenue|profit|loss|growth|decline)\b/i.test(
          item.text
        );

      // Only log warning for debugging, don't reject valid news
      if (
        !hasNewsIndicators &&
        !item.text.includes(':') &&
        !item.text.includes(' to ')
      ) {
        console.log(`Warning: Headline may not be news-like: "${item.text}"`);
      }
    }

    return true;
  }

  /**
   * Generate news summary for a specific topic using AI with web search
   */
  async generateNews(
    loungeName: string,
    loungeDescription?: string,
    retryCount: number = 0
  ): Promise<GenerateNewsResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const maxRetries = 0; // No retries - proper staggering prevents rate limits
    const topic = this.getCleanTopic(loungeName, loungeDescription);

    // Determine special section type and title based on topic
    const topicLower = topic.toLowerCase();
    const isGrowthTopic = topicLower.includes('growth');
    const isVentureTopic = topicLower.includes('venture');

    const specialSectionType = isGrowthTopic
      ? 'growth experiments'
      : 'fundraising';

    // Generate topic-specific titles
    let specialSectionTitle: string;
    if (isGrowthTopic) {
      specialSectionTitle = 'Growth Experiments & Results';
    } else if (isVentureTopic) {
      specialSectionTitle = 'Venture Capital Deals';
    } else if (topicLower.includes('ai')) {
      specialSectionTitle = 'AI Fundraising Announcements';
    } else if (topicLower.includes('saas')) {
      specialSectionTitle = 'SaaS Fundraising Announcements';
    } else if (topicLower.includes('crypto')) {
      specialSectionTitle = 'Crypto Fundraising Announcements';
    } else {
      // Fallback for other topics
      specialSectionTitle = `${topic} Fundraising Announcements`;
    }

    const specialSectionFocus = isGrowthTopic
      ? 'A/B tests, conversion rates, growth metrics, campaign results'
      : 'funding rounds, Series A/B/C/D/E/F, seed rounds, acquisitions, valuations, investor names, funding amounts';

    // Build structured JSON prompt for better AI understanding
    const promptSpec = {
      task: 'Generate a news digest with web search',
      topic: topic,
      timeframe: {
        requirement: 'LAST 24 HOURS ONLY',
        emphasis: 'ALL items must be from TODAY or YESTERDAY',
        restriction: 'NO older news allowed',
      },
      output: {
        format: 'JSON',
        sections: [
          {
            name: 'bigStory',
            description:
              'The single most impactful news from the last 24 hours',
            fields: {
              title: {
                type: 'string',
                description:
                  'The headline (keep original if good, or write a better one)',
                maxLength: 100,
              },
              summary: {
                type: 'string',
                description:
                  '2-3 sentence summary explaining what happened and why it matters',
                maxLength: 300,
              },
              source: {
                type: 'string',
                description: 'The source publication name',
              },
              sourceUrl: {
                type: 'string',
                description: 'The URL of the article',
                format: 'url',
              },
            },
          },
          {
            name: 'bullets',
            description: `Exactly 5 other important news items from the last 24 hours (EXCLUDING ${specialSectionType} news)`,
            type: 'array',
            count: 5,
            itemFields: {
              text: {
                type: 'string',
                description: 'Short, punchy headline',
                wordCount: '5-10 words max',
                maxLength: 80,
              },
              summary: {
                type: 'string',
                description: '1-2 sentence explanation of what happened',
                wordCount: '20-30 words',
                maxLength: 200,
              },
              sourceUrl: {
                type: 'string',
                description: 'The URL of the article',
                format: 'url',
              },
              source: {
                type: 'string',
                description: 'The publication name',
              },
            },
          },
          {
            name: 'specialSection',
            description: `3-5 bullet points specifically about ${specialSectionType} from the last 24 hours`,
            type: 'array',
            count: '3-5',
            focus: specialSectionFocus,
            itemFields: {
              text: {
                type: 'string',
                description: `Company name and short action (e.g., "DataBricks raises funding" or "Stripe experiments with pricing")`,
                wordCount: '5-8 words max',
                maxLength: 60,
              },
              summary: {
                type: 'string',
                description: '1-2 sentence explanation including key details',
                wordCount: '20-30 words',
                maxLength: 200,
              },
              amount: {
                type: 'string',
                description:
                  'Funding amount if applicable (e.g., "$500M", "$1.2B")',
                optional: !isGrowthTopic,
                format: 'currency',
              },
              series: {
                type: 'string',
                description:
                  'Funding round/series if applicable (e.g., "Series H", "Seed", "Series A")',
                optional: !isGrowthTopic,
              },
              sourceUrl: {
                type: 'string',
                description: 'The URL of the article',
                format: 'url',
              },
              source: {
                type: 'string',
                description: 'The publication name',
              },
            },
          },
        ],
      },
      focus: {
        regions: ['United States', 'Europe', 'Major global tech markets'],
        priorities: [
          'Major funding rounds (Series A and above)',
          'Exits and acquisitions',
          'IPOs and public offerings',
          'Significant product launches',
          'Industry-changing developments',
          'Regulatory changes affecting the industry',
        ],
        topics: topic.includes('AI')
          ? [
              'AI model releases',
              'AI regulations',
              'AI company funding',
              'AI research breakthroughs',
              'AI ethics and safety',
            ]
          : topic.includes('SaaS')
            ? [
                'SaaS company funding',
                'SaaS acquisitions',
                'Enterprise software deals',
                'Cloud infrastructure news',
                'SaaS metrics and trends',
              ]
            : [
                'Industry-specific developments',
                'Major company news',
                'Technology breakthroughs',
                'Market movements',
                'Strategic partnerships',
              ],
      },
      constraints: [
        'NO conversational text or explanations',
        'NO questions or prompts',
        'NO domain names in the text field',
        'NO duplicate stories',
        'MUST be factual news from credible sources',
        'MUST include source attribution',
      ],
      responseFormat: {
        structure: 'Pure JSON only',
        example: {
          bigStory: {
            title: 'Example headline here',
            summary: 'What happened and why it matters...',
            source: 'TechCrunch',
            sourceUrl: 'https://example.com/article',
          },
          bullets: [
            {
              text: 'Brief news headline here',
              sourceUrl: 'https://example.com/news',
              source: 'Reuters',
            },
          ],
        },
      },
    };

    const prompt = `Execute this news generation task:
${JSON.stringify(promptSpec, null, 2)}

Return ONLY the JSON response with no additional text.`;

    try {
      // Try to use the Responses API with web search
      if ((this.openai as any).responses?.create) {
        try {
          console.log(`Using gpt-5-mini with web search for ${topic} news...`);

          const response = await (this.openai as any).responses.create({
            model: 'gpt-5-mini',
            tools: [
              {
                type: 'web_search',
                search_context_size: 'medium',
              },
            ],
            input: prompt,
            max_output_tokens: 10000,
          });

          // Extract items and bigStory from the response
          const items: NewsItem[] = [];
          let bigStory: BigStory | undefined;
          const specialItems: NewsItem[] = [];

          // Handle new response format - response can be an object with output array or just an array
          let outputText: string | undefined;
          let annotations: any[] = [];

          // Check if response has an output property (new API format)
          const outputArray = response.output || response;

          if (Array.isArray(outputArray)) {
            // Find the message item in the output array
            const messageItem = outputArray.find(
              (item: any) => item.type === 'message'
            );

            if (messageItem && messageItem.content && messageItem.content[0]) {
              outputText = messageItem.content[0].text;
              annotations = messageItem.content[0].annotations || [];

              console.log(
                `Raw response for ${topic} (new format):`,
                outputText ? outputText.substring(0, 500) : 'No text content'
              );
            } else {
              console.log(`No message item in output array for ${topic}`);
              // Check if response is incomplete (hit token limit)
              if (
                response.status === 'incomplete' &&
                response.incomplete_details
              ) {
                console.log(
                  `Response incomplete for ${topic}: ${response.incomplete_details.reason}`
                );
              }
            }
          } else if (response.output_text) {
            // Fallback to old format if response has output_text directly
            outputText = response.output_text;
            console.log(
              `Raw response for ${topic} (old format):`,
              outputText ? outputText.substring(0, 500) : 'No text content'
            );
          } else {
            console.log(
              `Unexpected response format for ${topic}:`,
              JSON.stringify(response).substring(0, 500)
            );
          }

          if (outputText) {
            // Try to parse as JSON first
            try {
              const parsed = JSON.parse(outputText);

              // Extract bigStory if present
              if (parsed.bigStory) {
                bigStory = parsed.bigStory;
              }

              // Extract bullets
              if (parsed.bullets && Array.isArray(parsed.bullets)) {
                for (const bullet of parsed.bullets.slice(0, 5)) {
                  if (bullet.text) {
                    items.push({
                      text: bullet.text,
                      summary: bullet.summary,
                      sourceUrl: bullet.sourceUrl,
                      source: bullet.source,
                    });
                  }
                }
              }

              // Extract special section
              if (
                parsed.specialSection &&
                Array.isArray(parsed.specialSection)
              ) {
                for (const item of parsed.specialSection.slice(0, 5)) {
                  if (item.text) {
                    specialItems.push({
                      text: item.text,
                      summary: item.summary,
                      amount: item.amount,
                      series: item.series,
                      sourceUrl: item.sourceUrl,
                      source: item.source,
                    });
                  }
                }
              }
            } catch (parseError) {
              // Fallback to line-by-line parsing if not valid JSON
              console.log(
                `Failed to parse as JSON for ${topic}, falling back to line parsing`
              );

              // Split by newlines and filter out empty lines and introduction text
              const lines = outputText
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

              for (let i = 0; i < Math.min(5, lines.length); i++) {
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
                const plainUrlMatch = cleanText.match(
                  /\s+(https?:\/\/[^\s]+)$/
                );
                if (plainUrlMatch) {
                  sourceUrl = plainUrlMatch[1];
                  cleanText = cleanText.replace(plainUrlMatch[0], '').trim();
                }

                // Remove domain references from the text (e.g., "(domain.com)" or ". (domain.com)")
                cleanText = cleanText
                  .replace(
                    /\.?\s*\([a-zA-Z0-9.-]+\.(com|org|net|io|co|uk|eu|gov|edu|tv|news|app|dev|ai|tech|biz|info)\)$/g,
                    ''
                  )
                  .trim();

                // Also remove any trailing periods followed by domains
                cleanText = cleanText.replace(/\.\s*\([^)]+\)$/g, '').trim();

                // Try to find URL from annotations if not found inline
                if (!sourceUrl && annotations.length > 0) {
                  // Find annotation that might correspond to this line
                  const annotation = annotations.find(
                    (ann: any) =>
                      ann.type === 'url_citation' &&
                      outputText &&
                      outputText
                        .substring(ann.start_index, ann.end_index)
                        .includes(cleanText.substring(0, 20))
                  );
                  if (annotation) {
                    sourceUrl = annotation.url;
                  }
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
            }

            // Log what we extracted
            console.log(`Extracted ${items.length} items for ${topic}`);
          }

          // Validate the response
          if (!this.isValidNewsResponse(items)) {
            console.log(
              `Invalid response for ${topic} - no retries configured`
            );
            throw new Error(
              `Failed to get valid news response for ${topic} (web search may have returned no results)`
            );
          }

          return {
            items: this.validateAndTrimItems(items),
            bigStory,
            specialSection: specialItems.length > 0 ? specialItems : undefined,
            specialSectionTitle:
              specialItems.length > 0 ? specialSectionTitle : undefined,
            topic,
            generatedAt: new Date().toISOString(),
          };
        } catch (searchError: any) {
          console.error('Responses API error:', searchError.message);

          // Check if it's a rate limit error
          if (this.isRateLimitError(searchError)) {
            const rateLimitInfo = this.parseRateLimitError(searchError.message);
            const backoffDelay = this.calculateBackoff(
              retryCount,
              rateLimitInfo?.retryAfter
            );

            console.log(
              `Rate limit hit for ${topic}. Waiting ${backoffDelay}ms before retry...`
            );
            if (rateLimitInfo) {
              console.log(
                `  Limit: ${rateLimitInfo.limit}, Used: ${rateLimitInfo.used}, Requested: ${rateLimitInfo.requested}`
              );
            }

            throw new Error(
              `Rate limit exceeded for ${topic}. Job will retry later via queue system.`
            );
          }

          console.log('Trying alternative web search approach...');
        }
      }

      // Alternative: Try gpt-5-mini with web search if available
      console.log(`Attempting GPT-5-mini with web search for ${topic} news...`);

      try {
        const response = await (this.openai as any).responses.create({
          model: 'gpt-5-mini',
          tools: [{ type: 'web_search' }],
          input: prompt,
          max_output_tokens: 10000,
        });

        // Parse the response similar to above
        const items: NewsItem[] = [];
        let bigStory: BigStory | undefined;
        const specialItems: NewsItem[] = [];

        // Handle new response format
        let outputText: string | undefined;

        // Check if response has an output property (new API format)
        const outputArray = response.output || response;

        if (Array.isArray(outputArray)) {
          const messageItem = outputArray.find(
            (item: any) => item.type === 'message'
          );
          if (messageItem && messageItem.content && messageItem.content[0]) {
            outputText = messageItem.content[0].text;
          }
        } else if (response.output_text) {
          outputText = response.output_text;
        }

        if (outputText) {
          // Try to parse as JSON first
          try {
            const parsed = JSON.parse(outputText);

            // Extract bigStory if present
            if (parsed.bigStory) {
              bigStory = parsed.bigStory;
            }

            // Extract bullets
            if (parsed.bullets && Array.isArray(parsed.bullets)) {
              for (const bullet of parsed.bullets.slice(0, 5)) {
                if (bullet.text) {
                  items.push({
                    text: bullet.text,
                    summary: bullet.summary,
                    sourceUrl: bullet.sourceUrl,
                    source: bullet.source,
                  });
                }
              }
            }

            // Extract special section
            if (parsed.specialSection && Array.isArray(parsed.specialSection)) {
              for (const item of parsed.specialSection.slice(0, 5)) {
                if (item.text) {
                  specialItems.push({
                    text: item.text,
                    summary: item.summary,
                    amount: item.amount,
                    series: item.series,
                    sourceUrl: item.sourceUrl,
                    source: item.source,
                  });
                }
              }
            }
          } catch (parseError) {
            // Fallback to line-by-line parsing if not valid JSON
            const lines = outputText
              .split('\n')
              .filter((line: string) => line.trim());
            for (const line of lines.slice(0, 5)) {
              let cleanText = line.replace(/^[\s•\-\*\d\.]+/, '').trim();

              // Remove domain references from the text
              cleanText = cleanText
                .replace(
                  /\.?\s*\([a-zA-Z0-9.-]+\.(com|org|net|io|co|uk|eu|gov|edu|tv|news|app|dev|ai|tech|biz|info)\)$/g,
                  ''
                )
                .trim();
              cleanText = cleanText.replace(/\.\s*\([^)]+\)$/g, '').trim();

              if (cleanText) {
                items.push({ text: cleanText });
              }
            }
          }
        }

        // Validate the response
        if (!this.isValidNewsResponse(items)) {
          console.log(
            `Invalid fallback response for ${topic} - no retries configured`
          );
          throw new Error(
            `Failed to get valid news response for ${topic} (fallback web search failed)`
          );
        }

        return {
          items: this.validateAndTrimItems(items),
          bigStory,
          specialSection: specialItems.length > 0 ? specialItems : undefined,
          specialSectionTitle:
            specialItems.length > 0 ? specialSectionTitle : undefined,
          topic,
          generatedAt: new Date().toISOString(),
        };
      } catch (error: any) {
        console.error('GPT-5-mini web search error:', error.message);

        // Check if it's a rate limit error
        if (this.isRateLimitError(error)) {
          const rateLimitInfo = this.parseRateLimitError(error.message);
          const backoffDelay = this.calculateBackoff(
            retryCount,
            rateLimitInfo?.retryAfter
          );

          console.log(
            `Rate limit hit for ${topic} (fallback). Waiting ${backoffDelay}ms before retry...`
          );
          if (rateLimitInfo) {
            console.log(
              `  Limit: ${rateLimitInfo.limit}, Used: ${rateLimitInfo.used}, Requested: ${rateLimitInfo.requested}`
            );
          }

          throw new Error(
            `Rate limit exceeded for ${topic} (fallback). Job will retry later via queue system.`
          );
        }

        throw new Error(
          `Failed to generate news with web search: ${error.message}`
        );
      }
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
    // Limit to 5 items (since we now have bigStory separately)
    const trimmedItems = items.slice(0, 5);

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
