import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNewQueries() {
  console.log('Testing IMPROVED Exa queries for SaaS and Venture...\n');

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

  // Test 1: NEW SaaS query
  console.log('='.repeat(60));
  console.log('TEST 1: IMPROVED SaaS Query');
  console.log('='.repeat(60));

  try {
    const saasQuery = `TechCrunch VentureBeat SaaS startup "Series A" "Series B" "Series C" funding round million billion Salesforce HubSpot Datadog Snowflake Stripe acquisition IPO news`;

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
      excludeDomains: [
        'eventbrite.com',
        'summit.thehouse.fund',
        'iqpc.com',
        'coriniumintelligence.com',
        'managedservicessummit.com',
        'bvca.co.uk',
        'analytica-world.com',
      ] as any,
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
        const hoursAgo = Math.floor(
          (endDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60)
        );

        console.log(`${i + 1}. [${hoursAgo}h ago] ${domain}`);
        console.log(`   ${r.title}`);
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
        const daysAgo = Math.floor(
          (endDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
        );
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

  // Test 2: NEW Venture query
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: IMPROVED Venture Capital Query');
  console.log('='.repeat(60));

  try {
    const ventureQuery = `TechCrunch Pitchbook "raises $" "secures funding" "Series A" "Series B" "Series C" "Series D" million billion venture capital Sequoia Andreessen Y Combinator IPO acquisition`;

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
      excludeDomains: [
        'eventbrite.com',
        'summit.thehouse.fund',
        'iqpc.com',
        'coriniumintelligence.com',
        'managedservicessummit.com',
        'bvca.co.uk',
        'analytica-world.com',
      ] as any,
    } as any);

    console.log(`Found ${ventureResults.results.length} Venture results\n`);

    // Show top 10 results
    ventureResults.results.slice(0, 10).forEach((r, i) => {
      const domain = new URL(r.url).hostname.replace('www.', '');

      if (r.publishedDate) {
        const pubDate = new Date(r.publishedDate);
        const hoursAgo = Math.floor(
          (endDate.getTime() - pubDate.getTime()) / (1000 * 60 * 60)
        );

        console.log(`${i + 1}. [${hoursAgo}h ago] ${domain}`);
        console.log(`   ${r.title}`);
        if (r.text) {
          // Check if it mentions funding amounts
          const fundingMatch = r.text.match(
            /\$[\d.]+[MBK]|\$[\d,]+|million|billion/i
          );
          if (fundingMatch) {
            console.log(`   💰 Funding mention: ${fundingMatch[0]}`);
          }
          console.log(`   Preview: ${r.text.substring(0, 100)}...`);
        }
      } else {
        console.log(`${i + 1}. [NO DATE] ${domain}`);
        console.log(`   ${r.title}`);
      }
      console.log('');
    });

    // Date analysis
    const dateAnalysis = new Map<string, number>();
    ventureResults.results.forEach((r) => {
      if (r.publishedDate) {
        const date = r.publishedDate.split('T')[0];
        dateAnalysis.set(date, (dateAnalysis.get(date) || 0) + 1);
      }
    });

    console.log('Date distribution:');
    Array.from(dateAnalysis.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .forEach(([date, count]) => {
        const daysAgo = Math.floor(
          (endDate.getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
        );
        console.log(`  ${date} (${daysAgo} days ago): ${count} articles`);
      });
  } catch (error) {
    console.error('Error with Venture search:', error);
  }
}

// Run the test
testNewQueries().catch(console.error);
