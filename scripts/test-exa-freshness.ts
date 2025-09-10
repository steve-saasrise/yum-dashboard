import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testExaFreshness() {
  console.log('Testing Exa freshness for crypto news...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Test different date ranges
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  console.log('Current time:', now.toISOString());
  console.log('Today:', formatDate(today));
  console.log('Yesterday:', formatDate(yesterday));
  console.log('\n');

  // Test 1: Search for crypto news from TODAY only
  console.log('='.repeat(60));
  console.log('TEST 1: Crypto news from TODAY ONLY');
  console.log('='.repeat(60));

  try {
    const todayResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news today latest breaking',
      {
        numResults: 20,
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

    console.log(`Found ${todayResults.results.length} results from TODAY\n`);

    todayResults.results.forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      console.log(`${i + 1}. [${r.publishedDate || 'NO DATE'}] ${domain}`);
      console.log(`   ${r.title}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error searching today:', error);
  }

  // Test 2: Search for crypto news from specific domain
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Search coincentral.com specifically');
  console.log('='.repeat(60));

  try {
    // Try searching with site: operator
    const coincentralResults = await exa.searchAndContents(
      'site:coincentral.com cryptocurrency news',
      {
        numResults: 20,
        useAutoprompt: false, // Don't let Exa modify our query
        type: 'keyword', // Use keyword search for site: operator
        startPublishedDate: formatDate(weekAgo),
        endPublishedDate: formatDate(now),
        text: {
          maxCharacters: 500,
        },
      }
    );

    console.log(
      `Found ${coincentralResults.results.length} CoinCentral results\n`
    );

    coincentralResults.results.forEach((r, i) => {
      console.log(`${i + 1}. [${r.publishedDate || 'NO DATE'}] ${r.title}`);
      console.log(`   URL: ${r.url}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error searching coincentral:', error);
  }

  // Test 3: Check what Exa considers "recent"
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: Date distribution of "recent" crypto news');
  console.log('='.repeat(60));

  try {
    const recentResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news latest breaking today',
      {
        numResults: 50,
        useAutoprompt: true,
        type: 'auto',
        category: 'news',
        startPublishedDate: formatDate(weekAgo),
        endPublishedDate: formatDate(now),
        text: {
          maxCharacters: 100,
        },
      }
    );

    // Group by date
    const dateGroups = new Map<string, number>();
    const noDateCount = { count: 0, domains: new Set<string>() };

    recentResults.results.forEach((r) => {
      if (r.publishedDate) {
        const date = r.publishedDate.split('T')[0];
        dateGroups.set(date, (dateGroups.get(date) || 0) + 1);
      } else {
        noDateCount.count++;
        const domain = new URL(r.url).hostname.replace('www.', '');
        noDateCount.domains.add(domain);
      }
    });

    // Sort dates
    const sortedDates = Array.from(dateGroups.entries()).sort((a, b) =>
      b[0].localeCompare(a[0])
    );

    console.log('Date distribution:');
    sortedDates.forEach(([date, count]) => {
      const daysAgo = Math.floor(
        (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
      );
      console.log(`  ${date} (${daysAgo} days ago): ${count} articles`);
    });

    if (noDateCount.count > 0) {
      console.log(`  NO DATE: ${noDateCount.count} articles from domains:`);
      Array.from(noDateCount.domains).forEach((d) => console.log(`    - ${d}`));
    }
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 4: Check if excludeDomains works better than includeDomains
  console.log('\n' + '='.repeat(60));
  console.log('TEST 4: Using excludeDomains to filter out bad sources');
  console.log('='.repeat(60));

  try {
    const excludeResults = await exa.searchAndContents(
      'cryptocurrency Bitcoin Ethereum news today latest',
      {
        numResults: 20,
        useAutoprompt: true,
        type: 'auto',
        category: 'news',
        startPublishedDate: formatDate(yesterday),
        endPublishedDate: formatDate(now),
        excludeDomains: [
          'reddit.com',
          'twitter.com',
          'x.com',
          'youtube.com',
          'facebook.com',
          'instagram.com',
          'tiktok.com',
          'medium.com',
          'substack.com',
        ],
        text: {
          maxCharacters: 500,
        },
      } as any
    );

    console.log(
      `Found ${excludeResults.results.length} results (excluding social media)\n`
    );

    excludeResults.results.slice(0, 10).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      console.log(`${i + 1}. [${r.publishedDate || 'NO DATE'}] ${domain}`);
      console.log(`   ${r.title}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error with excludeDomains:', error);
  }
}

// Run the test
testExaFreshness().catch(console.error);
