import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testExaSimple() {
  console.log('Testing Exa API with different configurations...\n');

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

  // Test 1: Simple search without any filters
  console.log('Test 1: Simple search without filters');
  try {
    const results1 = await exa.search('AI news today', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
    });
    console.log(`✅ Found ${results1.results.length} results\n`);
  } catch (error) {
    console.error('❌ Test 1 failed:', error);
  }

  // Test 2: Search with date filters only
  console.log('Test 2: Search with date filters');
  try {
    const results2 = await exa.search('AI news today', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
    });
    console.log(`✅ Found ${results2.results.length} results\n`);
  } catch (error) {
    console.error('❌ Test 2 failed:', error);
  }

  // Test 3: Search with a few trusted domains
  console.log('Test 3: Search with limited domain whitelist');
  try {
    const results3 = await exa.search('AI news', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
      includeDomains: ['techcrunch.com', 'theverge.com', 'wired.com'],
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
    });
    console.log(`✅ Found ${results3.results.length} results\n`);
  } catch (error) {
    console.error('❌ Test 3 failed:', error);
  }

  // Test 4: searchAndContents with date filters
  console.log('Test 4: searchAndContents with date filters');
  try {
    const results4 = await exa.searchAndContents('AI news', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 1000,
        includeHtmlTags: false,
      },
    });
    console.log(`✅ Found ${results4.results.length} results\n`);
    if (results4.results.length > 0) {
      console.log('First result:', {
        title: results4.results[0].title,
        url: results4.results[0].url,
        hasText: !!results4.results[0].text,
      });
    }
  } catch (error) {
    console.error('❌ Test 4 failed:', error);
  }

  // Test 5: searchAndContents with domains and date filters
  console.log('\nTest 5: searchAndContents with domains AND date filters');
  try {
    const results5 = await exa.searchAndContents('AI news', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
      includeDomains: ['techcrunch.com', 'theverge.com', 'wired.com'],
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 1000,
        includeHtmlTags: false,
      },
    });
    console.log(`✅ Found ${results5.results.length} results\n`);
  } catch (error: any) {
    console.error('❌ Test 5 failed:', error.message || error);
  }

  // Test 6: searchAndContents with a large domain list
  console.log('Test 6: searchAndContents with large domain whitelist');
  const largeDomainList = [
    'reuters.com',
    'bloomberg.com',
    'wsj.com',
    'ft.com',
    'forbes.com',
    'businessinsider.com',
    'cnbc.com',
    'techcrunch.com',
    'theverge.com',
    'arstechnica.com',
    'wired.com',
    'venturebeat.com',
    'theinformation.com',
  ];
  try {
    const results6 = await exa.searchAndContents('AI news', {
      numResults: 5,
      useAutoprompt: true,
      type: 'neural',
      includeDomains: largeDomainList,
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 1000,
        includeHtmlTags: false,
      },
    });
    console.log(`✅ Found ${results6.results.length} results\n`);
  } catch (error: any) {
    console.error('❌ Test 6 failed:', error.message || error);
  }

  console.log('✅ All tests completed!');
}

// Run the test
testExaSimple().catch(console.error);