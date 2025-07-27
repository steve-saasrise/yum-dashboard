import { NextResponse } from 'next/server';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';
import { CuratorInviteService } from '@/lib/services/curator-invite-service';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const curator = await CuratorAuthService.getCurrentCurator();

    if (!curator || !curator.is_admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inviteId } = await params;
    const success = await CuratorInviteService.deleteInvite(inviteId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete invite' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invite error:', error);
    return NextResponse.json(
      { error: 'Failed to delete invite' },
      { status: 500 }
    );
  }
}
