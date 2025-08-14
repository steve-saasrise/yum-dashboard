import { NextRequest, NextResponse } from 'next/server';
import { DigestService } from '@/lib/services/digest-service';
import { createClient } from '@supabase/supabase-js';

// Helper to create authenticated Supabase client
function getSupabaseClient(token?: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const loungeId = searchParams.get('loungeId');
    const email = searchParams.get('email') || user.email;
    const preview = searchParams.get('preview') === 'true';

    if (!email) {
      return NextResponse.json(
        { error: 'Email address required' },
        { status: 400 }
      );
    }

    // If preview mode, just return the content that would be sent
    if (preview) {
      const lounges = await DigestService.getLounges();
      const lounge = loungeId
        ? lounges.find((l) => l.id === loungeId)
        : lounges[0]; // Default to first lounge

      if (!lounge) {
        return NextResponse.json(
          { error: 'Lounge not found' },
          { status: 404 }
        );
      }

      const content = await DigestService.getContentForLounge(lounge.id);

      return NextResponse.json({
        success: true,
        preview: true,
        lounge: {
          id: lounge.id,
          name: lounge.name,
          description: lounge.description,
        },
        contentCount: content.length,
        youtubeCount: content.filter((c) => c.platform === 'youtube').length,
        content: content.slice(0, 3), // Return first 3 items for preview
      });
    }

    // Send actual digest email(s)
    if (loungeId) {
      // Send digest for specific lounge
      const lounges = await DigestService.getLounges();
      const lounge = lounges.find((l) => l.id === loungeId);

      if (!lounge) {
        return NextResponse.json(
          { error: 'Lounge not found' },
          { status: 404 }
        );
      }

      await DigestService.sendLoungeDigest(lounge, email);

      return NextResponse.json({
        success: true,
        message: `${lounge.name} digest sent to ${email}`,
      });
    } else {
      // Send all lounge digests
      await DigestService.sendDailyDigests(email);

      return NextResponse.json({
        success: true,
        message: `All daily digests sent to ${email}`,
      });
    }
  } catch (error) {
    console.error('Error in test digest endpoint:', error);
    return NextResponse.json(
      {
        error: 'Failed to process digest request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support POST for sending test digests with custom parameters
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and is admin
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const supabase = getSupabaseClient(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { loungeId, email, sendAll = false } = body;

    const targetEmail = email || user.email;

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Email address required' },
        { status: 400 }
      );
    }

    if (sendAll) {
      // Send all lounge digests
      await DigestService.sendDailyDigests(targetEmail);

      return NextResponse.json({
        success: true,
        message: `All daily digests sent to ${targetEmail}`,
      });
    } else if (loungeId) {
      // Send specific lounge digest
      const lounges = await DigestService.getLounges();
      const lounge = lounges.find((l) => l.id === loungeId);

      if (!lounge) {
        return NextResponse.json(
          { error: 'Lounge not found' },
          { status: 404 }
        );
      }

      await DigestService.sendLoungeDigest(lounge, targetEmail);

      return NextResponse.json({
        success: true,
        message: `${lounge.name} digest sent to ${targetEmail}`,
      });
    } else {
      return NextResponse.json(
        { error: 'Either loungeId or sendAll must be specified' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error sending test digest:', error);
    return NextResponse.json(
      {
        error: 'Failed to send digest',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
