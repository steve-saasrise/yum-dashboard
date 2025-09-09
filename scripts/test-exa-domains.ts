import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testExaDomains() {
  console.log('Testing what domains Exa returns for AI news...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found in .env.local');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Calculate date for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  const searchQuery =
    'latest AI artificial intelligence news breakthroughs announcements funding today';

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

    console.log('Top domains returned by Exa:');
    sortedDomains.slice(0, 20).forEach(([domain, count]) => {
      console.log(`  ${count}x ${domain}`);
    });

    console.log(`\nTotal unique domains: ${allDomains.size}`);

    // Check which are from trusted sources
    const trustedDomains = [
      'techcrunch.com',
      'theverge.com',
      'wired.com',
      'venturebeat.com',
      'reuters.com',
      'bloomberg.com',
      'forbes.com',
      'cnbc.com',
      'wsj.com',
      'ft.com',
      'arstechnica.com',
      'engadget.com',
      'thenextweb.com',
      'zdnet.com',
      'cnet.com',
      'businessinsider.com',
      'axios.com',
      'theinformation.com',
      'semafor.com',
    ];

    const foundTrusted = Array.from(allDomains).filter((d) =>
      trustedDomains.some((td) => d === td || d.endsWith(`.${td}`))
    );

    console.log(
      '\nTrusted domains found:',
      foundTrusted.length > 0 ? foundTrusted : 'NONE'
    );

    // Show some sample results
    console.log('\nSample results:');
    results.results.slice(0, 5).forEach((r, i) => {
      const domain = new URL(r.url).hostname;
      console.log(`\n${i + 1}. ${r.title}`);
      console.log(`   Domain: ${domain}`);
      console.log(`   URL: ${r.url}`);
      if (r.publishedDate) {
        console.log(`   Published: ${r.publishedDate}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testExaDomains().catch(console.error);
