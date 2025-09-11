import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testSimpleExa() {
  console.log('Testing SIMPLE Exa approach (like their example)...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Calculate date for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  console.log('Date range:', formatDate(startDate), 'to', formatDate(endDate));
  console.log('\n');

  // Test 1: Simple SaaS query (no site: operators)
  console.log('='.repeat(60));
  console.log("TEST 1: Simple SaaS Query (like Exa's example)");
  console.log('='.repeat(60));

  try {
    // Simple, natural language query - let Exa do its magic
    const saasQuery = `recent SaaS startup funding rounds Series A B C acquisitions`;

    console.log('Query:', saasQuery);
    console.log('Using: autoprompt=true, type=auto\n');

    const saasResults = await exa.searchAndContents(saasQuery, {
      numResults: 15,
      useAutoprompt: true, // Let Exa enhance the query
      type: 'auto', // Let Exa decide
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 300,
      },
    } as any);

    console.log(`Found ${saasResults.results.length} results\n`);

    // Analyze URL quality
    let articleCount = 0;
    let categoryCount = 0;

    saasResults.results.forEach((r, i) => {
      const url = new URL(r.url);
      const pathname = url.pathname;

      // Check if it's likely an article (has date pattern or long path)
      const hasDatePattern = /\/\d{4}\/\d{1,2}\//.test(pathname);
      const pathSegments = pathname.split('/').filter((s) => s);
      const isLikelyArticle =
        hasDatePattern ||
        pathSegments.length >= 3 ||
        pathname.includes('.html');

      const isCategory =
        pathname.includes('/category/') ||
        pathname.includes('/section/') ||
        pathname.includes('/topic/') ||
        pathname === '/' ||
        pathSegments.length <= 1;

      if (isLikelyArticle && !isCategory) {
        articleCount++;
        console.log(`✅ ARTICLE: ${url.hostname}${pathname}`);
      } else {
        categoryCount++;
        console.log(`❌ CATEGORY/HOME: ${url.hostname}${pathname}`);
      }

      console.log(`   Title: ${r.title}`);
      if (r.publishedDate) {
        const hoursAgo = Math.floor(
          (endDate.getTime() - new Date(r.publishedDate).getTime()) /
            (1000 * 60 * 60)
        );
        console.log(`   Published: ${hoursAgo}h ago`);
      }
      console.log('');
    });

    console.log(
      `Summary: ${articleCount} articles, ${categoryCount} category/home pages\n`
    );
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: Simple Venture Capital query
  console.log('='.repeat(60));
  console.log('TEST 2: Simple Venture Capital Query');
  console.log('='.repeat(60));

  try {
    const ventureQuery = `latest venture capital funding rounds startups raised millions Series A B C`;

    console.log('Query:', ventureQuery);
    console.log('Using: autoprompt=true, type=auto\n');

    const ventureResults = await exa.searchAndContents(ventureQuery, {
      numResults: 15,
      useAutoprompt: true,
      type: 'auto',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 300,
      },
    } as any);

    console.log(`Found ${ventureResults.results.length} results\n`);

    // Show top 5 with analysis
    ventureResults.results.slice(0, 5).forEach((r, i) => {
      const url = new URL(r.url);
      const pathname = url.pathname;
      const pathSegments = pathname.split('/').filter((s) => s);

      console.log(`${i + 1}. ${url.hostname}`);
      console.log(`   Path: ${pathname}`);
      console.log(`   Title: ${r.title}`);

      if (r.text) {
        // Check for funding mentions
        const fundingMatch = r.text.match(
          /\$[\d.]+[MBK]|\$[\d,]+|raised|funding|Series [A-F]/i
        );
        if (fundingMatch) {
          console.log(`   💰 Contains funding info`);
        }
      }

      if (r.publishedDate) {
        const hoursAgo = Math.floor(
          (endDate.getTime() - new Date(r.publishedDate).getTime()) /
            (1000 * 60 * 60)
        );
        console.log(`   ⏰ ${hoursAgo}h ago`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: Try with includeDomains (the supposedly broken feature)
  console.log('='.repeat(60));
  console.log('TEST 3: Testing includeDomains parameter');
  console.log('='.repeat(60));

  try {
    const testQuery = `SaaS startup funding Series A B C`;
    const domains = ['techcrunch.com', 'venturebeat.com', 'forbes.com'];

    console.log('Query:', testQuery);
    console.log('includeDomains:', domains);
    console.log('');

    const domainResults = await exa.searchAndContents(testQuery, {
      numResults: 10,
      useAutoprompt: true,
      type: 'auto',
      includeDomains: domains,
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 200,
      },
    } as any);

    console.log(
      `Found ${domainResults.results.length} results with includeDomains\n`
    );

    if (domainResults.results.length === 0) {
      console.log(
        '⚠️  includeDomains returned 0 results - this confirms it might not work with searchAndContents'
      );
    } else {
      domainResults.results.forEach((r, i) => {
        const domain = new URL(r.url).hostname;
        console.log(`${i + 1}. ${domain}: ${r.title}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testSimpleExa().catch(console.error);
