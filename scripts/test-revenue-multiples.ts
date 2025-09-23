import { getFinnhubStockService } from '../lib/services/finnhub-stock-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testRevenueMultiples() {
  const service = getFinnhubStockService();

  // Test with a known stock like Salesforce (CRM)
  const symbol = 'CRM';
  console.log(`\nTesting revenue multiple calculation for ${symbol}:\n`);

  // Get the raw data
  const quote = await service.getQuote(symbol);
  const profile = await service.getCompanyProfile(symbol);
  const financials = await service.getBasicFinancials(symbol);

  console.log('Raw Data:');
  console.log('=========');

  if (quote) {
    console.log(`Current Price: $${quote.c}`);
  }

  if (profile) {
    console.log(`Company: ${profile.name}`);
    console.log(
      `Market Cap (from profile): $${(profile.marketCapitalization / 1000).toFixed(1)}B`
    );
    console.log(
      `Shares Outstanding: ${(profile.shareOutstanding / 1000).toFixed(1)}B shares`
    );
  }

  if (financials?.metric) {
    console.log(`\nFinancial Metrics:`);
    console.log(
      `Revenue per Share (TTM): $${financials.metric.revenuePerShareTTM || 'N/A'}`
    );

    if (financials.metric.revenuePerShareTTM && profile?.shareOutstanding) {
      // Calculate total revenue
      const totalRevenueMillion =
        (financials.metric.revenuePerShareTTM * profile.shareOutstanding) /
        1000000;
      console.log(
        `\nCalculated Total Revenue: $${(totalRevenueMillion / 1000).toFixed(1)}B`
      );

      // Calculate revenue multiple
      const marketCapMillion =
        profile.marketCapitalization ||
        (quote!.c * profile.shareOutstanding) / 1000000;
      const revMultiple = marketCapMillion / totalRevenueMillion;

      console.log(`Market Cap (millions): $${marketCapMillion.toFixed(0)}M`);
      console.log(
        `Total Revenue (millions): $${totalRevenueMillion.toFixed(0)}M`
      );
      console.log(`Revenue Multiple: ${revMultiple.toFixed(1)}x`);

      console.log(`\nFormula Check:`);
      console.log(
        `${marketCapMillion.toFixed(0)} ÷ ${totalRevenueMillion.toFixed(0)} = ${revMultiple.toFixed(1)}x`
      );
    }
  }

  // Get the formatted stock data
  console.log('\n\nFormatted Stock Data:');
  console.log('====================');
  const stockData = await service.getStockData(symbol);
  if (stockData) {
    console.log(`Symbol: ${stockData.symbol}`);
    console.log(`Company: ${stockData.companyName}`);
    console.log(`Price: $${stockData.price.toFixed(2)}`);
    console.log(`Change: ${stockData.changePercent.toFixed(1)}%`);
    console.log(`Market Cap: ${stockData.marketCap}`);
    console.log(`Revenue Multiple: ${stockData.revenue}`);
  }

  // Compare with expected values
  console.log('\n\nExpected Values (approximate):');
  console.log('==============================');
  console.log('Salesforce (CRM) typically trades at 5-8x revenue');
  console.log(
    'You can verify at: https://www.google.com/finance/quote/CRM:NYSE'
  );
}

testRevenueMultiples().catch(console.error);
