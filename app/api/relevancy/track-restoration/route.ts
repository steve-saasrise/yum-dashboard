import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated and has appropriate role
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (
      userError ||
      !userData ||
      !['admin', 'curator'].includes(userData.role)
    ) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content_id, lounge_id } = body;

    if (!content_id || !lounge_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the content details including relevancy score
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select(
        `
        *,
        creators (
          display_name,
          username,
          platform
        )
      `
      )
      .eq('id', content_id)
      .single();

    if (contentError || !content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Create a snapshot of the content for analysis
    const contentSnapshot = {
      title: content.title,
      description: content.description,
      url: content.url,
      platform: content.platform,
      creator_name:
        content.creators?.display_name || content.creators?.username,
      published_at: content.published_at,
      reference_type: content.reference_type,
      referenced_content: content.referenced_content,
    };

    // Track the restoration
    const { data: correction, error: insertError } = await supabase
      .from('relevancy_corrections')
      .insert({
        content_id,
        lounge_id,
        original_score: content.relevancy_score || 0,
        original_reason: content.relevancy_reason || 'No reason recorded',
        restored_by: user.id,
        content_snapshot: contentSnapshot,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error tracking restoration:', insertError);
      return NextResponse.json(
        { error: 'Failed to track restoration' },
        { status: 500 }
      );
    }

    // Optionally, update the content's relevancy score to indicate manual override
    // This helps prevent it from being filtered again immediately
    await supabase
      .from('content')
      .update({
        relevancy_score: 100, // Max score to indicate manual approval
        relevancy_reason: 'Manually restored by ' + userData.role,
      })
      .eq('id', content_id);

    return NextResponse.json({
      success: true,
      correction_id: correction.id,
      message: 'Restoration tracked successfully',
    });
  } catch (error) {
    console.error('Error in track-restoration endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
