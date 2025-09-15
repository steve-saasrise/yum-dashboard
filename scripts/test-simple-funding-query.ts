import { getNewsDataService } from '../lib/services/newsdata-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testSimpleFundingQuery() {
  const newsDataService = getNewsDataService();

  console.log('Testing various funding queries...\n');

  const queries = [
    'funding',
    'Series A',
    'acquisition',
    'funding rounds',
    'venture capital',
  ];

  for (const query of queries) {
    console.log(`\nTesting query: "${query}"`);
    console.log('-'.repeat(50));

    try {
      const response = await newsDataService.fetchNewsByQuery(query, {
        size: 5,
        language: 'en',
        category: ['business'],
      });

      console.log(`Found ${response.results.length} articles`);

      if (response.results.length > 0) {
        console.log('First article:');
        const first = response.results[0];
        console.log(`  Title: ${first.title}`);
        console.log(`  Source: ${first.source_name || first.source_id}`);
      }
    } catch (error) {
      console.error(`Error: ${error}`);
    }
  }
}

testSimpleFundingQuery().catch(console.error);
