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

    // Get all users who should receive daily digests
    const users = await DigestService.getUsersForDailyDigest();

    if (users.length === 0) {
      // For now, send to the admin/test account
      // In production, this would use the email_digests table
      const testEmail = process.env.DIGEST_TEST_EMAIL || 'steve@saasrise.com';
      console.log(
        `No digest subscribers found, sending test digest to ${testEmail}`
      );

      await DigestService.sendDailyDigests(testEmail);

      return NextResponse.json({
        success: true,
        message: `Test digest sent to ${testEmail}`,
        count: 1,
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
