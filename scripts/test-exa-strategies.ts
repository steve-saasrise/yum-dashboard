import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testExaStrategies() {
  console.log('Testing different Exa search strategies for news...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found in .env.local');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Calculate date for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}\n`);

  // Test 1: Natural language query with category=news
  console.log('Test 1: Natural language query with category=news');
  try {
    const results1 = await exa.searchAndContents('latest AI news and breakthroughs today', {
      numResults: 10,
      useAutoprompt: true,
      type: 'auto', // Let Exa decide
      category: 'news', // Focus on news articles
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 500,
      },
    });
    console.log(`✅ Found ${results1.results.length} results`);
    if (results1.results.length > 0) {
      console.log('Sample results:');
      results1.results.slice(0, 3).forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`  ${i + 1}. ${r.title} (${domain})`);
      });
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Test 1 failed:', error.message);
  }

  // Test 2: More specific query with select trusted domains
  console.log('Test 2: Specific query with select trusted domains');
  const selectDomains = [
    'techcrunch.com',
    'theverge.com',
    'wired.com',
    'arstechnica.com',
    'venturebeat.com',
  ];
  try {
    const results2 = await exa.searchAndContents('artificial intelligence', {
      numResults: 10,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      includeDomains: selectDomains,
      text: {
        maxCharacters: 500,
      },
    });
    console.log(`✅ Found ${results2.results.length} results with domain filter`);
    if (results2.results.length > 0) {
      console.log('Sample results:');
      results2.results.slice(0, 3).forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`  ${i + 1}. ${r.title} (${domain})`);
      });
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Test 2 failed:', error.message);
  }

  // Test 3: Query without domain filter, then manually filter
  console.log('Test 3: No domain filter initially, manual filtering after');
  const trustedDomains = [
    'reuters.com',
    'bloomberg.com',
    'wsj.com',
    'techcrunch.com',
    'theverge.com',
    'wired.com',
    'venturebeat.com',
    'forbes.com',
    'cnbc.com',
  ];
  try {
    const results3 = await exa.searchAndContents('AI artificial intelligence news today', {
      numResults: 30,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 500,
      },
    });
    console.log(`✅ Found ${results3.results.length} total results`);
    
    // Manual filtering
    const filteredResults = results3.results.filter((r) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      return trustedDomains.some(td => domain === td || domain.endsWith(`.${td}`));
    });
    
    console.log(`   After filtering: ${filteredResults.length} from trusted domains`);
    if (filteredResults.length > 0) {
      console.log('Trusted domain results:');
      filteredResults.slice(0, 3).forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`  ${i + 1}. ${r.title} (${domain})`);
      });
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Test 3 failed:', error.message);
  }

  // Test 4: Company news category
  console.log('Test 4: Using category=company for business news');
  try {
    const results4 = await exa.searchAndContents('technology companies funding announcements', {
      numResults: 10,
      useAutoprompt: true,
      type: 'auto',
      category: 'company', // Try company category
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 500,
      },
    });
    console.log(`✅ Found ${results4.results.length} company results`);
    if (results4.results.length > 0) {
      console.log('Sample results:');
      results4.results.slice(0, 3).forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`  ${i + 1}. ${r.title} (${domain})`);
      });
    }
    console.log();
  } catch (error: any) {
    console.error('❌ Test 4 failed:', error.message);
  }

  // Test 5: More natural query
  console.log('Test 5: Natural language query about recent events');
  try {
    const results5 = await exa.searchAndContents(
      'What happened in AI and technology in the last 24 hours latest news', 
      {
        numResults: 15,
        useAutoprompt: true,
        type: 'neural', // Force neural for natural language
        category: 'news',
        startPublishedDate: formatDate(startDate),
        endPublishedDate: formatDate(endDate),
        text: {
          maxCharacters: 500,
        },
      }
    );
    console.log(`✅ Found ${results5.results.length} results with neural search`);
    if (results5.results.length > 0) {
      console.log('Sample results:');
      results5.results.slice(0, 3).forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`  ${i + 1}. ${r.title} (${domain})`);
      });
    }
  } catch (error: any) {
    console.error('❌ Test 5 failed:', error.message);
  }

  console.log('\n✅ All strategy tests completed!');
}

// Run the test
testExaStrategies().catch(console.error);