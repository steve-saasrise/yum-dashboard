const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

const newFeeds = [
  {
    name: 'Ars Technica',
    url: 'http://feeds.arstechnica.com/arstechnica/index',
    category: 'news',
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/index.xml',
    category: 'news',
  },
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
    category: 'news',
  },
  {
    name: 'SiliconANGLE',
    url: 'https://siliconangle.com/feed/',
    category: 'news',
  },
  {
    name: 'ZDNet',
    url: 'https://www.zdnet.com/news/rss.xml',
    category: 'news',
  },
  {
    name: 'InfoWorld',
    url: 'https://www.infoworld.com/feed/',
    category: 'news',
  },
  {
    name: 'Axios Technology',
    url: 'https://api.axios.com/feed/technology',
    category: 'news',
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'news',
  },
  {
    name: 'IEEE Spectrum',
    url: 'https://spectrum.ieee.org/feeds/feed.rss',
    category: 'news',
  },
];

async function testFeed(feed) {
  try {
    console.log(`Testing ${feed.name}...`);
    const result = await parser.parseURL(feed.url);
    const items = result.items || [];

    // Check articles in last 48 hours
    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;
    let recent = 0;

    items.forEach(item => {
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate).getTime();
        if (now - pubDate <= fortyEightHours) {
          recent++;
        }
      }
    });

    console.log(`✅ ${feed.name}: ${items.length} total, ${recent} in last 48h`);
    if (items.length > 0) {
      console.log(`   Sample: "${items[0].title}"`);
    }
    return { ...feed, working: true, count: items.length, recent };
  } catch (error) {
    console.log(`❌ ${feed.name}: ${error.message}`);
    return { ...feed, working: false, error: error.message };
  }
}

async function main() {
  console.log('Testing new RSS feeds...\n');

  const results = [];
  for (const feed of newFeeds) {
    const result = await testFeed(feed);
    results.push(result);
  }

  console.log('\n=== SUMMARY ===');
  const working = results.filter(r => r.working);
  const failed = results.filter(r => !r.working);

  console.log(`\nWorking feeds: ${working.length}/${results.length}`);
  working.forEach(f => {
    console.log(`  ✅ ${f.name}: ${f.count} articles (${f.recent} recent)`);
  });

  if (failed.length > 0) {
    console.log(`\nFailed feeds: ${failed.length}`);
    failed.forEach(f => {
      console.log(`  ❌ ${f.name}: ${f.error}`);
    });
  }

  console.log('\nRecommended feeds to add (with recent content):');
  working
    .filter(f => f.recent > 0)
    .sort((a, b) => b.recent - a.recent)
    .forEach(f => {
      console.log(`  - ${f.name}: ${f.url}`);
    });
}

main().catch(console.error);