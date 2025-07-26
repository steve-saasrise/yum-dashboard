import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAISummaryService } from '@/lib/services/ai-summary-service';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Server Component context
            }
          },
        },
      }
    );

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check for OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      );
    }

    // Get user's creators
    const { data: userCreators } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id);

    if (!userCreators || userCreators.length === 0) {
      return NextResponse.json({
        message: 'No creators found',
        processed: 0,
        errors: 0,
        totalPending: 0,
      });
    }

    const creatorIds = userCreators.map((c: { id: string }) => c.id);

    // Count total pending summaries
    const { count: totalPending } = await supabase
      .from('content')
      .select('*', { count: 'exact', head: true })
      .in('creator_id', creatorIds)
      .eq('summary_status', 'pending');

    if (!totalPending || totalPending === 0) {
      return NextResponse.json({
        message: 'No pending summaries found',
        processed: 0,
        errors: 0,
        totalPending: 0,
      });
    }

    // Process in batches to avoid timeouts
    const summaryService = getAISummaryService();
    let totalProcessed = 0;
    let totalErrors = 0;
    const batchSize = 100; // Process 100 at a time
    const maxBatches = 5; // Limit to 500 summaries per request

    for (
      let batch = 0;
      batch < maxBatches && totalProcessed < totalPending;
      batch++
    ) {
      // Get next batch of pending content
      const { data: pendingContent } = await supabase
        .from('content')
        .select('id')
        .in('creator_id', creatorIds)
        .eq('summary_status', 'pending')
        .limit(batchSize);

      if (!pendingContent || pendingContent.length === 0) {
        break;
      }

      const contentIds = pendingContent.map((c: { id: string }) => c.id);

      // Process this batch
      const results = await summaryService.generateBatchSummaries(contentIds, {
        batchSize: 5,
        delayMs: 1500, // Slightly longer delay for bulk processing
        model: 'gpt-4o-mini', // Use the efficient model
      });

      totalProcessed += results.processed;
      totalErrors += results.errors;

      // Add a delay between major batches
      if (batch < maxBatches - 1 && totalProcessed < totalPending) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return NextResponse.json({
      message: `Processed ${totalProcessed} summaries`,
      processed: totalProcessed,
      errors: totalErrors,
      totalPending,
      remaining: Math.max(0, totalPending - totalProcessed),
    });
  } catch (error) {
    console.error('Error processing pending summaries:', error);
    return NextResponse.json(
      {
        error: 'Failed to process summaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
