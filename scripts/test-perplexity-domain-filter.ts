import { getPerplexityNewsService } from '../lib/services/perplexity-news-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testDomainFilter() {
  console.log('Testing Perplexity domain filter for SaaS lounge...\n');

  const service = getPerplexityNewsService();

  // Test with SaaS lounge
  const result = await service.generateNewsForLounge('SaaS');

  console.log('Result:', {
    success: result.success,
    articlesFound: result.articlesFound,
    articlesUsed: result.articlesUsed,
    error: result.error,
  });

  if (result.success && result.content) {
    console.log('\nBig Story:');
    if (result.content.bigStory) {
      console.log('- Title:', result.content.bigStory.title);
      console.log('- Source:', result.content.bigStory.source);
      console.log('- URL:', result.content.bigStory.sourceUrl);
    }

    console.log('\nBullets (first 3):');
    result.content.items.slice(0, 3).forEach((item, i) => {
      console.log(`${i + 1}. ${item.text}`);
      console.log(`   Source: ${item.source} - ${item.sourceUrl}`);
    });

    if (result.content.specialSection) {
      console.log('\nSpecial Section (first 2):');
      result.content.specialSection.slice(0, 2).forEach((item, i) => {
        console.log(`${i + 1}. ${item.text}`);
        console.log(`   Source: ${item.source} - ${item.sourceUrl}`);
      });
    }
  }
}

testDomainFilter().catch(console.error);
