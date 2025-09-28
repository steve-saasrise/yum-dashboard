const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

async function testFeed(url, name) {
  try {
    console.log(`Testing ${name}...`);
    const feed = await parser.parseURL(url);
    const items = feed.items || [];

    const now = Date.now();
    const fortyEightHours = 48 * 60 * 60 * 1000;

    let recent = 0;
    items.forEach((item) => {
      if (item.pubDate) {
        const pubDate = new Date(item.pubDate).getTime();
        if (now - pubDate <= fortyEightHours) {
          recent++;
        }
      }
    });

    console.log(`✅ ${name}: ${items.length} articles, ${recent} in last 48h`);
    if (items.length > 0) {
      console.log(`   Latest: "${items[0].title}"`);
      console.log(`   Date: ${items[0].pubDate}`);
    }
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing SaaStock and potential AInvest feeds...\n');

  // Test SaaStock blog feed
  await testFeed('https://www.saastock.com/blog/feed/', 'SaaStock Blog');

  // Try common RSS feed patterns for ainvest.com
  console.log('\nTrying potential ainvest.com feeds:');
  await testFeed('https://www.ainvest.com/feed/', 'AInvest (standard)');
  await testFeed('https://www.ainvest.com/rss/', 'AInvest (rss)');
  await testFeed('https://www.ainvest.com/blog/feed/', 'AInvest Blog');
  await testFeed('https://www.ainvest.com/news/feed/', 'AInvest News');
}

main().catch(console.error);
