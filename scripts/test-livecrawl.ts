import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testLivecrawl() {
  console.log('Testing Exa with livecrawl for fresh crypto news...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Get today's date range
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  console.log('Current time:', now.toISOString());
  console.log('Searching from:', formatDate(today));
  console.log('Searching to:', formatDate(now));
  console.log('\n');

  // Test 1: Without livecrawl (cached results)
  console.log('='.repeat(60));
  console.log('TEST 1: WITHOUT livecrawl (cached/stale results)');
  console.log('='.repeat(60));
  
  try {
    const cachedResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news today latest breaking',
      {
        numResults: 10,
        useAutoprompt: true,
        type: 'auto',
        category: 'news',
        startPublishedDate: formatDate(today),
        endPublishedDate: formatDate(now),
        text: {
          maxCharacters: 500,
        },
      }
    );

    console.log(`Found ${cachedResults.results.length} cached results\n`);
    
    cachedResults.results.slice(0, 5).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      const publishDate = r.publishedDate ? new Date(r.publishedDate) : null;
      const hoursAgo = publishDate 
        ? Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60))
        : 'unknown';
      
      console.log(`${i + 1}. [${hoursAgo} hours ago] ${domain}`);
      console.log(`   ${r.title}`);
      console.log(`   Published: ${r.publishedDate || 'NO DATE'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error with cached search:', error);
  }

  // Test 2: With livecrawl='preferred' (fresh results)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: WITH livecrawl="preferred" (fresh results)');
  console.log('='.repeat(60));
  
  try {
    const freshResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news today latest breaking',
      {
        numResults: 10,
        useAutoprompt: true,
        type: 'auto',
        category: 'news',
        startPublishedDate: formatDate(today),
        endPublishedDate: formatDate(now),
        livecrawl: 'preferred' as any, // Get fresh content
        text: {
          maxCharacters: 500,
        },
      } as any
    );

    console.log(`Found ${freshResults.results.length} fresh results\n`);
    
    freshResults.results.slice(0, 5).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      const publishDate = r.publishedDate ? new Date(r.publishedDate) : null;
      const hoursAgo = publishDate 
        ? Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60))
        : 'unknown';
      
      console.log(`${i + 1}. [${hoursAgo} hours ago] ${domain}`);
      console.log(`   ${r.title}`);
      console.log(`   Published: ${r.publishedDate || 'NO DATE'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error with livecrawl search:', error);
  }

  // Test 3: With livecrawl='always' (force fresh, no cache)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: WITH livecrawl="always" (force fresh, higher latency)');
  console.log('='.repeat(60));
  
  try {
    const startTime = Date.now();
    const alwaysFreshResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news today latest breaking',
      {
        numResults: 10,
        useAutoprompt: true,
        type: 'auto',
        category: 'news',
        startPublishedDate: formatDate(today),
        endPublishedDate: formatDate(now),
        livecrawl: 'always' as any, // Force fresh content
        text: {
          maxCharacters: 500,
        },
      } as any
    );
    const latency = Date.now() - startTime;

    console.log(`Found ${alwaysFreshResults.results.length} forced-fresh results`);
    console.log(`Latency: ${latency}ms\n`);
    
    alwaysFreshResults.results.slice(0, 5).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      const publishDate = r.publishedDate ? new Date(r.publishedDate) : null;
      const hoursAgo = publishDate 
        ? Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60))
        : 'unknown';
      
      console.log(`${i + 1}. [${hoursAgo} hours ago] ${domain}`);
      console.log(`   ${r.title}`);
      console.log(`   Published: ${r.publishedDate || 'NO DATE'}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error with always-fresh search:', error);
  }

  // Test 4: Check specific site with livecrawl
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: CoinCentral with livecrawl="preferred"');
  console.log('='.repeat(60));
  
  try {
    const coincentralResults = await exa.searchAndContents(
      'site:coincentral.com cryptocurrency news',
      {
        numResults: 10,
        useAutoprompt: false,
        type: 'keyword', // Use keyword for site: operator
        startPublishedDate: formatDate(today),
        endPublishedDate: formatDate(now),
        livecrawl: 'preferred' as any,
        text: {
          maxCharacters: 500,
        },
      } as any
    );

    console.log(`Found ${coincentralResults.results.length} CoinCentral results\n`);
    
    coincentralResults.results.slice(0, 5).forEach((r, i) => {
      const publishDate = r.publishedDate ? new Date(r.publishedDate) : null;
      const hoursAgo = publishDate 
        ? Math.floor((now.getTime() - publishDate.getTime()) / (1000 * 60 * 60))
        : 'unknown';
      
      console.log(`${i + 1}. [${hoursAgo} hours ago] ${r.title}`);
      console.log(`   Published: ${r.publishedDate || 'NO DATE'}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error searching CoinCentral:', error);
  }
}

// Run the test
testLivecrawl().catch(console.error);