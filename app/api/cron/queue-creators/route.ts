import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  queueCreatorsForProcessing,
  getQueueStats,
  aggressiveCleanup,
} from '@/lib/queue/queue-service';

// Verify cron authorization
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  return process.env.NODE_ENV === 'development';
}

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if Redis is configured
    if (
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN
    ) {
      return NextResponse.json(
        {
          error:
            'Redis not configured. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN',
        },
        { status: 500 }
      );
    }

    // Clean up old jobs before starting new ones
    try {
      await aggressiveCleanup();
    } catch (cleanupError) {
      console.error('Queue cleanup failed:', cleanupError);
      // Continue even if cleanup fails
    }

    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active creators
    const { data: allCreators, error: creatorsError } = await supabase
      .from('creators')
      .select('id, display_name')
      .eq('status', 'active')
      .order('updated_at', { ascending: true }); // Process oldest first

    if (creatorsError) {
      return NextResponse.json(
        { error: 'Failed to fetch creators', details: creatorsError },
        { status: 500 }
      );
    }

    // Get creators that ONLY have LinkedIn URLs (to exclude them)
    const { data: linkedinOnlyUrls, error: urlsError } = await supabase
      .from('creator_urls')
      .select('creator_id, platform');

    if (urlsError) {
      return NextResponse.json(
        { error: 'Failed to fetch creator URLs', details: urlsError },
        { status: 500 }
      );
    }

    // Find creators that have at least one non-LinkedIn platform
    const creatorPlatforms = new Map<string, Set<string>>();
    linkedinOnlyUrls?.forEach((url) => {
      if (!creatorPlatforms.has(url.creator_id)) {
        creatorPlatforms.set(url.creator_id, new Set());
      }
      creatorPlatforms.get(url.creator_id)?.add(url.platform);
    });

    // Filter out creators that ONLY have LinkedIn
    const creators =
      allCreators?.filter((creator) => {
        const platforms = creatorPlatforms.get(creator.id);
        return platforms && Array.from(platforms).some((p) => p !== 'linkedin');
      }) || [];

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        message: 'No active creators with non-LinkedIn platforms found',
        queued: 0,
      });
    }

    // Queue all creators for processing, skipping LinkedIn
    const queueResult = await queueCreatorsForProcessing(creators, {
      skipLinkedIn: true,
    });

    // Get current queue statistics
    const queueStats = await getQueueStats();

    return NextResponse.json({
      success: true,
      message: `Queued ${queueResult.queued} creators for non-LinkedIn processing (${queueResult.skipped} skipped)`,
      stats: {
        creatorsQueued: queueResult.queued,
        creatorsSkipped: queueResult.skipped,
        totalCreators: creators.length,
        platforms: 'RSS, YouTube, Twitter, Threads (LinkedIn skipped)',
        queueStatus: queueStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron queue error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
