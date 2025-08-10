const fs = require('fs');
const csv = require('csv-parse/sync');

// Read the CSV file
const csvContent = fs.readFileSync('/Users/steve/yum-dashboard/scripts/Curated Thought Leaders - AI (Green is New).csv', 'utf8');

// Parse CSV
const records = csv.parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});

// Process records to extract RSS/blog feeds
const creatorsWithRssFeeds = [];

records.forEach(record => {
  const name = record['AI Creator'].trim();
  const blogFeed = record['Blog Feed'];
  
  if (blogFeed && blogFeed.trim()) {
    // Split multiple feeds by comma
    const feeds = blogFeed.split(',').map(feed => feed.trim()).filter(feed => feed);
    
    if (feeds.length > 0) {
      creatorsWithRssFeeds.push({
        name: name,
        feeds: feeds
      });
    }
  }
});

console.log(`Found ${creatorsWithRssFeeds.length} creators with RSS/blog feeds to add:\n`);

creatorsWithRssFeeds.forEach(creator => {
  console.log(`${creator.name}:`);
  creator.feeds.forEach(feed => {
    console.log(`  - ${feed}`);
  });
});

// Save to JSON for reference
fs.writeFileSync('/Users/steve/yum-dashboard/scripts/rss-feeds-to-add.json', JSON.stringify(creatorsWithRssFeeds, null, 2));