import { NextResponse } from 'next/server';

export async function GET() {
  // This test route has been disabled - LinkedIn testing moved to BrightData
  return NextResponse.json(
    {
      error: 'This test route has been disabled',
      message:
        'LinkedIn testing has been moved to /api/test-brightdata endpoint using BrightData instead of Apify',
    },
    { status: 400 }
  );
}
