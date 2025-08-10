const fs = require('fs');

// Read the RSS feeds data
const rssData = JSON.parse(fs.readFileSync('/Users/steve/yum-dashboard/scripts/rss-feeds-to-add.json', 'utf8'));

// Generate SQL for each creator's RSS feeds
console.log('-- Add RSS feed URLs to existing creators');
console.log('');

rssData.forEach(creator => {
  console.log(`-- ${creator.name}`);
  
  creator.feeds.forEach(feed => {
    const normalizedUrl = feed.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    
    console.log(`INSERT INTO creator_urls (id, creator_id, url, normalized_url, platform, created_at, updated_at)`);
    console.log(`SELECT `);
    console.log(`  gen_random_uuid(),`);
    console.log(`  c.id,`);
    console.log(`  '${feed}',`);
    console.log(`  '${normalizedUrl}',`);
    console.log(`  'rss'::platform_type,`);
    console.log(`  NOW(),`);
    console.log(`  NOW()`);
    console.log(`FROM creators c`);
    console.log(`WHERE c.display_name = '${creator.name.replace(/'/g, "''")}'`);
    console.log(`  AND NOT EXISTS (`);
    console.log(`    SELECT 1 FROM creator_urls cu`);
    console.log(`    WHERE cu.creator_id = c.id`);
    console.log(`      AND cu.url = '${feed}'`);
    console.log(`  );`);
    console.log(``);
  });
});