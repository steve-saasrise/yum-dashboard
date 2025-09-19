import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { requireAdmin } from '@/utils/auth/admin-check';

// Import the actual worker logic directly
import { processAINewsGeneration } from '@/lib/queue/workers/ai-news-processor';

export const maxDuration = 60; // Allow up to 60 seconds for generation
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Check admin access
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    console.log(
      '[Test] Starting synchronous SaaS news generation (bypassing queue)...'
    );

    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the SaaS lounge
    const { data: saasLounge, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('name', 'SaaS Times')
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
      `[Test] Processing SaaS news generation directly for: ${saasLounge.name}`
    );

    // Create a mock job object that the worker function expects
    const mockJob = {
      data: {
        loungeId: saasLounge.id,
        loungeName: saasLounge.name,
        loungeDescription: saasLounge.description,
        isBackfill: false,
        timestamp: new Date().toISOString(),
      },
    };

    // Call the worker function directly (synchronously)
    const result = await processAINewsGeneration(mockJob as any);

    console.log('[Test] SaaS news generation completed:', result);

    return NextResponse.json({
      success: true,
      message: 'SaaS news generated successfully',
      data: {
        ...result,
        loungeId: saasLounge.id,
        loungeName: saasLounge.name,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in synchronous SaaS news generation:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate SaaS news',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
