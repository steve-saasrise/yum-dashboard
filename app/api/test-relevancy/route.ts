import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '@/lib/services/relevancy-service';

export async function GET(request: NextRequest) {
  try {
    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get relevancy service
    const relevancyService = getRelevancyService(supabase);
    if (!relevancyService) {
      return NextResponse.json(
        { error: 'Relevancy service not configured (OpenAI API key missing)' },
        { status: 503 }
      );
    }

    // Process a small batch for testing
    const results = await relevancyService.processRelevancyChecks(10);

    // Get some examples of scored content
    const { data: examples } = await supabase
      .from('content')
      .select(
        `
        id,
        title,
        platform,
        relevancy_score,
        relevancy_reason,
        creators!inner(
          display_name
        )
      `
      )
      .not('relevancy_score', 'is', null)
      .order('relevancy_checked_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.processed} items for relevancy checking`,
      examples: examples || [],
    });
  } catch (error) {
    console.error('Error in test relevancy API:', error);
    return NextResponse.json(
      {
        error: 'Failed to test relevancy checks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
