const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

// SaaS-focused news feeds to test
const saasFeeds = [
  {
    name: 'SaaStr Blog',
    url: 'https://www.saastr.com/feed/',
    category: 'saas',
    priority: 1,
  },
  {
    name: 'ChartMogul Blog',
    url: 'https://blog.chartmogul.com/feed/',
    category: 'saas',
    priority: 2,
  },
  {
    name: 'Baremetrics Blog',
    url: 'https://baremetrics.com/blog/feed',
    category: 'saas',
    priority: 2,
  },
  {
    name: 'Product Hunt Daily',
    url: 'https://www.producthunt.com/feed',
    category: 'products',
    priority: 2,
  },
  {
    name: 'BetaList',
    url: 'https://betalist.com/feed',
    category: 'startups',
    priority: 3,
  },
  {
    name: 'IndieHackers',
    url: 'https://www.indiehackers.com/feed.xml',
    category: 'startups',
    priority: 3,
  },
  {
    name: 'SaaS Mag',
    url: 'https://saasmag.io/feed/',
    category: 'saas',
    priority: 2,
  },
  {
    name: 'First Round Review',
    url: 'https://review.firstround.com/feed',
    category: 'startups',
    priority: 2,
  },
  {
    name: 'Tomasz Tunguz',
    url: 'http://tomtunguz.com/index.xml',
    category: 'saas',
    priority: 2,
  },
  {
    name: 'Jason Lemkin (SaaStr)',
    url: 'https://www.saastr.com/author/jason/feed/',
    category: 'saas',
    priority: 1,
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
    let lastWeek = 0;

    items.forEach(item => {
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate).getTime();
        const age = now - pubDate;
        if (age <= twentyFourHours) last24h++;
        if (age <= fortyEightHours) last48h++;
        if (age <= 7 * twentyFourHours) lastWeek++;
      }
    });

    console.log(`✅ ${feed.name}: ${items.length} articles`);
    console.log(`   Recent: ${last24h} (24h), ${last48h} (48h), ${lastWeek} (week)`);
    if (items.length > 0) {
      console.log(`   Latest: "${items[0].title}"`);
    }
    return {
      ...feed,
      working: true,
      total: items.length,
      last24h,
      last48h,
      lastWeek
    };
  } catch (error) {
    console.log(`❌ ${feed.name}: ${error.message}`);
    return { ...feed, working: false, error: error.message };
  }
}

async function main() {
  console.log('Testing SaaS-focused RSS feeds...\n');

  const results = [];
  for (const feed of saasFeeds) {
    const result = await testFeed(feed);
    results.push(result);
    console.log();
  }

  console.log('=== SUMMARY ===\n');

  const working = results.filter(r => r.working);
  const withDaily = working.filter(r => r.last24h > 0);
  const withWeekly = working.filter(r => r.lastWeek > 0);

  console.log(`Working feeds: ${working.length}/${results.length}`);
  console.log(`Feeds with daily content: ${withDaily.length}`);
  console.log(`Feeds with weekly content: ${withWeekly.length}`);

  console.log('\n✅ Best SaaS feeds (working + recent content):');
  working
    .filter(f => f.lastWeek > 0)
    .sort((a, b) => b.lastWeek - a.lastWeek)
    .forEach(f => {
      const frequency = f.last24h > 0 ? 'daily' : f.last48h > 0 ? '2-3 days' : 'weekly';
      console.log(`  - ${f.name}: ${f.total} articles (updates ${frequency})`);
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