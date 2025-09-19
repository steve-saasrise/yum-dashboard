import OpenAI from 'openai';

export interface StockMover {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  revenue?: string;
  ebitda?: string;
}

export interface MarketIndex {
  name: string;
  changePercent: number;
  details?: string;
}

export interface StockMoversData {
  indexes: MarketIndex[];
  topGainers: StockMover[];
  topLosers: StockMover[];
  generatedAt: string;
}

export class GPT5StockMoversService {
  private client: OpenAI;
  private model: string = 'gpt-5-mini'; // Using GPT-5-mini model

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  public async generateStockMovers(): Promise<StockMoversData> {
    try {
      console.log(
        '[GPT-5 Stock Movers] Generating SaaS stock movers with web search...'
      );

      // Get today's date for context
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Use the Responses API with web_search tool and Structured Outputs
      const response = await (this.client as any).responses.create({
        model: this.model,
        reasoning: {
          effort: 'low', // Low effort for cost and speed
        },
        tools: [
          {
            type: 'web_search',
            search_context_size: 'low', // Low context for speed
          },
        ],
        include: ['web_search_call.action.sources'],
        instructions: `Extract real stock prices from web search results. Return actual numbers only, never questions or placeholder text.`,
        input: `Search for "software stocks gainers today" and "software stocks losers today" to find real stock prices and percentage changes.`,
        text: {
          format: {
            type: 'json_schema',
            name: 'stock_movers',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                indexes: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      changePercent: { type: 'number' },
                      details: { type: 'string' }
                    },
                    required: ['name', 'changePercent', 'details'],
                    additionalProperties: false
                  }
                },
                topGainers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      symbol: { type: 'string' },
                      companyName: { type: 'string' },
                      price: { type: 'number' },
                      change: { type: 'number' },
                      changePercent: { type: 'number' },
                      marketCap: { type: ['string', 'null'] },
                      revenue: { type: ['string', 'null'] },
                      ebitda: { type: ['string', 'null'] }
                    },
                    required: ['symbol', 'companyName', 'price', 'change', 'changePercent', 'marketCap', 'revenue', 'ebitda'],
                    additionalProperties: false
                  }
                },
                topLosers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      symbol: { type: 'string' },
                      companyName: { type: 'string' },
                      price: { type: 'number' },
                      change: { type: 'number' },
                      changePercent: { type: 'number' },
                      marketCap: { type: ['string', 'null'] },
                      revenue: { type: ['string', 'null'] },
                      ebitda: { type: ['string', 'null'] }
                    },
                    required: ['symbol', 'companyName', 'price', 'change', 'changePercent', 'marketCap', 'revenue', 'ebitda'],
                    additionalProperties: false
                  }
                }
              },
              required: ['indexes', 'topGainers', 'topLosers'],
              additionalProperties: false
            }
          }
        }
      });

      // Extract the structured JSON from the response
      let parsed: any;

      // With Structured Outputs, the response should have valid JSON
      if (response.output_text) {
        // Direct output_text property (preferred with Structured Outputs)
        console.log('[GPT-5 Stock Movers] Found output_text, length:', response.output_text.length);
        parsed = JSON.parse(response.output_text);
      } else if (response.output && Array.isArray(response.output)) {
        // Find the message item (comes after web_search_call)
        const messageItem = response.output.find(
          (item: any) => item.type === 'message'
        );

        if (messageItem?.content) {
          // Check for refusal first
          if (Array.isArray(messageItem.content)) {
            const refusalItem = messageItem.content.find((c: any) => c.type === 'refusal');
            if (refusalItem) {
              console.error('[GPT-5 Stock Movers] Model refused request:', refusalItem.refusal);
              throw new Error(`Model refused: ${refusalItem.refusal}`);
            }

            // Get the output_text
            const textItem = messageItem.content.find((c: any) => c.type === 'output_text');
            if (textItem?.text) {
              console.log('[GPT-5 Stock Movers] Found output_text in message, parsing JSON');
              parsed = JSON.parse(textItem.text);
            }
          }
        }

        // Log if we found web search results for debugging
        const webSearchCall = response.output.find(
          (item: any) => item.type === 'web_search_call'
        );
        if (webSearchCall?.action?.sources) {
          console.log(`[GPT-5 Stock Movers] Web search found ${webSearchCall.action.sources.length} sources`);
        }
      }

      if (!parsed) {
        console.error(
          '[GPT-5 Stock Movers] Could not extract JSON from response:',
          JSON.stringify(response, null, 2).substring(0, 1000)
        );
        throw new Error('Could not extract structured data from GPT-5 response');
      }

      // Format market caps if they're just numbers
      const formatMarketCap = (stock: any) => {
        if (stock.marketCap && !stock.marketCap.includes('B') && !stock.marketCap.includes('M')) {
          const num = parseFloat(stock.marketCap);
          if (num > 1000000000000) {
            stock.marketCap = `${(num / 1000000000000).toFixed(1)}T Market Cap`;
          } else if (num > 1000000000) {
            stock.marketCap = `${(num / 1000000000).toFixed(1)}B Market Cap`;
          } else if (num > 1000000) {
            stock.marketCap = `${(num / 1000000).toFixed(1)}M Market Cap`;
          }
        }
        return stock;
      };

      // Add generated timestamp and format data
      const result: StockMoversData = {
        indexes: parsed.indexes || [],
        topGainers: (parsed.topGainers || []).map(formatMarketCap),
        topLosers: (parsed.topLosers || []).map(formatMarketCap),
        generatedAt: new Date().toISOString(),
      };

      console.log(
        `[GPT-5 Stock Movers] Generated from web search: ${result.indexes.length} indexes, ` +
          `${result.topGainers.length} gainers, ${result.topLosers.length} losers`
      );

      // Check if we got meaningful data
      const hasValidData = result.topGainers.length > 0 || result.topLosers.length > 0;

      if (!hasValidData) {
        console.warn('[GPT-5 Stock Movers] No valid stock data found from web search');
      }

      return result;
    } catch (error: any) {
      console.error('[GPT-5 Stock Movers] Error generating stock data:', error);

      // Return empty data - no fake/fallback data
      return {
        indexes: [],
        topGainers: [],
        topLosers: [],
        generatedAt: new Date().toISOString(),
      };
    }
  }
}

// Export singleton instance
let gpt5StockMoversService: GPT5StockMoversService | null = null;

export function getGPT5StockMoversService(): GPT5StockMoversService {
  if (!gpt5StockMoversService) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    gpt5StockMoversService = new GPT5StockMoversService(apiKey);
  }
  return gpt5StockMoversService;
}
