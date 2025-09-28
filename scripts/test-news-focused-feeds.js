const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

// More news-focused feeds to test
const newsFeeds = [
  // Keep the good ones
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'mixed',
    priority: 1,
  },
  {
    name: 'TechCrunch Funding',
    url: 'https://techcrunch.com/category/venture/feed/',
    category: 'funding',
    priority: 1,
  },
  {
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    category: 'funding',
    priority: 1,
  },
  // Reuters feeds
  {
    name: 'Reuters Technology',
    url: 'https://www.reutersagency.com/feed/?best-topics=tech&post_type=best',
    category: 'news',
    priority: 1,
  },
  {
    name: 'Reuters Tech News',
    url: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best',
    category: 'news',
    priority: 1,
  },
  // Other news sources
  {
    name: 'CNBC Technology',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19854910',
    category: 'news',
    priority: 1,
  },
  {
    name: 'BBC Technology',
    url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
    category: 'news',
    priority: 1,
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
    category: 'news',
    priority: 2,
  },
  {
    name: 'SiliconANGLE',
    url: 'https://siliconangle.com/feed/',
    category: 'news',
    priority: 1,
  },
  {
    name: 'AngelList Venture',
    url: 'https://www.angellist.com/blog/feed',
    category: 'funding',
    priority: 2,
  },
  {
    name: 'Sifted (EU Tech)',
    url: 'https://sifted.eu/feed/',
    category: 'news',
    priority: 2,
  },
  {
    name: 'Protocol',
    url: 'https://www.protocol.com/feeds/feed.rss',
    category: 'news',
    priority: 2,
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

    items.forEach(item => {
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate).getTime();
        const age = now - pubDate;
        if (age <= twentyFourHours) last24h++;
        if (age <= fortyEightHours) last48h++;
      }
    });

    // Check if titles look like news (not guides/reviews)
    const newsKeywords = ['announces', 'launches', 'raises', 'acquires', 'reports', 'files', 'partners'];
    const opinionKeywords = ['how to', 'guide', 'review', 'best', 'top 10', 'why you'];

    let newsCount = 0;
    let opinionCount = 0;

    items.slice(0, 5).forEach(item => {
      const title = (item.title || '').toLowerCase();
      if (newsKeywords.some(keyword => title.includes(keyword))) newsCount++;
      if (opinionKeywords.some(keyword => title.includes(keyword))) opinionCount++;
    });

    console.log(`✅ ${feed.name}: ${items.length} total, ${last24h} in 24h, ${last48h} in 48h`);
    console.log(`   Content: ${newsCount} news-like, ${opinionCount} opinion-like in first 5`);
    if (items.length > 0) {
      console.log(`   Sample: "${items[0].title}"`);
    }
    return { ...feed, working: true, total: items.length, last24h, last48h, newsCount, opinionCount };
  } catch (error) {
    console.log(`❌ ${feed.name}: ${error.message}`);
    return { ...feed, working: false, error: error.message };
  }
}

async function main() {
  console.log('Testing news-focused RSS feeds...\n');

  const results = [];
  for (const feed of newsFeeds) {
    const result = await testFeed(feed);
    results.push(result);
    console.log();
  }

  console.log('=== SUMMARY ===\n');

  const working = results.filter(r => r.working);
  const withRecent = working.filter(r => r.last24h > 0);
  const newsOriented = working.filter(r => r.newsCount >= r.opinionCount);

  console.log(`Working feeds: ${working.length}/${results.length}`);
  console.log(`Feeds with 24h content: ${withRecent.length}`);
  console.log(`News-oriented feeds: ${newsOriented.length}`);

  console.log('\n✅ Best news feeds (working + recent content):');
  working
    .filter(f => f.last24h > 0 || f.last48h > 5)
    .sort((a, b) => b.last24h - a.last24h)
    .forEach(f => {
      console.log(`  - ${f.name}: ${f.total} articles (${f.last24h} in 24h)`);
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