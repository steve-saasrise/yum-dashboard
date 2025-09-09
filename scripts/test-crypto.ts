import { ExaNewsService } from '../lib/services/exa-news-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testCrypto() {
  console.log('Testing Crypto Coffee news generation...\n');

  if (!process.env.EXA_API_KEY || !process.env.OPENAI_API_KEY) {
    console.error('❌ Missing API keys');
    process.exit(1);
  }

  const exaNewsService = new ExaNewsService();

  const lounge = {
    name: 'Crypto Coffee',
    description: 'Cryptocurrency and blockchain news',
  };

  console.log(`Testing: ${lounge.name}`);
  console.log(`Description: ${lounge.description}\n`);

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
    console.log(`- Special section: ${result.specialSection?.length || 0} items`);

    if (result.bigStory) {
      console.log(`\n📰 Big Story: ${result.bigStory.title}`);
      console.log(`   Summary: ${result.bigStory.summary}`);
    }

    if (result.items.length > 0) {
      console.log('\n📋 News items:');
      result.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.text}`);
        if (item.source) {
          console.log(`     Source: ${item.source}`);
        }
      });
    }

    if (result.specialSection && result.specialSection.length > 0) {
      console.log(`\n💰 ${result.specialSectionTitle}:`);
      result.specialSection.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.text}`);
        if (item.amount) {
          console.log(`     Amount: ${item.amount}`);
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testCrypto().catch(console.error);