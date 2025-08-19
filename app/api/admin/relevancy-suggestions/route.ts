import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';

    let query = supabase
      .from('prompt_adjustments')
      .select(
        `
        *,
        lounges (
          id,
          name
        ),
        users!approved_by (
          email,
          full_name
        )
      `
      )
      .order('suggested_at', { ascending: false });

    if (status === 'pending') {
      query = query.eq('approved', false);
    } else if (status === 'active') {
      query = query.eq('approved', true).eq('active', true);
    } else if (status === 'inactive') {
      query = query.eq('approved', true).eq('active', false);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching suggestions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch suggestions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ suggestions: data || [] });
  } catch (error) {
    console.error('Error in relevancy-suggestions endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is authenticated and is admin
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || !userData || userData.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, suggestion_id } = body;

    if (!action || !suggestion_id) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'approve':
        result = await supabase
          .from('prompt_adjustments')
          .update({
            approved: true,
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            active: true,
          })
          .eq('id', suggestion_id);
        break;

      case 'reject':
        result = await supabase
          .from('prompt_adjustments')
          .delete()
          .eq('id', suggestion_id);
        break;

      case 'deactivate':
        result = await supabase
          .from('prompt_adjustments')
          .update({ active: false })
          .eq('id', suggestion_id);
        break;

      case 'reactivate':
        result = await supabase
          .from('prompt_adjustments')
          .update({ active: true })
          .eq('id', suggestion_id);
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (result.error) {
      console.error(`Error performing ${action}:`, result.error);
      return NextResponse.json(
        { error: `Failed to ${action} suggestion` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Suggestion ${action}d successfully`,
    });
  } catch (error) {
    console.error('Error in relevancy-suggestions endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
