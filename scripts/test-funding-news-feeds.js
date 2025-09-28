const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

// Pure news-focused feeds (no blogs/opinion)
const newsFeeds = [
  // Keep existing good ones
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'mixed',
  },
  {
    name: 'TechCrunch Funding',
    url: 'https://techcrunch.com/category/venture/feed/',
    category: 'funding',
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    category: 'funding',
  },
  // New funding-focused feeds
  {
    name: 'VCNewsDaily',
    url: 'https://vcnewsdaily.com/feed/',
    category: 'funding',
  },
  {
    name: 'AlleyWatch',
    url: 'https://www.alleywatch.com/feed/',
    category: 'funding',
  },
  {
    name: 'PitchBook News',
    url: 'https://pitchbook.com/news/feed',
    category: 'funding',
  },
  {
    name: 'VentureBeat',
    url: 'https://feeds.feedburner.com/venturebeat/SZYF',
    category: 'news',
  },
  {
    name: 'TechStartups',
    url: 'https://techstartups.com/feed/',
    category: 'funding',
  },
  {
    name: 'StartupTalky',
    url: 'https://startuptalky.com/feed/',
    category: 'funding',
  },
  // Keep tech news sources
  {
    name: 'SiliconANGLE',
    url: 'https://siliconangle.com/feed/',
    category: 'news',
  },
  {
    name: 'CNBC Technology',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',
    category: 'news',
  },
];

async function testFeed(feed) {
  try {
    console.log(`Testing ${feed.name}...`);
    const result = await parser.parseURL(feed.url);
    const items = result.items || [];

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const fortyEightHours = 48 * 60 * 60 * 1000;

    let last24h = 0;
    let last48h = 0;

    // Check if titles look like news
    const newsKeywords = ['raises', 'secures', 'funding', 'series', 'acquires', 'launches', 'announces', 'reports', 'closes', 'receives'];
    let newsCount = 0;

    items.forEach((item, index) => {
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate).getTime();
        const age = now - pubDate;
        if (age <= twentyFourHours) last24h++;
        if (age <= fortyEightHours) last48h++;
      }

      if (index < 5) {
        const titleLower = (item.title || '').toLowerCase();
        if (newsKeywords.some(keyword => titleLower.includes(keyword))) {
          newsCount++;
        }
      }
    });

    const newsPercentage = items.length > 0 ? Math.round((newsCount / Math.min(5, items.length)) * 100) : 0;

    console.log(`✅ ${feed.name}: ${items.length} articles`);
    console.log(`   Recent: ${last24h} (24h), ${last48h} (48h)`);
    console.log(`   News content: ${newsPercentage}% of first 5 articles look like news`);
    if (items.length > 0) {
      console.log(`   Latest: "${items[0].title}"`);
    }

    return {
      ...feed,
      working: true,
      total: items.length,
      last24h,
      last48h,
      newsPercentage
    };
  } catch (error) {
    console.log(`❌ ${feed.name}: ${error.message}`);
    return { ...feed, working: false, error: error.message };
  }
}

async function main() {
  console.log('Testing news-focused RSS feeds (no blogs/opinion)...\n');

  const results = [];
  for (const feed of newsFeeds) {
    const result = await testFeed(feed);
    results.push(result);
    console.log();
  }

  console.log('=== SUMMARY ===\n');

  const working = results.filter(r => r.working);
  const withDaily = working.filter(r => r.last24h > 0);
  const actualNews = working.filter(r => r.newsPercentage >= 60);

  console.log(`Working feeds: ${working.length}/${results.length}`);
  console.log(`Feeds with daily updates: ${withDaily.length}`);
  console.log(`Feeds with mostly news content: ${actualNews.length}`);

  console.log('\n✅ Best NEWS feeds (working + recent + actual news):');
  working
    .filter(f => f.last24h > 0 || f.last48h > 0)
    .sort((a, b) => b.newsPercentage - a.newsPercentage)
    .forEach(f => {
      console.log(`  - ${f.name}: ${f.total} articles, ${f.newsPercentage}% news content`);
    });

  const failed = results.filter(r => !r.working);
  if (failed.length > 0) {
    console.log('\n❌ Failed feeds:');
    failed.forEach(f => {
      console.log(`  - ${f.name}: ${f.error}`);
    });
  }
}

main().catch(console.error);