import { NextResponse } from 'next/server';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';

export async function POST() {
  try {
    await CuratorAuthService.logout();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'An error occurred during logout' },
      { status: 500 }
    );
  }
}
