import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  queueCreatorsForProcessing,
  getQueueStats,
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

    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active creators
    const { data: creators, error: creatorsError } = await supabase
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

    if (!creators || creators.length === 0) {
      return NextResponse.json({
        message: 'No active creators found',
        queued: 0,
      });
    }

    // Queue all creators for processing
    const queueResult = await queueCreatorsForProcessing(creators);

    // Get current queue statistics
    const queueStats = await getQueueStats();

    return NextResponse.json({
      success: true,
      message: `Queued ${queueResult.queued} creators for processing`,
      stats: {
        creatorsQueued: queueResult.queued,
        totalCreators: creators.length,
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
