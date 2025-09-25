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

    console.log('[Cron] Starting SaaS news generation...');

    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the SaaS lounge
    const { data: saasLounge, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('name', 'SaaS Pulse')
      .eq('is_system_lounge', true)
      .single();

    if (loungeError || !saasLounge) {
      console.error('Error fetching SaaS lounge:', loungeError);
      return NextResponse.json(
        { error: 'Failed to fetch SaaS lounge' },
        { status: 500 }
      );
    }

    console.log(
      `[Cron] Queuing SaaS news generation for lounge: ${saasLounge.name}`
    );

    // Queue just the SaaS lounge for processing
    const queueResult = await queueAINewsGeneration([saasLounge], false);

    console.log('[Cron] SaaS news generation job queued:', {
      queued: queueResult.queued,
      skipped: queueResult.skipped,
    });

    return NextResponse.json({
      success: true,
      message: 'SaaS news generation queued successfully',
      data: {
        loungeId: saasLounge.id,
        loungeName: saasLounge.name,
        queued: queueResult.queued,
        skipped: queueResult.skipped,
        jobs: queueResult.jobs.map((job) => ({
          id: job.id,
          name: job.name,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in SaaS news generation cron job:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
