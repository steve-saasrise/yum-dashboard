import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { SecurityService } from '@/lib/security/security-service';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // First get the user (validates with auth server)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'No authenticated user' },
        { status: 401 }
      );
    }

    // Then get the session for the access token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'No session found' }, { status: 401 });
    }

    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // Extract session_id from JWT payload
    const tokenParts = session.access_token.split('.');
    let sessionId: string | undefined;

    try {
      if (tokenParts.length === 3) {
        const payload = JSON.parse(
          Buffer.from(tokenParts[1], 'base64').toString()
        );
        sessionId = payload.session_id;
      }
    } catch (e) {
      console.error('Failed to extract session_id from JWT:', e);
    }

    if (!sessionId) {
      // Fallback to user ID if session_id not available
      sessionId = user.id;
    }

    console.log('Session tracking:', {
      userId: user.id,
      sessionId,
      userAgent: userAgent.substring(0, 50),
      ipAddress,
    });

    // Track device session
    await SecurityService.trackDeviceSession(
      user.id,
      sessionId,
      userAgent,
      ipAddress,
      true // Check if new device
    );

    // Check for suspicious activity
    const isSuspicious = await SecurityService.checkSuspiciousActivity(
      user.id,
      ipAddress
    );

    if (isSuspicious) {
      // Log security event but don't block (monitoring mode)
      console.warn(`Suspicious activity detected for user ${user.id}`);
    }

    // Handle successful login tracking
    await SecurityService.handleSuccessfulLogin(user.id);

    return NextResponse.json({ success: true, suspicious: isSuspicious });
  } catch (error) {
    console.error('Error tracking session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
