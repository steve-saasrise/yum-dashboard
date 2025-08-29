import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { queueAINewsGeneration } from '@/lib/queue/queue-service';
import type { Database } from '@/types/database.types';

export const maxDuration = 10; // Reduced to 10 seconds since we're just queuing
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get all active lounges
    const { data: lounges, error: loungesError } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('is_system_lounge', true)
      .order('name');

    if (loungesError || !lounges) {
      console.error('Error fetching lounges:', loungesError);
      return NextResponse.json(
        { error: 'Failed to fetch lounges' },
        { status: 500 }
      );
    }

    console.log(`Queuing AI news generation for ${lounges.length} lounges`);

    // Queue all lounges for processing
    const queueResult = await queueAINewsGeneration(lounges, true);

    console.log('AI news generation jobs queued:', {
      queued: queueResult.queued,
      skipped: queueResult.skipped,
      total: lounges.length + 1, // +1 for general news
    });

    return NextResponse.json({
      success: true,
      message: `Queued ${queueResult.queued} AI news generation jobs`,
      results: {
        queued: queueResult.queued,
        skipped: queueResult.skipped,
        total: lounges.length + 1,
        jobs: queueResult.jobs.map((job) => ({
          id: job.id,
          name: job.name,
          lounge: (job.data as any).loungeName,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in AI news generation cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
