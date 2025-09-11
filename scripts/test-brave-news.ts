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

    if (result.success && result.content) {
      console.log('✅ News generation successful!');
      console.log(`⏱️  Duration: ${duration}s`);
      console.log(`📊 Articles found: ${result.articlesFound}`);
      console.log(`📝 Articles used: ${result.articlesUsed}`);
      
      const news = result.content;
      console.log('\n--- Big Story ---');
      if (news.bigStory) {
        console.log(`Title: ${news.bigStory.title}`);
        console.log(`Summary: ${news.bigStory.summary}`);
        console.log(`Source: ${news.bigStory.source}`);
        console.log(`URL: ${news.bigStory.sourceUrl}`);
      } else {
        console.log('No big story generated');
      }
      
      console.log('\n--- Headlines ---');
      news.items.forEach((item, i) => {
        console.log(`${i + 1}. ${item.text}`);
        if (item.summary) console.log(`   ${item.summary}`);
        if (item.source) console.log(`   Source: ${item.source}`);
        if (item.sourceUrl) console.log(`   URL: ${item.sourceUrl}`);
      });
      
      if (news.specialSection && news.specialSection.length > 0) {
        console.log(`\n--- ${news.specialSectionTitle || 'Special Section'} ---`);
        news.specialSection.forEach((item, i) => {
          console.log(`${i + 1}. ${item.text}`);
          if (item.amount) console.log(`   Amount: ${item.amount}`);
          if (item.series) console.log(`   Series: ${item.series}`);
          if (item.summary) console.log(`   ${item.summary}`);
          if (item.source) console.log(`   Source: ${item.source}`);
          if (item.sourceUrl) console.log(`   URL: ${item.sourceUrl}`);
        });
      }
      
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
      allResults.forEach((r) => {
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
