import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRelevancyService } from '@/lib/services/relevancy-service';

export async function POST(request: NextRequest) {
  try {
    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get relevancy service
    const relevancyService = getRelevancyService(supabase);
    if (!relevancyService) {
      return NextResponse.json(
        { error: 'Relevancy service not configured (OpenAI API key missing)' },
        { status: 503 }
      );
    }

    // Get optional limit from request body
    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;

    // Process relevancy checks
    const results = await relevancyService.processRelevancyChecks(limit);

    return NextResponse.json({
      success: true,
      results,
      message: `Processed ${results.processed} items for relevancy checking`,
    });
  } catch (error) {
    console.error('Error in relevancy check API:', error);
    return NextResponse.json(
      { error: 'Failed to process relevancy checks' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Create Supabase service client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user is admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get content with relevancy scores
    const url = new URL(request.url);
    const loungeId = url.searchParams.get('loungeId');
    const showLowRelevancy = url.searchParams.get('lowRelevancy') === 'true';

    let query = supabase
      .from('content')
      .select(
        `
        id,
        title,
        description,
        url,
        platform,
        published_at,
        relevancy_score,
        relevancy_reason,
        relevancy_checked_at,
        creators!inner(
          display_name
        )
      `
      )
      .order('published_at', { ascending: false })
      .limit(100);

    // Filter by lounge if specified
    if (loungeId) {
      const { data: creatorIds } = await supabase
        .from('creator_lounges')
        .select('creator_id')
        .eq('lounge_id', loungeId);

      if (creatorIds && creatorIds.length > 0) {
        query = query.in(
          'creator_id',
          creatorIds.map((c) => c.creator_id)
        );
      }
    }

    // Filter by low relevancy if requested
    if (showLowRelevancy) {
      query = query.lt('relevancy_score', 70);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      content: data || [],
    });
  } catch (error) {
    console.error('Error fetching relevancy data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch relevancy data' },
      { status: 500 }
    );
  }
}
