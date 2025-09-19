import { NextRequest, NextResponse } from 'next/server';
import { DigestService } from '@/lib/services/digest-service';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/auth/admin-check';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Check admin access
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { email } = await request.json();

    console.log(`[Test] Sending test digest to: ${email}`);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the SaaS lounge for testing
    const { data: lounge, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description, theme_description')
      .eq('name', 'SaaS Times')
      .eq('is_system_lounge', true)
      .single();

    if (loungeError || !lounge) {
      return NextResponse.json(
        { error: 'Failed to fetch SaaS lounge' },
        { status: 500 }
      );
    }

    // Send the digest for this specific lounge
    await DigestService.sendLoungeDigest(lounge, email);

    console.log(`[Test] Successfully sent test digest to ${email}`);

    return NextResponse.json({
      success: true,
      message: `Test digest sent to ${email}`,
      lounge: lounge.name,
      timestamp: new Date().toISOString(),
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
