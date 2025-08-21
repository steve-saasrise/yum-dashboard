import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Check authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  const isAuthorized = cronSecret ? 
    authHeader === `Bearer ${cronSecret}` : 
    process.env.NODE_ENV === 'development';

  if (!isAuthorized) {
    return NextResponse.json({ 
      error: 'Unauthorized',
      hint: 'Check your CRON_SECRET' 
    }, { status: 401 });
  }

  // Test basic environment
  const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasSupabaseKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasBrightDataKey = !!process.env.BRIGHTDATA_API_KEY;
  
  return NextResponse.json({
    success: true,
    message: 'LinkedIn cron endpoint is accessible',
    environment: {
      hasSupabaseUrl,
      hasSupabaseKey,
      hasBrightDataKey,
      nodeEnv: process.env.NODE_ENV || 'not set',
    },
    timestamp: new Date().toISOString(),
  });
}