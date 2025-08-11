import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function downloadSnapshot(snapshotId: string) {
  const apiKey = process.env.BRIGHTDATA_API_KEY;
  if (!apiKey) {
    console.error('BRIGHTDATA_API_KEY not found in environment');
    return;
  }

  console.log(`Downloading snapshot: ${snapshotId}`);

  const url = `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`;
  console.log('URL:', url);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    console.error('Download failed:', response.status);
    console.error('Error:', await response.text());
    return;
  }

  const text = await response.text();

  // Parse NDJSON (newline-delimited JSON)
  const data = text
    .trim()
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));

  console.log(`Downloaded ${data.length} posts`);

  // Look for posts with videos
  const videoPosts = data.filter(
    (post: any) =>
      post.videos && Array.isArray(post.videos) && post.videos.length > 0
  );

  console.log(`\nFound ${videoPosts.length} posts with videos`);

  if (videoPosts.length > 0) {
    console.log('\n=== VIDEO POSTS ===');
    videoPosts.forEach((post: any, index: number) => {
      console.log(`\nVideo Post ${index + 1}:`);
      console.log('- Title:', post.title?.substring(0, 60));
      console.log('- Post text:', post.post_text?.substring(0, 60));
      console.log('- Videos:', JSON.stringify(post.videos, null, 2));
      console.log('- Video duration:', post.video_duration);
      console.log('- Video thumbnail:', post.video_thumbnail);
    });
  }

  // Also check posts that might have video_thumbnail but no videos array
  const thumbnailOnlyPosts = data.filter(
    (post: any) =>
      post.video_thumbnail &&
      (!post.videos || !Array.isArray(post.videos) || post.videos.length === 0)
  );

  if (thumbnailOnlyPosts.length > 0) {
    console.log(
      `\n\nFound ${thumbnailOnlyPosts.length} posts with video_thumbnail but no videos array`
    );
    thumbnailOnlyPosts.forEach((post: any, index: number) => {
      console.log(`\nThumbnail-only Post ${index + 1}:`);
      console.log('- Title:', post.title?.substring(0, 60));
      console.log('- Video thumbnail:', post.video_thumbnail);
      console.log('- Video duration:', post.video_duration);
    });
  }

  // Save the full data for analysis
  const outputPath = path.join(process.cwd(), `snapshot_${snapshotId}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`\nFull data saved to: ${outputPath}`);

  // Look for Neil Patel's "I didn't understand marketing" post
  const neilPatelPost = data.find(
    (post: any) =>
      post.post_text?.toLowerCase().includes("didn't understand marketing") ||
      post.title?.toLowerCase().includes("didn't understand marketing")
  );

  if (neilPatelPost) {
    console.log('\n=== FOUND NEIL PATEL VIDEO POST ===');
    console.log('Full post data:', JSON.stringify(neilPatelPost, null, 2));
  }
}

// Get snapshot ID from command line or use the one we found
const snapshotId = process.argv[2] || 's_me6rou1fcnswgcg0n';
downloadSnapshot(snapshotId).catch(console.error);
