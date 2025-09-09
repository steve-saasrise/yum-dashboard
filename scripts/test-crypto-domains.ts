import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testCryptoDomains() {
  console.log('Testing what domains Exa returns for crypto news...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Calculate date for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const searchQuery =
    'cryptocurrency blockchain Bitcoin Ethereum DeFi NFT Web3 crypto news today';

  console.log('Searching for:', searchQuery);
  console.log(
    `Date range: ${formatDate(startDate)} to ${formatDate(endDate)}\n`
  );

  try {
    const results = await exa.searchAndContents(searchQuery, {
      numResults: 50,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      text: {
        maxCharacters: 100,
      },
    });

    console.log(`Found ${results.results.length} results\n`);

    // Count domains
    const domainCounts = new Map<string, number>();
    const allDomains = new Set<string>();

    results.results.forEach((r) => {
      const url = new URL(r.url);
      const domain = url.hostname.replace('www.', '');
      allDomains.add(domain);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);
    });

    // Sort by count
    const sortedDomains = Array.from(domainCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    console.log('Top domains returned by Exa for crypto:');
    sortedDomains.forEach(([domain, count]) => {
      console.log(`  ${count}x ${domain}`);
    });

    console.log(`\nTotal unique domains: ${allDomains.size}`);

    // Show some sample results
    console.log('\nSample crypto news results:');
    results.results.slice(0, 10).forEach((r, i) => {
      const domain = new URL(r.url).hostname;
      console.log(`\n${i + 1}. ${r.title}`);
      console.log(`   Domain: ${domain}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testCryptoDomains().catch(console.error);
