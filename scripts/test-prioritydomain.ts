import { config } from 'dotenv';
import { resolve } from 'path';
import { getNewsDataService } from '../lib/services/newsdata-service';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

async function testPriorityDomain() {
  console.log('\nTesting NewsData.io with prioritydomain=top');
  console.log('============================================\n');

  const service = getNewsDataService();

  const loungeTypes = ['ai', 'saas', 'venture'];

  for (const loungeType of loungeTypes) {
    console.log(`\n📰 Testing ${loungeType.toUpperCase()} lounge:`);
    console.log('-'.repeat(40));

    try {
      const response = await service.fetchLatestNews(loungeType, { size: 5 });

      console.log(`✅ Fetched ${response.results.length} articles\n`);

      response.results.forEach((article, i) => {
        const sourceName =
          article.source_name || article.source_id || 'Unknown';
        const priority = article.source_priority;

        console.log(`${i + 1}. ${sourceName}`);
        if (priority !== undefined) {
          console.log(
            `   Priority Score: ${priority} (lower = more authoritative)`
          );
        }
        console.log(`   Title: ${article.title?.substring(0, 70)}...`);
      });
    } catch (error) {
      console.error(`❌ Error fetching ${loungeType}: ${error}`);
    }
  }

  console.log(
    '\n✨ All articles should be from top 10% most authoritative sources'
  );
}

testPriorityDomain().catch(console.error);
