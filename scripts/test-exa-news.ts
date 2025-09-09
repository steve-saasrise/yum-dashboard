import { ExaNewsService } from '../lib/services/exa-news-service';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testExaNews() {
  console.log('Testing Exa News Service...\n');
  
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
  
  // Test with one lounge - AI Coffee
  const testLounge = {
    name: 'AI Coffee',
    description: 'Artificial Intelligence News and Updates'
  };
  
  console.log(`Testing with lounge: ${testLounge.name}`);
  console.log(`Description: ${testLounge.description}\n`);
  
  try {
    const startTime = Date.now();
    
    const result = await exaNewsService.generateNews(
      testLounge.name,
      testLounge.description
    );
    
    const processingTime = Date.now() - startTime;
    
    console.log('✅ News generation successful!\n');
    console.log('Results:');
    console.log(`- Topic: ${result.topic}`);
    console.log(`- Processing time: ${processingTime}ms`);
    console.log(`- Regular items: ${result.items.length}`);
    console.log(`- Big story: ${result.bigStory ? 'Yes' : 'No'}`);
    console.log(`- Special section: ${result.specialSection?.length || 0} items`);
    console.log(`- Special section title: ${result.specialSectionTitle || 'N/A'}`);
    
    if (result.bigStory) {
      console.log('\n📰 Big Story:');
      console.log(`  Title: ${result.bigStory.title}`);
      console.log(`  Summary: ${result.bigStory.summary}`);
      console.log(`  Source: ${result.bigStory.source}`);
    }
    
    if (result.items.length > 0) {
      console.log('\n📋 Regular News Items:');
      result.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.text}`);
        if (item.summary) {
          console.log(`     Summary: ${item.summary}`);
        }
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
        if (item.series) {
          console.log(`     Series: ${item.series}`);
        }
        if (item.summary) {
          console.log(`     Summary: ${item.summary}`);
        }
      });
    }
    
    // Estimate cost
    const estimatedCost = 0.13; // Based on the Linear issue calculation
    console.log(`\n💵 Estimated cost: ~$${estimatedCost.toFixed(2)}`);
    console.log('   (Much cheaper than $0.18 with OpenAI web search!)\n');
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testExaNews().catch(console.error);