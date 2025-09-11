import Exa from 'exa-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testNewsArticleCategory() {
  console.log('Testing category: "news_article" vs "news" for Exa...\n');

  if (!process.env.EXA_API_KEY) {
    console.error('❌ EXA_API_KEY not found');
    process.exit(1);
  }

  const exa = new Exa(process.env.EXA_API_KEY);

  // Calculate date for last 24 hours
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
  const formatDate = (date: Date) => date.toISOString().split('T')[0];

  console.log('Date range:', formatDate(startDate), 'to', formatDate(endDate));
  console.log('\n');

  // Test 1: SaaS with category: 'news'
  console.log('='.repeat(60));
  console.log('TEST 1: SaaS with category: "news"');
  console.log('='.repeat(60));

  try {
    const saasQuery = `(site:techcrunch.com OR site:venturebeat.com OR site:theinformation.com OR site:sifted.eu OR site:forbes.com) SaaS "raises" "funding" "Series A" "Series B" "Series C" "acquisition" "IPO"`;

    console.log('Query:', saasQuery);
    console.log('Category: news\n');

    const newsResults = await exa.searchAndContents(saasQuery, {
      numResults: 10,
      useAutoprompt: false, // Don't modify site: queries
      type: 'keyword', // Use keyword for site: operators
      category: 'news',
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 200,
      },
    } as any);

    console.log(
      `Found ${newsResults.results.length} results with category: "news"\n`
    );

    newsResults.results.forEach((r, i) => {
      const url = new URL(r.url);
      const pathname = url.pathname;

      // Check if it's a category page
      const isCategory =
        pathname.includes('/category/') ||
        pathname.includes('/section/') ||
        pathname.includes('/topic/') ||
        pathname.split('/').filter((s) => s).length <= 1;

      console.log(
        `${i + 1}. ${isCategory ? '❌ CATEGORY' : '✅ ARTICLE'}: ${url.hostname}${pathname}`
      );
      console.log(`   Title: ${r.title}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 2: SaaS with category: 'news_article'
  console.log('\n' + '='.repeat(60));
  console.log('TEST 2: SaaS with category: "news_article"');
  console.log('='.repeat(60));

  try {
    const saasQuery = `(site:techcrunch.com OR site:venturebeat.com OR site:theinformation.com OR site:sifted.eu OR site:forbes.com) SaaS "raises" "funding" "Series A" "Series B" "Series C" "acquisition" "IPO"`;

    console.log('Query:', saasQuery);
    console.log('Category: news_article\n');

    const articleResults = await exa.searchAndContents(saasQuery, {
      numResults: 10,
      useAutoprompt: false,
      type: 'keyword',
      category: 'news_article' as any, // Try news_article category
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 200,
      },
    } as any);

    console.log(
      `Found ${articleResults.results.length} results with category: "news_article"\n`
    );

    articleResults.results.forEach((r, i) => {
      const url = new URL(r.url);
      const pathname = url.pathname;

      // Check if it's a category page
      const isCategory =
        pathname.includes('/category/') ||
        pathname.includes('/section/') ||
        pathname.includes('/topic/') ||
        pathname.split('/').filter((s) => s).length <= 1;

      console.log(
        `${i + 1}. ${isCategory ? '❌ CATEGORY' : '✅ ARTICLE'}: ${url.hostname}${pathname}`
      );
      console.log(`   Title: ${r.title}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  }

  // Test 3: AI topic for comparison (which works well)
  console.log('\n' + '='.repeat(60));
  console.log('TEST 3: AI with category: "news_article"');
  console.log('='.repeat(60));

  try {
    const aiQuery = `latest AI artificial intelligence news breakthroughs announcements funding today`;

    console.log('Query:', aiQuery);
    console.log('Category: news_article\n');

    const aiResults = await exa.searchAndContents(aiQuery, {
      numResults: 10,
      useAutoprompt: true,
      type: 'auto',
      category: 'news_article' as any,
      startPublishedDate: formatDate(startDate),
      endPublishedDate: formatDate(endDate),
      livecrawl: 'preferred' as any,
      text: {
        maxCharacters: 200,
      },
    } as any);

    console.log(
      `Found ${aiResults.results.length} AI results with category: "news_article"\n`
    );

    aiResults.results.forEach((r, i) => {
      const url = new URL(r.url);
      const pathname = url.pathname;

      // Check if it's a category page
      const isCategory =
        pathname.includes('/category/') ||
        pathname.includes('/section/') ||
        pathname.includes('/topic/') ||
        pathname.split('/').filter((s) => s).length <= 1;

      console.log(
        `${i + 1}. ${isCategory ? '❌ CATEGORY' : '✅ ARTICLE'}: ${url.hostname}${pathname}`
      );
      console.log(`   Title: ${r.title}`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testNewsArticleCategory().catch(console.error);
