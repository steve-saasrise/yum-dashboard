#!/usr/bin/env tsx
import dotenv from 'dotenv';
import path from 'path';
import { NewsDataService } from '../lib/services/newsdata-service';
import { GPTNewsCurator } from '../lib/services/gpt-news-curator';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNewsDataIntegration() {
  const loungeType = process.argv[2] || 'ai';

  console.log('=========================================');
  console.log(`Testing NewsData.io + GPT-5-mini Integration`);
  console.log(`Lounge Type: ${loungeType}`);
  console.log('=========================================\n');

  // Check for required environment variables
  if (!process.env.NEWSDATA_API_KEY) {
    console.error('❌ Error: NEWSDATA_API_KEY is not set in .env.local');
    console.log('\nPlease add your NewsData.io API key to .env.local:');
    console.log('NEWSDATA_API_KEY=your_api_key_here');
    process.exit(1);
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY is not set in .env.local');
    process.exit(1);
  }

  try {
    // Initialize services
    console.log('📡 Initializing NewsData service...');
    const newsDataService = new NewsDataService({
      apiKey: process.env.NEWSDATA_API_KEY,
    });

    console.log('🤖 Initializing GPT curator...');
    const gptCurator = new GPTNewsCurator(
      process.env.OPENAI_API_KEY,
      'gpt-4o-mini'
    );

    // Fetch news from NewsData.io
    console.log(`\n📰 Fetching news from NewsData.io for ${loungeType}...`);
    const startFetch = Date.now();

    const newsResponse = await newsDataService.fetchLatestNews(loungeType, {
      size: 10, // Free tier limit is 10
      language: 'en',
      // country: 'us,gb', // Optional - might limit results
      // timeframe: 48, // Requires paid plan
    });

    const fetchTime = Date.now() - startFetch;
    console.log(
      `✅ Fetched ${newsResponse.results.length} articles in ${fetchTime}ms`
    );

    if (newsResponse.results.length === 0) {
      console.log(
        '❌ No articles found. Try a different lounge type or check your API key.'
      );
      process.exit(1);
    }

    // Display sample of raw articles
    console.log('\n📋 Sample of raw articles:');
    newsResponse.results.slice(0, 3).forEach((article, index) => {
      console.log(`\n${index + 1}. ${article.title}`);
      console.log(
        `   Source: ${article.source_name || article.source_id || 'Unknown'}`
      );
      console.log(`   URL: ${article.link}`);
      if (article.description) {
        console.log(
          `   Description: ${article.description.substring(0, 100)}...`
        );
      }
    });

    // Curate news with GPT-4o-mini
    console.log(`\n🎯 Curating news with GPT-4o-mini...`);
    const startCuration = Date.now();

    const curatedNews = await gptCurator.curateNewsFromNewsData(newsResponse, {
      loungeType,
      maxBullets: 5,
      maxSpecialSection: 3,
      includeImages: true,
    });

    const curationTime = Date.now() - startCuration;
    console.log(`✅ Curation completed in ${curationTime}ms`);

    // Display curated results
    console.log('\n=========================================');
    console.log('📊 CURATED NEWS DIGEST');
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
    console.log(`Total articles fetched: ${newsResponse.results.length}`);
    console.log(`Articles in digest: ${curatedNews.items.length}`);
    console.log(
      `Special section items: ${curatedNews.specialSection?.length || 0}`
    );
    console.log(`Fetch time: ${fetchTime}ms`);
    console.log(`Curation time: ${curationTime}ms`);
    console.log(`Total time: ${fetchTime + curationTime}ms`);
    console.log(`Topic: ${curatedNews.topic}`);
    console.log(`Generated at: ${curatedNews.generatedAt}`);

    console.log('\n✅ Test completed successfully!');

    // Compare with Perplexity if requested
    if (process.argv[3] === '--compare') {
      console.log('\n=========================================');
      console.log('📊 COMPARISON WITH PERPLEXITY');
      console.log('=========================================');

      try {
        const { getPerplexityNewsService } = await import(
          '../lib/services/perplexity-news-service'
        );
        const perplexityService = getPerplexityNewsService();

        console.log('\n📰 Fetching from Perplexity for comparison...');
        const perplexityStart = Date.now();
        const perplexityResult =
          await perplexityService.generateNewsForLounge(loungeType);
        const perplexityTime = Date.now() - perplexityStart;

        if (perplexityResult.success && perplexityResult.content) {
          console.log(`\n✅ Perplexity fetch completed in ${perplexityTime}ms`);
          console.log(`Articles found: ${perplexityResult.articlesFound}`);
          console.log(`Articles used: ${perplexityResult.articlesUsed}`);

          console.log('\n📊 Comparison:');
          console.log(`NewsData+GPT time: ${fetchTime + curationTime}ms`);
          console.log(`Perplexity time: ${perplexityTime}ms`);
          console.log(
            `Time difference: ${perplexityTime - (fetchTime + curationTime)}ms`
          );

          console.log(
            `\nNewsData+GPT items: ${curatedNews.items.length} bullets, ${curatedNews.specialSection?.length || 0} special`
          );
          console.log(
            `Perplexity items: ${perplexityResult.content.items.length} bullets, ${perplexityResult.content.specialSection?.length || 0} special`
          );
        } else {
          console.log('❌ Perplexity fetch failed:', perplexityResult.error);
        }
      } catch (error) {
        console.log('❌ Could not compare with Perplexity:', error);
      }
    }
  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);

    if (
      error.message.includes('401') ||
      error.message.includes('Unauthorized')
    ) {
      console.log('\n⚠️  This appears to be an authentication error.');
      console.log('Please check that your API keys are correct in .env.local');
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

// Display usage instructions
if (process.argv.length < 3 || process.argv[2] === '--help') {
  console.log('Usage: npm run test:newsdata [lounge_type] [--compare]');
  console.log('\nLounge types: ai, saas, venture, growth, crypto');
  console.log('\nOptions:');
  console.log('  --compare    Also fetch from Perplexity for comparison');
  console.log('\nExamples:');
  console.log('  npm run test:newsdata ai');
  console.log('  npm run test:newsdata saas --compare');
  console.log('  npm run test:newsdata venture');
  process.exit(0);
}

// Run the test
testNewsDataIntegration().catch(console.error);
