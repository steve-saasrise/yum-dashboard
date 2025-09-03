import { NextRequest, NextResponse } from 'next/server';
import { DigestService } from '@/lib/services/digest-service';
import { queueEmailDigests } from '@/lib/queue/queue-service';
import { createClient } from '@supabase/supabase-js';

// This endpoint will be called by Vercel Cron at 6am PT daily
// Now it just queues jobs and returns immediately (scalable to millions of users)
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting daily digest queue process...');

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get all users who have subscribed to at least one lounge with their IDs
    const { data: subscriptions, error } = await supabase
      .from('lounge_digest_subscriptions')
      .select('users!inner(id, email)')
      .eq('subscribed', true);

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    // Deduplicate users (they might be subscribed to multiple lounges)
    const uniqueUsersMap = new Map<string, { email: string; userId: string }>();
    
    for (const sub of subscriptions || []) {
      const user = (sub as any).users;
      if (user && !uniqueUsersMap.has(user.id)) {
        uniqueUsersMap.set(user.id, {
          email: user.email,
          userId: user.id,
        });
      }
    }
    
    const uniqueUsers = Array.from(uniqueUsersMap.values());

    if (uniqueUsers.length === 0) {
      console.log('No users with lounge subscriptions found');
      return NextResponse.json({
        success: true,
        message: 'No users with lounge subscriptions',
        count: 0,
      });
    }

    console.log(`Queuing digests for ${uniqueUsers.length} users...`);

    // Queue all digest jobs - this is FAST even for millions of users
    const queueResult = await queueEmailDigests(uniqueUsers);

    console.log(
      `Daily digest queue process complete. Queued: ${queueResult.queued}, Skipped: ${queueResult.skipped}`
    );

    return NextResponse.json({
      success: true,
      message: 'Daily digests queued for processing',
      stats: {
        total: uniqueUsers.length,
        queued: queueResult.queued,
        skipped: queueResult.skipped,
      },
      // Return immediately - workers will process in background
      processingNote: 'Digests are being processed in the background by workers',
    });
  } catch (error) {
    console.error('Error in daily digest cron job:', error);
    return NextResponse.json(
      { error: 'Failed to queue daily digests' },
      { status: 500 }
    );
  }
}
