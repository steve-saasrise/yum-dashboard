import { NextRequest, NextResponse } from 'next/server';
import { SecurityService } from '@/lib/security/security-service';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    await SecurityService.handleFailedLogin(email, ipAddress);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling failed auth:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
