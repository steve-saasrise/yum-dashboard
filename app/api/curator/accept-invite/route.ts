import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CuratorInviteService } from '@/lib/services/curator-invite-service';

const acceptInviteSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = acceptInviteSchema.parse(body);

    const success = await CuratorInviteService.acceptInvite(token, password);

    if (!success) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Accept invite error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
