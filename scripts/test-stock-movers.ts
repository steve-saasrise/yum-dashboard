#!/usr/bin/env npx tsx

import { getGPT5StockMoversService } from '../lib/services/gpt5-stock-movers-service';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config({ path: path.resolve(process.cwd(), '.env.local') });

async function testStockMovers() {
  console.log('Testing GPT-5 Stock Movers Service...\n');

  try {
    const service = getGPT5StockMoversService();

    console.log('Generating SaaS stock movers data...');
    const startTime = Date.now();

    const stockData = await service.generateStockMovers();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Stock data generated in ${elapsed}s\n`);

    if (stockData) {
      // Display Indexes
      console.log('📊 SaaS Indexes (Prior Day)');
      console.log('─'.repeat(50));
      stockData.indexes.forEach((index) => {
        const sign = index.changePercent >= 0 ? '+' : '';
        const color = index.changePercent >= 0 ? '\x1b[32m' : '\x1b[31m';
        console.log(`${index.name}`);
        if (index.details) {
          console.log(`  ${index.details}`);
        }
        console.log(
          `  ${color}${sign}${index.changePercent.toFixed(1)}%\x1b[0m\n`
        );
      });

      // Display Top Gainers
      console.log('\n🟢 Top Gainers');
      console.log('─'.repeat(50));
      stockData.topGainers.forEach((stock, i) => {
        console.log(`${i + 1}. ${stock.companyName} (${stock.symbol})`);
        console.log(`   $${stock.price.toFixed(2)} | ${stock.marketCap}`);
        if (stock.revenue || stock.ebitda) {
          console.log(
            `   ${[stock.revenue, stock.ebitda].filter(Boolean).join(', ')}`
          );
        }
        console.log(
          `   \x1b[32m+$${Math.abs(stock.change).toFixed(2)} (+${stock.changePercent.toFixed(1)}%)\x1b[0m\n`
        );
      });

      // Display Top Losers
      console.log('\n🔴 Top Losers');
      console.log('─'.repeat(50));
      stockData.topLosers.forEach((stock, i) => {
        console.log(`${i + 1}. ${stock.companyName} (${stock.symbol})`);
        console.log(`   $${stock.price.toFixed(2)} | ${stock.marketCap}`);
        if (stock.revenue || stock.ebitda) {
          console.log(
            `   ${[stock.revenue, stock.ebitda].filter(Boolean).join(', ')}`
          );
        }
        console.log(
          `   \x1b[31m$${stock.change.toFixed(2)} (${stock.changePercent.toFixed(1)}%)\x1b[0m\n`
        );
      });

      console.log(
        `\nGenerated at: ${new Date(stockData.generatedAt).toLocaleString()}`
      );

      // Validate data structure
      console.log('\n✅ Data Validation:');
      console.log(`  - Indexes: ${stockData.indexes.length} found`);
      console.log(`  - Top Gainers: ${stockData.topGainers.length} found`);
      console.log(`  - Top Losers: ${stockData.topLosers.length} found`);

      // Check if data looks realistic
      const allStocks = [...stockData.topGainers, ...stockData.topLosers];
      const hasValidPrices = allStocks.every((s) => s.price > 0);
      const hasValidSymbols = allStocks.every(
        (s) => s.symbol && s.symbol.length > 0
      );
      const hasValidChanges =
        stockData.topGainers.every((s) => s.change > 0) &&
        stockData.topLosers.every((s) => s.change < 0);

      console.log(`  - Valid prices: ${hasValidPrices ? '✓' : '✗'}`);
      console.log(`  - Valid symbols: ${hasValidSymbols ? '✓' : '✗'}`);
      console.log(`  - Valid changes: ${hasValidChanges ? '✓' : '✗'}`);
    } else {
      console.log('❌ No stock data returned');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testStockMovers().catch(console.error);
