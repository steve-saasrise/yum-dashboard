interface FinnhubQuote {
  c: number; // Current price
  d: number; // Change
  dp: number; // Change percentage
  h: number; // High
  l: number; // Low
  o: number; // Open
  pc: number; // Previous close
}

interface FinnhubCompanyProfile {
  country: string;
  currency: string;
  exchange: string;
  name: string;
  ticker: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  logo: string;
  phone: string;
  weburl: string;
  finnhubIndustry: string;
}

interface FinnhubFinancials {
  metric: {
    revenuePerShareTTM?: number;
    netProfitMarginTTM?: number;
    operatingMarginTTM?: number;
    returnOnEquityTTM?: number;
    revenueGrowthTTMYoy?: number;
    epsGrowthTTMYoy?: number;
    marketCapitalization?: number;
    '52WeekHigh'?: number;
    '52WeekLow'?: number;
  };
  metricType: string;
  symbol: string;
}

export interface StockData {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap?: string;
  revenue?: string;
  revenueMultiple?: string;
  ebitda?: string;
  ebitdaMultiple?: string;
}

export class FinnhubStockService {
  private apiKey: string;
  private baseUrl = 'https://finnhub.io/api/v1';

  // Core SaaS companies to track - prioritized list
  // Top tier (always fetch)
  private readonly TOP_SAAS_COMPANIES = [
    'CRM', // Salesforce
    'NOW', // ServiceNow
    'SNOW', // Snowflake
    'TEAM', // Atlassian
    'HUBS', // HubSpot
    'DDOG', // Datadog
    'MDB', // MongoDB
    'ZM', // Zoom
    'OKTA', // Okta
    'CRWD', // CrowdStrike
  ];

  // Extended list (fetch if needed)
  private readonly EXTENDED_SAAS_COMPANIES = [
    'DOCU', // DocuSign
    'TWLO', // Twilio
    'VEEV', // Veeva Systems
    'WDAY', // Workday
    'ZS', // Zscaler
    'S', // SentinelOne
    'NET', // Cloudflare
    'SHOP', // Shopify
    'SQ', // Block (Square)
    'BILL', // Bill.com
    'MNDY', // Monday.com
    'GTLB', // GitLab
    'CFLT', // Confluent
    'U', // Unity Software
    'RBLX', // Roblox
    'DBX', // Dropbox
    'BOX', // Box
    'WIX', // Wix
    'FROG', // JFrog
    'ESTC', // Elastic
  ];

  private get SAAS_COMPANIES() {
    // For now, use top companies to avoid rate limits
    return this.TOP_SAAS_COMPANIES;
  }

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Finnhub API key is required');
    }
    this.apiKey = apiKey;
  }

  private async fetchFromFinnhub(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}&token=${this.apiKey}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `Finnhub API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      // Check for API rate limit or error response
      if (data.error) {
        throw new Error(`Finnhub API error: ${data.error}`);
      }

      return data;
    } catch (error) {
      console.error(`Error fetching from Finnhub (${endpoint}):`, error);
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<FinnhubQuote | null> {
    try {
      const data = await this.fetchFromFinnhub(`/quote?symbol=${symbol}`);

      // Check if we got valid data
      if (data && data.c > 0) {
        return data;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching quote for ${symbol}:`, error);
      return null;
    }
  }

  async getCompanyProfile(
    symbol: string
  ): Promise<FinnhubCompanyProfile | null> {
    try {
      const data = await this.fetchFromFinnhub(
        `/stock/profile2?symbol=${symbol}`
      );

      if (data && data.name) {
        return data;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching profile for ${symbol}:`, error);
      return null;
    }
  }

  async getBasicFinancials(symbol: string): Promise<FinnhubFinancials | null> {
    try {
      const data = await this.fetchFromFinnhub(
        `/stock/metric?symbol=${symbol}&metric=all`
      );

      if (data && data.metric) {
        return data;
      }

      return null;
    } catch (error) {
      console.error(`Error fetching financials for ${symbol}:`, error);
      return null;
    }
  }

  async getStockData(symbol: string): Promise<StockData | null> {
    try {
      // Fetch all data in parallel
      const [quote, profile, financials] = await Promise.all([
        this.getQuote(symbol),
        this.getCompanyProfile(symbol),
        this.getBasicFinancials(symbol),
      ]);

      if (!quote || !profile) {
        return null;
      }

      // Format market cap
      let marketCapFormatted = '';
      let revenueMultiple = '';
      const ebitdaMultiple = '';

      if (financials?.metric?.marketCapitalization) {
        const marketCap = financials.metric.marketCapitalization;
        if (marketCap >= 1000) {
          marketCapFormatted = `$${(marketCap / 1000).toFixed(1)}B Market Cap`;
        } else {
          marketCapFormatted = `$${marketCap.toFixed(1)}M Market Cap`;
        }
      } else if (profile.marketCapitalization) {
        const marketCap = profile.marketCapitalization;
        if (marketCap >= 1000) {
          marketCapFormatted = `$${(marketCap / 1000).toFixed(1)}B Market Cap`;
        } else {
          marketCapFormatted = `$${marketCap.toFixed(1)}M Market Cap`;
        }
      }

      // Calculate revenue multiple if we have revenue data
      if (financials?.metric?.revenuePerShareTTM && profile.shareOutstanding) {
        const totalRevenue =
          (financials.metric.revenuePerShareTTM * profile.shareOutstanding) /
          1000000; // in millions
        const marketCap =
          profile.marketCapitalization ||
          (quote.c * profile.shareOutstanding) / 1000000;
        const revMultiple = marketCap / totalRevenue;
        revenueMultiple = `${revMultiple.toFixed(1)}x Rev`;
      }

      return {
        symbol,
        companyName: profile.name,
        price: quote.c,
        change: quote.d,
        changePercent: quote.dp,
        marketCap: marketCapFormatted,
        revenue: revenueMultiple,
        revenueMultiple,
        ebitda: '', // Finnhub doesn't provide EBITDA in basic tier
        ebitdaMultiple: '',
      };
    } catch (error) {
      console.error(`Error getting stock data for ${symbol}:`, error);
      return null;
    }
  }

  async getSaaSStockMovers(): Promise<{
    topGainers: StockData[];
    topLosers: StockData[];
  }> {
    console.log('[Finnhub] Fetching SaaS stock data...');

    // Process in smaller batches to avoid rate limits
    // Free tier has 60 calls/minute, each stock needs 3 calls (quote, profile, financials)
    // So we can safely do 5 stocks at a time (15 calls)
    const batchSize = 5;
    const results: (StockData | null)[] = [];

    for (let i = 0; i < this.SAAS_COMPANIES.length; i += batchSize) {
      const batch = this.SAAS_COMPANIES.slice(i, i + batchSize);
      const batchPromises = batch.map((symbol) => this.getStockData(symbol));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Add a small delay between batches to avoid rate limits
      if (i + batchSize < this.SAAS_COMPANIES.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Filter out null results and sort by change percentage
    const validStocks = results.filter(
      (data): data is StockData => data !== null
    );

    // Separate gainers and losers
    const gainers = validStocks
      .filter((stock) => stock.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, 3); // Top 3 gainers

    const losers = validStocks
      .filter((stock) => stock.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, 3); // Top 3 losers

    console.log(
      `[Finnhub] Found ${gainers.length} gainers and ${losers.length} losers`
    );

    return {
      topGainers: gainers,
      topLosers: losers,
    };
  }

  // Helper method to format financials for email display
  formatStockMetrics(stock: StockData): string {
    const parts = [];

    if (stock.marketCap) {
      parts.push(stock.marketCap);
    }

    if (stock.revenueMultiple) {
      parts.push(stock.revenueMultiple);
    }

    if (stock.ebitdaMultiple) {
      parts.push(stock.ebitdaMultiple);
    }

    return parts.join(', ');
  }
}

// Export singleton instance
let finnhubService: FinnhubStockService | null = null;

export function getFinnhubStockService(): FinnhubStockService {
  if (!finnhubService) {
    const apiKey = process.env.FINNHUB_API_KEY;
    if (!apiKey) {
      throw new Error('FINNHUB_API_KEY environment variable is not set');
    }
    finnhubService = new FinnhubStockService(apiKey);
  }
  return finnhubService;
}
