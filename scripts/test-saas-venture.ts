import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testSaaSVenture() {
  console.log('Testing Exa results for SaaS and Venture topics...\n');

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

  // Test 1: SaaS query (as used in the code)
  console.log('='.repeat(60));
  console.log('TEST 1: SaaS Query');
  console.log('='.repeat(60));

  try {
    const saasQuery = `SaaS software startup funding acquisitions product launches Salesforce Slack Zoom Microsoft Teams Notion news today`;
    
    console.log('Query:', saasQuery);
    console.log('');

    const saasResults = await exa.searchAndContents(saasQuery, {
      numResults: 20,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 500,
      },
    } as any);

    console.log(`Found ${saasResults.results.length} SaaS results\n`);

    // Analyze results
    const dateAnalysis = new Map<string, number>();
    const domainAnalysis = new Map<string, number>();

    saasResults.results.forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      domainAnalysis.set(domain, (domainAnalysis.get(domain) || 0) + 1);

      if (r.publishedDate) {
        const date = r.publishedDate.split('T')[0];
        dateAnalysis.set(date, (dateAnalysis.get(date) || 0) + 1);
        
        const pubDate = new Date(r.publishedDate);
        const hoursAgo = Math.floor((endDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60));
        
        console.log(`${i + 1}. [${hoursAgo}h ago] ${domain}`);
        console.log(`   ${r.title}`);
        console.log(`   Score: ${r.score}`);
        if (r.text) {
          console.log(`   Preview: ${r.text.substring(0, 100)}...`);
        }
      } else {
        console.log(`${i + 1}. [NO DATE] ${domain}`);
        console.log(`   ${r.title}`);
      }
      console.log('');
    });

    console.log('Date distribution:');
    Array.from(dateAnalysis.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([date, count]) => {
        const daysAgo = Math.floor((endDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  ${date} (${daysAgo} days ago): ${count} articles`);
      });
    console.log('');

    console.log('Top domains:');
    Array.from(domainAnalysis.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`  ${count}x ${domain}`);
      });
  } catch (error) {
    console.error('Error with SaaS search:', error);
  }

  // Test 2: Venture query
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: Venture Capital Query');
  console.log('='.repeat(60));

  try {
    const ventureQuery = `venture capital VC funding rounds Series A B C startup investments acquisitions IPO news today`;
    
    console.log('Query:', ventureQuery);
    console.log('');

    const ventureResults = await exa.searchAndContents(ventureQuery, {
      numResults: 20,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 500,
      },
    } as any);

    console.log(`Found ${ventureResults.results.length} Venture results\n`);

    // Analyze results
    const dateAnalysis = new Map<string, number>();
    const domainAnalysis = new Map<string, number>();

    ventureResults.results.forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      domainAnalysis.set(domain, (domainAnalysis.get(domain) || 0) + 1);

      if (r.publishedDate) {
        const date = r.publishedDate.split('T')[0];
        dateAnalysis.set(date, (dateAnalysis.get(date) || 0) + 1);
        
        const pubDate = new Date(r.publishedDate);
        const hoursAgo = Math.floor((endDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60));
        
        console.log(`${i + 1}. [${hoursAgo}h ago] ${domain}`);
        console.log(`   ${r.title}`);
        console.log(`   Score: ${r.score}`);
        if (r.text) {
          console.log(`   Preview: ${r.text.substring(0, 100)}...`);
        }
      } else {
        console.log(`${i + 1}. [NO DATE] ${domain}`);
        console.log(`   ${r.title}`);
      }
      console.log('');
    });

    console.log('Date distribution:');
    Array.from(dateAnalysis.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([date, count]) => {
        const daysAgo = Math.floor((endDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  ${date} (${daysAgo} days ago): ${count} articles`);
      });
    console.log('');

    console.log('Top domains:');
    Array.from(domainAnalysis.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([domain, count]) => {
        console.log(`  ${count}x ${domain}`);
      });
  } catch (error) {
    console.error('Error with Venture search:', error);
  }

  // Test 3: Compare with AI query (which works well)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: AI Query (for comparison)');
  console.log('='.repeat(60));

  try {
    const aiQuery = `latest AI artificial intelligence news breakthroughs announcements funding today`;
    
    console.log('Query:', aiQuery);
    console.log('');

    const aiResults = await exa.searchAndContents(aiQuery, {
      numResults: 20,
      useAutoprompt: true,
      type: 'auto',
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 500,
      },
    } as any);

    console.log(`Found ${aiResults.results.length} AI results\n`);

    // Analyze results
    const dateAnalysis = new Map<string, number>();

    aiResults.results.forEach((r) => {
      if (r.publishedDate) {
        const date = r.publishedDate.split('T')[0];
        dateAnalysis.set(date, (dateAnalysis.get(date) || 0) + 1);
      }
    });

    console.log('Date distribution:');
    Array.from(dateAnalysis.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([date, count]) => {
        const daysAgo = Math.floor((endDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`  ${date} (${daysAgo} days ago): ${count} articles`);
      });

    // Show top 5 AI results for comparison
    console.log('\nTop 5 AI results:');
    aiResults.results.slice(0, 5).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');
      const pubDate = r.publishedDate ? new Date(r.publishedDate) : null;
      const hoursAgo = pubDate ? Math.floor((endDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60)) : 'unknown';
      
      console.log(`${i + 1}. [${hoursAgo}h ago] ${domain}: ${r.title}`);
    });
  } catch (error) {
    console.error('Error with AI search:', error);
  }
}

// Run the test
testSaaSVenture().catch(console.error);