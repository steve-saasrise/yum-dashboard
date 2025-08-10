const creatorsToAdd = [
  {
    "name": "Apple Machine Learning",
    "description": "The Research Journal for Apple on ML",
    "urls": [
      "https://machinelearning.apple.com/feed.xml"
    ]
  },
  {
    "name": "Gary Marcus",
    "description": "Scientist, author, and serial entrepreneur; founded Robust.AI and Geometric Intelligence",
    "urls": [
      "https://twitter.com/GaryMarcus",
      "https://www.linkedin.com/in/gary-marcus-b6384b4",
      "https://garymarcus.substack.com/feed"
    ]
  },
  {
    "name": "Google DeepMind",
    "description": "A leading AI research lab",
    "urls": [
      "https://deepmind.com/blog/feed/basic/"
    ]
  },
  {
    "name": "Microsoft Research",
    "description": "The AI research division of Microsoft",
    "urls": [
      "https://www.microsoft.com/en-us/research/feed/"
    ]
  },
  {
    "name": "Nick Turley",
    "description": "Head of ChatGPT from OpenAI",
    "urls": [
      "https://x.com/nickaturley",
      "https://www.linkedin.com/in/nicholasturley/"
    ]
  }
];

const loungeId = 'b8ee4ddd-14c2-423f-886a-ebbbbe5ea1b1';

// Generate SQL for each creator
creatorsToAdd.forEach((creator, index) => {
  const creatorId = `creator_${index + 1}_id`;
  
  console.log(`-- ${index + 1}. ${creator.name}`);
  console.log(`WITH ${creatorId} AS (`);
  console.log(`  INSERT INTO creators (id, display_name, bio, lounge_id, status, created_at, updated_at)`);
  console.log(`  VALUES (`);
  console.log(`    gen_random_uuid(),`);
  console.log(`    '${creator.name.replace(/'/g, "''")}',`);
  console.log(`    '${creator.description.replace(/'/g, "''")}',`);
  console.log(`    '${loungeId}',`);
  console.log(`    'active',`);
  console.log(`    NOW(),`);
  console.log(`    NOW()`);
  console.log(`  )`);
  console.log(`  RETURNING id`);
  console.log(`)`);
  
  if (creator.urls && creator.urls.length > 0) {
    console.log(`INSERT INTO creator_urls (id, creator_id, url, platform, is_primary, created_at, updated_at)`);
    console.log(`SELECT`);
    creator.urls.forEach((url, urlIndex) => {
      const platform = getPlatform(url);
      const isPrimary = urlIndex === 0 ? 'true' : 'false';
      if (urlIndex > 0) console.log(`UNION ALL SELECT`);
      else console.log(``);
      console.log(`  gen_random_uuid(), id, '${url}', '${platform}', ${isPrimary}, NOW(), NOW() FROM ${creatorId}`);
    });
    console.log(`;`);
  }
  console.log(``);
});

function getPlatform(url) {
  if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
  if (url.includes('linkedin.com')) return 'linkedin';
  if (url.includes('youtube.com')) return 'youtube';
  if (url.includes('threads.net')) return 'threads';
  if (url.includes('.xml') || url.includes('/feed') || url.includes('/rss')) return 'rss';
  return 'other';
}