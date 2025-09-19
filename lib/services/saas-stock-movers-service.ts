import { getFinnhubStockService, type StockData } from './finnhub-stock-service';

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
  private readonly NASDAQ_INDEX_URL = 'https://indexes.nasdaqomx.com/Index/Overview/EMCLOUD';

  constructor() {
    this.finnhubService = getFinnhubStockService();
  }

  private async fetchSaaSIndexes(): Promise<MarketIndex[]> {
    try {
      console.log('[SaaS Stock Movers] Fetching index data via Exa...');

      // Try to fetch BVP Cloud Index data via Exa
      let bvpIndex: MarketIndex | null = null;

      try {
        // Use fetch to call Exa API directly to get BVP Cloud Index
        const exaResponse = await fetch('https://api.exa.ai/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.EXA_API_KEY || ''
          },
          body: JSON.stringify({
            query: 'BVP Nasdaq Emerging Cloud Index EMCLOUD today performance',
            numResults: 1,
            type: 'neural',
            useAutoprompt: true,
            contents: {
              text: true
            }
          })
        });

        if (exaResponse.ok) {
          const exaData = await exaResponse.json();
          if (exaData.results && exaData.results[0]) {
            const result = exaData.results[0];
            // Try to extract current data from the text
            const text = result.text || '';

            // Look for pattern like "1,770.39 37.01 2.12%" or "Net Change(%) | 2.12%"
            const percentMatch = text.match(/(?:Net Change\(%\)|changePercent|Change)[\s\S]{0,20}?([-+]?\d+\.?\d*)\s*%/);
            const multipleMatch = text.match(/Average Revenue Multiple[\s\S]{0,50}?(\d+\.?\d*)x/);

            if (percentMatch) {
              bvpIndex = {
                name: 'BVP Cloud Index',
                changePercent: parseFloat(percentMatch[1]),
                details: multipleMatch ? `${multipleMatch[1]}x Rev` : '8.5x Rev'
              };
            }
          }
        }
      } catch (error) {
        console.warn('[SaaS Stock Movers] Exa API call failed, using fallback for BVP:', error);
      }

      // If Exa failed or didn't return data, use fallback
      if (!bvpIndex) {
        bvpIndex = {
          name: 'BVP Cloud Index',
          changePercent: 0,
          details: '8.5x Rev'
        };
      }

      // Aventis index - use static data since it's only updated quarterly
      const aventisIndex: MarketIndex = {
        name: 'Aventis Public SaaS Index',
        changePercent: 0, // No daily change available
        details: '6.0x Rev (Q3 2025)'
      };

      console.log(`[SaaS Stock Movers] Retrieved index data`);
      return [bvpIndex, aventisIndex];

    } catch (error) {
      console.error('[SaaS Stock Movers] Error fetching index data:', error);
      // Return default structure on error
      return [
        {
          name: 'BVP Cloud Index',
          changePercent: 0,
          details: '6.3x Rev, 28.1x EBITDA'
        },
        {
          name: 'Aventis Public SaaS Index',
          changePercent: 0,
          details: '7.1x Rev, 24.2x EBITDA'
        }
      ];
    }
  }

  public async generateStockMovers(): Promise<StockMoversData> {
    try {
      console.log('[SaaS Stock Movers] Generating comprehensive SaaS market data...');

      // Fetch both data sources in parallel
      const [indexes, stockData] = await Promise.all([
        this.fetchSaaSIndexes(),
        this.finnhubService.getSaaSStockMovers()
      ]);

      // Format the financial metrics for each stock
      const formatMetrics = (stock: StockData): StockData => {
        // Build the metrics string
        const metrics: string[] = [];

        if (stock.marketCap) {
          metrics.push(stock.marketCap);
        }

        if (stock.revenue) {
          metrics.push(stock.revenue);
        }

        // For display in email, combine metrics
        const metricsString = metrics.join(', ');

        return {
          ...stock,
          marketCap: metricsString,
          revenue: stock.revenue || undefined,
          ebitda: stock.ebitda || undefined
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