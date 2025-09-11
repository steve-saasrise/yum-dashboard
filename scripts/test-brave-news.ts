#!/usr/bin/env tsx

import { config } from 'dotenv';
import { BraveNewsService } from '@/lib/services/brave-news-service';

// Load environment variables
config({ path: '.env.local' });

async function testBraveNews() {
  console.log('🚀 Testing Brave News Service\n');
  
  const apiKey = process.env.BRAVE_API_KEY;
  
  if (!apiKey) {
    console.error('❌ BRAVE_API_KEY not found in environment variables');
    process.exit(1);
  }

  console.log('✅ API key found\n');

  try {
    const service = new BraveNewsService(apiKey);
    
    // Test single lounge
    const loungeType = process.argv[2] || 'AI';
    console.log(`📰 Generating news for ${loungeType} lounge...\n`);
    
    const startTime = Date.now();
    const result = await service.generateNewsForLounge(loungeType);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    if (result.success) {
      console.log('✅ News generation successful!');
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Articles found: ${result.articlesFound}`);
      console.log(`📝 Articles used: ${result.articlesUsed}`);
      console.log('\n--- Generated Content ---\n');
      console.log(result.content);
      console.log('\n--- End Content ---\n');
    } else {
      console.error('❌ News generation failed:');
      console.error(result.error);
    }

    // Optional: Test all lounges
    if (process.argv[3] === '--all') {
      console.log('\n📰 Testing all lounges with rate limiting...\n');
      
      const allResults = await service.generateNewsForAllLounges();
      
      console.log('\n=== Summary ===');
      allResults.forEach(r => {
        const status = r.success ? '✅' : '❌';
        const articles = r.success ? `${r.articlesFound} articles` : r.error;
        console.log(`${status} ${r.lounge}: ${articles}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testBraveNews().catch(console.error);