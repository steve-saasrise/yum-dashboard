import { NextRequest, NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';

export async function GET(request: NextRequest) {
  try {
    // Check if Bright Data API key is configured
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        {
          error: 'Bright Data API key not configured',
          message:
            'Please add BRIGHTDATA_API_KEY to your environment variables',
        },
        { status: 500 }
      );
    }

    // Initialize Bright Data fetcher
    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    // Get existing snapshots
    console.log('[Test] Checking for existing BrightData snapshots...');

    const readySnapshots =
      await brightDataFetcher.getExistingSnapshots('ready');
    const runningSnapshots =
      await brightDataFetcher.getExistingSnapshots('running');

    // Get sample data from the most recent ready snapshot
    let sampleData = null;
    let sampleCount = 0;

    if (readySnapshots.length > 0) {
      const latestSnapshot = readySnapshots[0];
      console.log(
        `[Test] Fetching data from latest snapshot: ${latestSnapshot.id}`
      );

      try {
        // Fetch the actual data from the snapshot
        const endpoint = `https://api.brightdata.com/datasets/v3/snapshot/${latestSnapshot.id}?format=json`;

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          sampleCount = Array.isArray(data) ? data.length : 1;

          // Get first 3 items as sample
          sampleData = Array.isArray(data)
            ? data.slice(0, 3).map((item: any) => ({
                id: item.id,
                url: item.url || item.use_url,
                date_posted: item.date_posted,
                user_id: item.user_id,
                title: item.title || item.headline,
                text_preview: item.post_text?.substring(0, 100) + '...',
                has_images: !!(item.images && item.images.length > 0),
                has_videos: !!(item.videos && item.videos.length > 0),
                engagement: {
                  likes: item.num_likes,
                  comments: item.num_comments,
                },
              }))
            : [data];
        }
      } catch (error) {
        console.error('[Test] Error fetching snapshot data:', error);
      }
    }

    // Return results
    return NextResponse.json({
      success: true,
      summary: {
        ready_snapshots: readySnapshots.length,
        running_snapshots: runningSnapshots.length,
        total_snapshots: readySnapshots.length + runningSnapshots.length,
        latest_ready_has_data: sampleCount,
      },
      ready_snapshots: readySnapshots.map((s: any) => ({
        id: s.id,
        created: s.created,
        status: s.status,
        dataset_size: s.dataset_size,
        trigger_type: s.trigger?.type,
      })),
      running_snapshots: runningSnapshots.map((s: any) => ({
        id: s.id,
        created: s.created,
        status: s.status,
        elapsed_time: Date.now() - new Date(s.created).getTime(),
      })),
      sample_data: sampleData,
      recommendation:
        readySnapshots.length > 0
          ? `You have ${readySnapshots.length} ready snapshots with data. The latest contains ${sampleCount} posts.`
          : 'No ready snapshots found. You may need to trigger a collection.',
    });
  } catch (error) {
    console.error('[Test] Error checking BrightData snapshots:', error);

    return NextResponse.json(
      {
        error: 'Failed to check BrightData snapshots',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
