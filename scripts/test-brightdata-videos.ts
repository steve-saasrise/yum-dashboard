import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function testBrightDataVideos() {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    console.error('BRIGHTDATA_API_KEY not found in environment');
    return;
  }

  // Test with Neil Patel who has video posts
  // Try without trailing slash as that's how it appears in the database URLs
  const profileUrl = 'https://www.linkedin.com/in/neilkpatel';

  console.log('Testing BrightData LinkedIn video fetching...');
  console.log('Profile:', profileUrl);

  // Trigger collection
  const triggerUrl = `https://api.brightdata.com/datasets/v3/trigger?dataset_id=gd_lyy3tktm25m4avu764&include_errors=true&type=discover_new&discover_by=profile_url`;

  const triggerBody = [
    {
      url: profileUrl,
      end_date: new Date().toISOString().split('T')[0], // Today
      start_date: '2025-08-01', // Get posts from early January including the video post
    },
  ];

  console.log(
    'Triggering collection with body:',
    JSON.stringify(triggerBody, null, 2)
  );

  const triggerResponse = await fetch(triggerUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(triggerBody),
  });

  if (!triggerResponse.ok) {
    console.error(
      'Trigger failed:',
      triggerResponse.status,
      await triggerResponse.text()
    );
    return;
  }

  const { snapshot_id } = await triggerResponse.json();
  console.log('Snapshot ID:', snapshot_id);
  console.log('Waiting for results...');

  // Poll for results
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max

  while (attempts < maxAttempts) {
    attempts++;

    // Check status
    const statusResponse = await fetch(
      `https://api.brightdata.com/datasets/v3/progress/${snapshot_id}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!statusResponse.ok) {
      console.error('Status check failed:', statusResponse.status);
      return;
    }

    const status = await statusResponse.json();
    console.log(`Attempt ${attempts}: Status = ${status.status}`);

    if (status.status === 'ready') {
      // Fetch results - try without format parameter first
      const dataUrl = `https://api.brightdata.com/datasets/v3/snapshot/${snapshot_id}`;
      console.log('Fetching data from:', dataUrl);

      const dataResponse = await fetch(dataUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (!dataResponse.ok) {
        console.error('Data fetch failed:', dataResponse.status);
        console.error('Error text:', await dataResponse.text());
        return;
      }

      const posts = await dataResponse.json();
      console.log(`\nFound ${posts.length} posts\n`);

      // Look for posts with videos
      const videoPosts = posts.filter(
        (post: any) =>
          post.videos && Array.isArray(post.videos) && post.videos.length > 0
      );

      console.log(`Found ${videoPosts.length} posts with videos\n`);

      // Show all posts to see what we get
      console.log('\nAll posts overview:');
      posts.forEach((post: any, index: number) => {
        console.log(`\nPost ${index + 1}:`);
        console.log('- ID:', post.id);
        console.log('- Title:', post.title?.substring(0, 60));
        console.log(
          '- Has images:',
          post.images ? `Yes (${post.images.length})` : 'No'
        );
        console.log(
          '- Has videos:',
          post.videos ? `Yes (${post.videos.length})` : 'No'
        );
        console.log('- Video thumbnail:', post.video_thumbnail || 'None');
        console.log('- Video duration:', post.video_duration || 'None');
        console.log('- Post type:', post.post_type);
        console.log('- Date posted:', post.date_posted);
      });

      if (videoPosts.length > 0) {
        console.log('\n=== VIDEO POST DETAILS ===');
        const samplePost = videoPosts[0];
        console.log(
          'Full video data:',
          JSON.stringify(samplePost.videos, null, 2)
        );
      }

      // Also show the full structure of the first post
      if (posts.length > 0) {
        console.log('\n=== FULL POST STRUCTURE (first post) ===');
        console.log(JSON.stringify(posts[0], null, 2));
      }

      return;
    } else if (status.status === 'failed') {
      console.error('Snapshot failed:', status.error);
      return;
    }

    // Wait 5 seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  console.error('Timeout waiting for results');
}

testBrightDataVideos().catch(console.error);
