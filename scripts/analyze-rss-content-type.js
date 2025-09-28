const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'DailyNews/1.0 (SaaS News Aggregator)',
  },
});

// Words that typically indicate opinion/blog content
const opinionIndicators = [
  'opinion', 'editorial', 'column', 'commentary', 'analysis',
  'review', 'hands-on', 'first look', 'i tried', 'i tested',
  'my experience', 'why i', 'why you should', 'how to',
  'guide', 'tutorial', 'tips', 'best', 'worst', 'top 10',
  'versus', 'vs', 'compared', 'thoughts on', 'take on'
];

// Words that typically indicate news
const newsIndicators = [
  'announces', 'launches', 'raises', 'acquires', 'reports',
  'reveals', 'confirms', 'denies', 'says', 'according to',
  'files', 'sues', 'settles', 'partners', 'expands',
  'cuts', 'lays off', 'hires', 'appoints', 'ipo',
  'earnings', 'revenue', 'funding', 'valuation', 'deal'
];

function categorizeArticle(title, description = '') {
  const combined = `${title} ${description}`.toLowerCase();

  const opinionScore = opinionIndicators.filter(word =>
    combined.includes(word)
  ).length;

  const newsScore = newsIndicators.filter(word =>
    combined.includes(word)
  ).length;

  if (newsScore > opinionScore) return 'news';
  if (opinionScore > newsScore) return 'opinion/blog';
  if (opinionScore === 0 && newsScore === 0) return 'unclear';
  return 'mixed';
}

async function analyzeFeed(feedUrl, feedName) {
  try {
    const feed = await parser.parseURL(feedUrl);
    const articles = (feed.items || []).slice(0, 10); // Analyze first 10 articles

    const analysis = {
      feed: feedName,
      total: articles.length,
      news: 0,
      opinion: 0,
      unclear: 0,
      mixed: 0,
      samples: []
    };

    articles.forEach(article => {
      const type = categorizeArticle(article.title, article.contentSnippet);

      if (type === 'news') analysis.news++;
      else if (type === 'opinion/blog') analysis.opinion++;
      else if (type === 'unclear') analysis.unclear++;
      else analysis.mixed++;

      if (analysis.samples.length < 3) {
        analysis.samples.push({
          title: article.title,
          type: type
        });
      }
    });

    analysis.newsPercentage = Math.round((analysis.news / analysis.total) * 100);
    return analysis;

  } catch (error) {
    return {
      feed: feedName,
      error: error.message
    };
  }
}

async function main() {
  const feeds = [
    { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
    { name: 'TechCrunch Funding', url: 'https://techcrunch.com/category/venture/feed/' },
    { name: 'Crunchbase News', url: 'https://news.crunchbase.com/feed/' },
    { name: 'SiliconANGLE', url: 'https://siliconangle.com/feed/' },
    { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
    { name: 'Ars Technica', url: 'http://feeds.arstechnica.com/arstechnica/index' },
    { name: 'ZDNet', url: 'https://www.zdnet.com/news/rss.xml' },
    { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
    { name: 'Hacker News', url: 'https://news.ycombinator.com/rss' },
    { name: 'InfoWorld', url: 'https://www.infoworld.com/feed/' },
    { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/feed.rss' },
  ];

  console.log('Analyzing RSS feeds for content type (news vs opinion/blog)...\n');

  const results = [];
  for (const feed of feeds) {
    const result = await analyzeFeed(feed.url, feed.name);
    results.push(result);

    if (!result.error) {
      console.log(`📊 ${feed.name}:`);
      console.log(`   News: ${result.news}/${result.total} (${result.newsPercentage}%)`);
      console.log(`   Opinion/Blog: ${result.opinion}/${result.total}`);
      console.log(`   Sample articles:`);
      result.samples.forEach(s => {
        const icon = s.type === 'news' ? '📰' : s.type === 'opinion/blog' ? '💭' : '❓';
        console.log(`   ${icon} [${s.type}] "${s.title.substring(0, 80)}..."`);
      });
      console.log();
    }
  }

  console.log('\n=== SUMMARY ===\n');

  const goodForNews = results.filter(r => !r.error && r.newsPercentage >= 50);
  const mixedContent = results.filter(r => !r.error && r.newsPercentage > 20 && r.newsPercentage < 50);
  const mostlyOpinion = results.filter(r => !r.error && r.newsPercentage <= 20);

  console.log('✅ Good for news (50%+ news content):');
  goodForNews.forEach(r => {
    console.log(`   - ${r.feed}: ${r.newsPercentage}% news`);
  });

  console.log('\n⚠️  Mixed content (20-50% news):');
  mixedContent.forEach(r => {
    console.log(`   - ${r.feed}: ${r.newsPercentage}% news, ${r.opinion} opinion pieces`);
  });

  console.log('\n❌ Mostly opinion/blog content (<20% news):');
  mostlyOpinion.forEach(r => {
    console.log(`   - ${r.feed}: ${r.newsPercentage}% news, ${r.opinion} opinion pieces`);
  });
}

main().catch(console.error);