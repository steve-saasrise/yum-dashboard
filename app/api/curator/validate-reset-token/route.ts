import { NextResponse } from 'next/server';
import { CuratorPasswordResetService } from '@/lib/services/curator-password-reset-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    const validation =
      await CuratorPasswordResetService.validateResetToken(token);

    return NextResponse.json({
      valid: !!validation,
      email: validation?.email,
    });
  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json({ valid: false });
  }
}
