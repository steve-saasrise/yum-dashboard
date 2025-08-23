import { NextResponse } from 'next/server';
import { BrightDataFetcher } from '@/lib/content-fetcher/brightdata-fetcher';
import { createClient } from '@/utils/supabase/server';

export async function GET() {
  try {
    if (!process.env.BRIGHTDATA_API_KEY) {
      return NextResponse.json(
        { error: 'BRIGHTDATA_API_KEY not configured' },
        { status: 500 }
      );
    }

    const brightDataFetcher = new BrightDataFetcher({
      apiKey: process.env.BRIGHTDATA_API_KEY,
    });

    const supabase = createClient();

    // Get historical snapshots
    console.log('Fetching historical snapshots...');
    const snapshots = await brightDataFetcher.getAllHistoricalSnapshots(10, 'ready');

    // Check database
    const { data: dbSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('snapshot_id, status, created_at, processed_at, posts_retrieved')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get pending snapshots
    const { data: pendingSnapshots } = await supabase
      .from('brightdata_snapshots')
      .select('*')
      .in('status', ['pending', 'ready'])
      .limit(5);

    return NextResponse.json({
      brightdata: {
        available_snapshots: snapshots.length,
        snapshots: snapshots.slice(0, 5).map(s => ({
          id: s.snapshot_id,
          status: s.status,
          created: s.created,
          records: s.result_count,
          cost: s.cost,
        })),
      },
      database: {
        tracked_snapshots: dbSnapshots?.length || 0,
        snapshots: dbSnapshots || [],
        pending: pendingSnapshots || [],
      },
      recovery_needed: snapshots.length > (dbSnapshots?.length || 0),
    });
  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}