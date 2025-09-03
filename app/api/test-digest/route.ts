import { NextRequest, NextResponse } from 'next/server';
import { DigestService } from '@/lib/services/digest-service';

// Test endpoint to trigger a digest for debugging
export async function GET(request: NextRequest) {
  try {
    // Get lounge ID from query params
    const searchParams = request.nextUrl.searchParams;
    const loungeId = searchParams.get('loungeId');
    const email = searchParams.get('email');

    if (!loungeId || !email) {
      return NextResponse.json(
        { error: 'Missing loungeId or email parameter' },
        { status: 400 }
      );
    }

    console.log(`Triggering test digest for lounge ${loungeId} to ${email}`);

    // Get the lounge details
    const lounges = await DigestService.getLounges();
    const lounge = lounges.find((l) => l.id === loungeId);

    if (!lounge) {
      return NextResponse.json({ error: 'Lounge not found' }, { status: 404 });
    }

    // Send the digest
    await DigestService.sendLoungeDigest(lounge, email);

    return NextResponse.json({
      success: true,
      message: `Test digest sent for ${lounge.name} to ${email}`,
      debug: 'Check server logs for BigStory image debug output',
    });
  } catch (error) {
    console.error('Error sending test digest:', error);
    return NextResponse.json(
      {
        error: 'Failed to send test digest',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}