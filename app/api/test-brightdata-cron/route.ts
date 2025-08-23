import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 10; // seconds

export async function GET(request: NextRequest) {
  console.log('[Test] BrightData cron test endpoint called');

  try {
    // Test 1: Environment variables
    const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
    const hasRedis =
      !!process.env.UPSTASH_REDIS_REST_URL &&
      !!process.env.UPSTASH_REDIS_REST_TOKEN;
    const hasCronSecret = !!process.env.CRON_SECRET;

    console.log('[Test] Environment check:', {
      hasSupabase,
      hasSupabaseServiceKey,
      hasRedis,
      hasCronSecret,
    });

    // Test 2: Database connection
    const dbTest = { success: false, error: null as any, snapshotCount: 0 };
    try {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('Supabase configuration missing');
      }
      
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );
      
      const { data: snapshots, error } = await supabase
        .from('brightdata_snapshots')
        .select('status')
        .limit(5);

      if (error) {
        dbTest.error = error.message;
      } else {
        dbTest.success = true;
        dbTest.snapshotCount = snapshots?.length || 0;
      }
    } catch (e) {
      dbTest.error = e instanceof Error ? e.message : 'Unknown database error';
    }

    console.log('[Test] Database test:', dbTest);

    // Test 3: Redis connection (without BullMQ)
    const redisTest = { success: false, error: null as any };
    if (hasRedis) {
      try {
        // Just check if we can parse the Redis config
        const url = process.env.UPSTASH_REDIS_REST_URL!;
        const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
        const host = url.replace('https://', '').replace(/:\d+$/, '');

        if (host && token) {
          redisTest.success = true;
        }
      } catch (e) {
        redisTest.error = e instanceof Error ? e.message : 'Redis config error';
      }
    }

    console.log('[Test] Redis test:', redisTest);

    // Return results
    return NextResponse.json({
      success: true,
      tests: {
        environment: {
          hasSupabase,
          hasSupabaseServiceKey,
          hasRedis,
          hasCronSecret,
        },
        database: dbTest,
        redis: redisTest,
      },
      message: 'Test completed',
    });
  } catch (error) {
    console.error('[Test] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
