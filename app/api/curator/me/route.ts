import { NextResponse } from 'next/server';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';

export async function GET() {
  try {
    const curator = await CuratorAuthService.getCurrentCurator();

    if (!curator) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ curator });
  } catch (error) {
    console.error('Get current curator error:', error);
    return NextResponse.json({ error: 'An error occurred' }, { status: 500 });
  }
}
