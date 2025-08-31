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

    // Get all active creators with LinkedIn URLs only
    const { data: linkedinCreators, error: creatorsError } = await supabase
      .from('creators')
      .select(`
        id, 
        display_name,
        creator_urls!inner(platform)
      `)
      .eq('status', 'active')
      .eq('creator_urls.platform', 'linkedin')
      .order('updated_at', { ascending: true }); // Process oldest first

    if (creatorsError) {
      return NextResponse.json(
        { error: 'Failed to fetch LinkedIn creators', details: creatorsError },
        { status: 500 }
      );
    }

    // Get unique creator IDs (since a creator might have multiple LinkedIn URLs)
    const uniqueCreators = Array.from(
      new Map(
        linkedinCreators?.map((creator) => [creator.id, creator]) || []
      ).values()
    );

    if (!uniqueCreators || uniqueCreators.length === 0) {
      return NextResponse.json({
        message: 'No active LinkedIn creators found',
        queued: 0,
      });
    }

    console.log(`[LinkedIn Cron] Found ${uniqueCreators.length} LinkedIn creators to process`);

    // Queue all LinkedIn creators for processing
    const queueResult = await queueCreatorsForProcessing(uniqueCreators);

    // Get current queue statistics
    const queueStats = await getQueueStats();

    return NextResponse.json({
      success: true,
      message: `Queued ${queueResult.queued} LinkedIn creators for processing (${queueResult.skipped} skipped)`,
      stats: {
        creatorsQueued: queueResult.queued,
        creatorsSkipped: queueResult.skipped,
        totalLinkedInCreators: uniqueCreators.length,
        queueStatus: queueStats,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('LinkedIn cron queue error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}