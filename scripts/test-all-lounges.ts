import { ExaNewsService } from '../lib/services/exa-news-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testAllLounges() {
  console.log('Testing Exa News Service with all lounge types...\n');

  // Check for required environment variables
  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found in .env.local');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not found in .env.local');
    process.exit(1);
  }

  console.log('✅ API keys found\n');

  const exaNewsService = new ExaNewsService();

  // Test lounges for different topics
  const testLounges = [
    {
      name: 'AI Coffee',
      description: 'Artificial Intelligence News and Updates',
    },
    {
      name: 'SaaS Coffee',
      description: 'Software as a Service discussions and insights',
    },
    {
      name: 'Crypto Coffee',
      description: 'Cryptocurrency and blockchain news',
    },
    {
      name: 'Growth Coffee',
      description: 'B2B growth strategies and marketing',
    },
    {
      name: 'Venture Coffee',
      description: 'Venture capital and startup funding',
    },
  ];

  for (const lounge of testLounges) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Testing: ${lounge.name}`);
    console.log(`Description: ${lounge.description}`);
    console.log('='.repeat(60));

    try {
      const startTime = Date.now();

      const result = await exaNewsService.generateNews(
        lounge.name,
        lounge.description
      );

      const processingTime = Date.now() - startTime;

      console.log('✅ News generation successful!');
      console.log(`- Processing time: ${processingTime}ms`);
      console.log(`- Regular items: ${result.items.length}`);
      console.log(`- Big story: ${result.bigStory ? 'Yes' : 'No'}`);
      console.log(
        `- Special section: ${result.specialSection?.length || 0} items`
      );

      if (result.bigStory) {
        console.log(`\n📰 Big Story: ${result.bigStory.title}`);
      }

      if (result.items.length > 0) {
        console.log('\n📋 Sample news items:');
        result.items.slice(0, 2).forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.text}`);
        });
      } else {
        console.log('⚠️  No news items generated');
      }

      if (result.specialSection && result.specialSection.length > 0) {
        console.log(`\n💰 ${result.specialSectionTitle}:`);
        result.specialSection.slice(0, 2).forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.text}`);
        });
      }
    } catch (error: any) {
      console.error('❌ Test failed:', error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ All lounge tests completed!');
  console.log('='.repeat(60));
}

// Run the test
testAllLounges().catch(console.error);
