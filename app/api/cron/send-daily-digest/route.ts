import { NextRequest, NextResponse } from 'next/server';
import { DigestService } from '@/lib/services/digest-service';

// This endpoint will be called by Vercel Cron at 6am PT daily
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting daily digest send process...');

    // Get all users who have subscribed to at least one lounge
    const users = await DigestService.getUsersWithLoungeSubscriptions();

    if (users.length === 0) {
      console.log('No users with lounge subscriptions found');
      return NextResponse.json({
        success: true,
        message: 'No users with lounge subscriptions',
        count: 0,
      });
    }

    // Send digests to all subscribers
    let successCount = 0;
    let errorCount = 0;

    for (const userEmail of users) {
      try {
        await DigestService.sendDailyDigests(userEmail);
        successCount++;
      } catch (error) {
        console.error(`Failed to send digest to ${userEmail}:`, error);
        errorCount++;
      }
    }

    console.log(
      `Daily digest process complete. Success: ${successCount}, Errors: ${errorCount}`
    );

    return NextResponse.json({
      success: true,
      message: 'Daily digests sent',
      stats: {
        total: users.length,
        success: successCount,
        errors: errorCount,
      },
    });
  } catch (error) {
    console.error('Error in daily digest cron job:', error);
    return NextResponse.json(
      { error: 'Failed to send daily digests' },
      { status: 500 }
    );
  }
}
