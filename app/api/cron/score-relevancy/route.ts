import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '@/lib/services/relevancy-service';

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
  const startTime = Date.now();
  console.log('[RELEVANCY-CRON] Starting at', new Date().toISOString());

  try {
    // Verify this is a legitimate cron request
    if (!verifyCronAuth(request)) {
      console.log('[RELEVANCY-CRON] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if OpenAI is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('[RELEVANCY-CRON] OpenAI API key not configured');
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      );
    }
    console.log(
      '[RELEVANCY-CRON] OpenAI key exists, length:',
      process.env.OPENAI_API_KEY?.length
    );

    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    console.log('[RELEVANCY-CRON] Supabase client created');

    // Get relevancy service
    const relevancyService = getRelevancyService(supabase);
    if (!relevancyService) {
      console.error('[RELEVANCY-CRON] Failed to initialize relevancy service');
      return NextResponse.json(
        { error: 'Failed to initialize relevancy service' },
        { status: 500 }
      );
    }
    console.log('[RELEVANCY-CRON] Relevancy service initialized');

    // Check for unscored content
    const { count: unscoredCount, error: countError } = await supabase
      .from('content')
      .select('id', { count: 'exact', head: true })
      .is('relevancy_checked_at', null)
      .gte(
        'created_at',
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      );

    if (countError) {
      console.error(
        '[RELEVANCY-CRON] Error counting unscored content:',
        countError
      );
    }

    const totalUnscored = unscoredCount || 0;
    console.log(
      `[RELEVANCY-CRON] Unscored count query returned: ${unscoredCount}`
    );

    if (totalUnscored === 0) {
      return NextResponse.json({
        success: true,
        message: 'No content to score',
        stats: {
          processed: 0,
          errors: 0,
        },
      });
    }

    console.log(`[RELEVANCY-CRON] Found ${totalUnscored} unscored items`);

    // Process in batches to avoid timeout
    const batchSize = 100; // Process up to 100 items per cron run
    console.log(`[RELEVANCY-CRON] About to process ${batchSize} items...`);

    let results;
    try {
      results = await relevancyService.processRelevancyChecks(batchSize);
      console.log('[RELEVANCY-CRON] processRelevancyChecks returned:', results);
    } catch (processError) {
      console.error(
        '[RELEVANCY-CRON] Error in processRelevancyChecks:',
        processError
      );
      throw processError;
    }

    const elapsed = Date.now() - startTime;
    console.log(`[RELEVANCY-CRON] Completed in ${elapsed}ms:`, results);

    return NextResponse.json({
      success: true,
      message: 'Relevancy scoring completed',
      stats: {
        unscored: totalUnscored,
        processed: results.processed,
        errors: results.errors,
        remaining: Math.max(0, totalUnscored - results.processed),
      },
      timestamp: new Date().toISOString(),
      elapsed: `${elapsed}ms`,
    });
  } catch (error) {
    console.error('[RELEVANCY-CRON] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
