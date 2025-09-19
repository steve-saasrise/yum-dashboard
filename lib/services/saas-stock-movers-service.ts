import {
  getFinnhubStockService,
  type StockData,
} from './finnhub-stock-service';

export interface MarketIndex {
  name: string;
  changePercent: number;
  details?: string;
}

export interface StockMoversData {
  indexes: MarketIndex[];
  topGainers: StockData[];
  topLosers: StockData[];
  generatedAt: string;
}

export class SaaSStockMoversService {
  private finnhubService: ReturnType<typeof getFinnhubStockService>;
  private readonly NASDAQ_INDEX_URL =
    'https://indexes.nasdaqomx.com/Index/Overview/EMCLOUD';

  constructor() {
    this.finnhubService = getFinnhubStockService();
  }

  private async fetchSaaSIndexes(): Promise<MarketIndex[]> {
    try {
      console.log('[SaaS Stock Movers] Fetching index data via Exa...');

      // Try to fetch BVP Cloud Index data via Exa
      let bvpIndex: MarketIndex | null = null;

      try {
        // First try to get data from Google Finance via Exa crawling
        const crawlResponse = await fetch('https://api.exa.ai/contents', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.EXA_API_KEY || '',
          },
          body: JSON.stringify({
            ids: ['https://www.google.com/finance/quote/EMCLOUD:INDEXNASDAQ'],
            text: true,
          }),
        });

        if (crawlResponse.ok) {
          const crawlData = await crawlResponse.json();
          if (crawlData.results && crawlData.results[0]) {
            const text = crawlData.results[0].text || '';

            // At 8am ET, Google Finance shows:
            // - "Current price" = yesterday's closing price (market closed at 4pm)
            // - "Previous close" = the closing price from the day before yesterday
            // This gives us yesterday's daily change, which is what we want for the morning digest

            // Extract current price (e.g., "1,770.39") - this is yesterday's close
            const priceMatch = text.match(
              /BVP Nasdaq Emerging Cloud Index[\s\S]{0,100}?(\d{1,2},?\d{3}\.\d{2})/
            );
            // Extract previous close - this is from two trading days ago
            const prevCloseMatch = text.match(
              /Previous close[\s\S]{0,50}?(\d{1,2},?\d{3}\.\d{2})/
            );

            if (priceMatch && prevCloseMatch) {
              const yesterdayClose = parseFloat(priceMatch[1].replace(',', ''));
              const dayBeforeYesterdayClose = parseFloat(
                prevCloseMatch[1].replace(',', '')
              );

              // Calculate yesterday's percentage change
              const changePercent =
                ((yesterdayClose - dayBeforeYesterdayClose) /
                  dayBeforeYesterdayClose) *
                100;

              // Also try to extract revenue multiple
              const multipleMatch = text.match(
                /Average Revenue Multiple[\s\S]{0,50}?(\d+\.?\d*)x/
              );

              bvpIndex = {
                name: 'BVP Cloud Index',
                changePercent: parseFloat(changePercent.toFixed(2)),
                details: multipleMatch
                  ? `${multipleMatch[1]}x Rev`
                  : '9.1x Rev',
              };

              console.log(
                `[SaaS Stock Movers] BVP Index - Yesterday's close: ${yesterdayClose}, Previous: ${dayBeforeYesterdayClose}, Yesterday's change: ${changePercent.toFixed(2)}%`
              );
            }
          }
        }

        // If crawling didn't work, try search as fallback
        if (!bvpIndex) {
          const exaResponse = await fetch('https://api.exa.ai/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.EXA_API_KEY || '',
            },
            body: JSON.stringify({
              query:
                'EMCLOUD BVP Nasdaq Emerging Cloud Index quote price today',
              numResults: 2,
              type: 'neural',
              useAutoprompt: true,
              contents: {
                text: true,
              },
            }),
          });

          if (exaResponse.ok) {
            const exaData = await exaResponse.json();
            if (exaData.results && exaData.results[0]) {
              const text = exaData.results[0].text || '';

              // Try multiple patterns to extract percentage change
              const patterns = [
                /EMCLOUD[\s\S]{0,100}?([-+]?\d+\.?\d*)\s*%/,
                /BVP[\s\S]{0,100}?(?:up|down|rose|fell|gained|lost)[\s\S]{0,20}?([-+]?\d+\.?\d*)\s*%/,
                /(?:Change|Net Change)[\s\S]{0,20}?([-+]?\d+\.?\d*)\s*%/,
              ];

              for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                  bvpIndex = {
                    name: 'BVP Cloud Index',
                    changePercent: parseFloat(match[1]),
                    details: '9.1x Rev',
                  };
                  break;
                }
              }
            }
          }
        }
      } catch (error) {
        console.warn(
          '[SaaS Stock Movers] Exa API call failed, using fallback for BVP:',
          error
        );
      }

      // If Exa failed or didn't return data, use fallback
      if (!bvpIndex) {
        console.log('[SaaS Stock Movers] Using fallback data for BVP Index');
        bvpIndex = {
          name: 'BVP Cloud Index',
          changePercent: 0,
          details: '9.1x Rev',
        };
      }

      console.log(`[SaaS Stock Movers] Retrieved index data`);
      return [bvpIndex];
    } catch (error) {
      console.error('[SaaS Stock Movers] Error fetching index data:', error);
      // Return default structure on error
      return [
        {
          name: 'BVP Cloud Index',
          changePercent: 0,
          details: '9.1x Rev',
        },
      ];
    }
  }

  public async generateStockMovers(): Promise<StockMoversData> {
    try {
      console.log(
        '[SaaS Stock Movers] Generating comprehensive SaaS market data...'
      );

      // Fetch both data sources in parallel
      const [indexes, stockData] = await Promise.all([
        this.fetchSaaSIndexes(),
        this.finnhubService.getSaaSStockMovers(),
      ]);

      // Format the financial metrics for each stock
      const formatMetrics = (stock: StockData): StockData => {
        // Return stock data as-is - no need to combine metrics
        // The email template will handle display formatting
        return {
          ...stock,
          marketCap: stock.marketCap || undefined,
          revenue: stock.revenue || undefined,
          ebitda: stock.ebitda || undefined,
        };
      };

      const result: StockMoversData = {
        indexes,
        topGainers: stockData.topGainers.map(formatMetrics),
        topLosers: stockData.topLosers.map(formatMetrics),
        generatedAt: new Date().toISOString(),
      };

      console.log(
        `[SaaS Stock Movers] Generated: ${result.indexes.length} indexes, ` +
          `${result.topGainers.length} gainers, ${result.topLosers.length} losers`
      );

      return result;
    } catch (error) {
      console.error('[SaaS Stock Movers] Error generating stock data:', error);

      // Return empty data structure on error
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
let saasStockMoversService: SaaSStockMoversService | null = null;

export function getSaaSStockMoversService(): SaaSStockMoversService {
  if (!saasStockMoversService) {
    // Check that required API keys are set
    if (!process.env.EXA_API_KEY) {
      console.warn('EXA_API_KEY not set, will use fallback data for indexes');
    }
    if (!process.env.FINNHUB_API_KEY) {
      throw new Error('FINNHUB_API_KEY environment variable is not set');
    }
    saasStockMoversService = new SaaSStockMoversService();
  }
  return saasStockMoversService;
}
