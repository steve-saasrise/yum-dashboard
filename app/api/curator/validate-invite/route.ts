import { NextResponse } from 'next/server';
import { CuratorInviteService } from '@/lib/services/curator-invite-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ valid: false });
    }

    const invite = await CuratorInviteService.validateInvite(token);

    if (!invite) {
      return NextResponse.json({ valid: false });
    }

    return NextResponse.json({
      valid: true,
      email: invite.email,
      invitedBy: invite.inviter?.email,
    });
  } catch (error) {
    console.error('Invite validation error:', error);
    return NextResponse.json({ valid: false });
  }
}
