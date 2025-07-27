import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';
import { CuratorInviteService } from '@/lib/services/curator-invite-service';

const createInviteSchema = z.object({
  email: z.string().email(),
});

export async function GET() {
  try {
    const curator = await CuratorAuthService.getCurrentCurator();

    if (!curator || !curator.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invites = await CuratorInviteService.listInvites();

    return NextResponse.json({ invites });
  } catch (error) {
    console.error('List invites error:', error);
    return NextResponse.json(
      { error: 'Failed to list invites' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    console.log('POST /api/curator/invites - Starting');
    const curator = await CuratorAuthService.getCurrentCurator();
    console.log(
      'Current curator:',
      curator?.email,
      'Admin:',
      curator?.is_admin
    );

    if (!curator || !curator.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('Request body:', body);
    const { email } = createInviteSchema.parse(body);

    const token = await CuratorInviteService.createInvite(email, curator.id);
    console.log('Created token:', token ? 'Success' : 'Failed');

    if (!token) {
      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 400 }
      );
    }

    // Send invite email
    if (process.env.RESEND_API_KEY) {
      const { sendCuratorInviteEmail } = await import(
        '@/lib/services/email-service'
      );
      await sendCuratorInviteEmail(email, token, curator.email);
    } else {
      // Fallback to console logging if no email service configured
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/curator/accept-invite?token=${token}`;
      console.log('Invite link:', inviteUrl);
      console.log('In production, this would be sent to:', email);
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/curator/accept-invite?token=${token}`;
    return NextResponse.json({
      success: true,
      token,
      inviteUrl,
    });
  } catch (error) {
    console.error('Create invite error:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create invite' },
      { status: 500 }
    );
  }
}
