#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { GPT5NewsService } from '../lib/services/gpt5-news-service';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testGPT5NewsIntegration() {
  console.log('=========================================');
  console.log(`Testing GPT-5 News Generation`);
  console.log('=========================================\n');

  // Check for required environment variables
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY is not set in .env.local');
    process.exit(1);
  }

  try {
    // Initialize GPT-5 service
    console.log('🤖 Initializing GPT-5 news service...');
    const gpt5Service = new GPT5NewsService(process.env.OPENAI_API_KEY);

    // Focus on SaaS lounge
    const loungeType = 'saas';

    console.log(
      `\n📰 Generating ${loungeType.toUpperCase()} news digest with GPT-5...`
    );
    const startTime = Date.now();

    const curatedNews = await gpt5Service.generateNews({
      loungeType,
      maxBullets: 5,
      maxSpecialSection: 5,
    });

    const generationTime = Date.now() - startTime;
    console.log(`✅ News generation completed in ${generationTime}ms`);

    // Display curated results
    console.log('\n=========================================');
    console.log('📊 GENERATED NEWS DIGEST');
    console.log('=========================================');

    // Big Story
    if (curatedNews.bigStory) {
      console.log('\n🎯 BIG STORY:');
      console.log(`Title: ${curatedNews.bigStory.title}`);
      console.log(`Summary: ${curatedNews.bigStory.summary}`);
      console.log(`Source: ${curatedNews.bigStory.source || 'Unknown'}`);
      console.log(`URL: ${curatedNews.bigStory.sourceUrl || 'N/A'}`);
    }

    // Bullet Points
    console.log('\n📍 NEWS BULLETS:');
    curatedNews.items.forEach((item, index) => {
      console.log(`\n${index + 1}. ${item.text}`);
      if (item.summary) {
        console.log(`   ${item.summary}`);
      }
      console.log(`   Source: ${item.source || 'Unknown'}`);
      console.log(`   URL: ${item.sourceUrl || 'N/A'}`);
    });

    // Special Section
    if (curatedNews.specialSection && curatedNews.specialSection.length > 0) {
      console.log(
        `\n💼 ${curatedNews.specialSectionTitle || 'SPECIAL SECTION'}:`
      );
      curatedNews.specialSection.forEach((item, index) => {
        console.log(`\n${index + 1}. ${item.text}`);
        if (item.amount) {
          console.log(`   Amount: ${item.amount}`);
        }
        if (item.series) {
          console.log(`   Series: ${item.series}`);
        }
        if (item.summary) {
          console.log(`   ${item.summary}`);
        }
        console.log(`   Source: ${item.source || 'Unknown'}`);
        console.log(`   URL: ${item.sourceUrl || 'N/A'}`);
      });
    }

    // Summary statistics
    console.log('\n=========================================');
    console.log('📈 STATISTICS');
    console.log('=========================================');
    console.log(`Articles in digest: ${curatedNews.items.length}`);
    console.log(
      `Special section items: ${curatedNews.specialSection?.length || 0}`
    );
    console.log(`Generation time: ${generationTime}ms`);
    console.log(`Topic: ${curatedNews.topic}`);
    console.log(`Generated at: ${curatedNews.generatedAt}`);

    console.log('\n✅ Test completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);

    if (
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      console.log('\n⚠️  This appears to be an authentication error.');
      console.log(
        'Please check that your OPENAI_API_KEY is correct in .env.local'
      );
    } else if (
      error.message.includes('429') ||
      error.message.includes('rate limit')
    ) {
      console.log(
        '\n⚠️  Rate limit exceeded. Please wait a moment and try again.'
      );
    }

    process.exit(1);
  }
}

// Run the test
testGPT5NewsIntegration().catch(console.error);
