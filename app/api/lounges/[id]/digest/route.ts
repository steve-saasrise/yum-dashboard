import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is subscribed to this lounge's digest
    const { data, error } = await supabase
      .from('lounge_digest_subscriptions')
      .select('subscribed')
      .eq('user_id', user.id)
      .eq('lounge_id', id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is ok
      throw error;
    }

    return NextResponse.json({
      subscribed: data?.subscribed || false,
    });
  } catch (error) {
    console.error('Error fetching digest subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { subscribed } = await request.json();

    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Upsert subscription status
    const { data, error } = await supabase
      .from('lounge_digest_subscriptions')
      .upsert(
        {
          user_id: user.id,
          lounge_id: id,
          subscribed,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,lounge_id',
        }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error updating digest subscription:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}