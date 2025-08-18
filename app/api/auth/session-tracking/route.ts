// This file has been deprecated - session tracking is now handled by Supabase
// Keeping this endpoint for backward compatibility, but it does nothing

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Simply return success - Supabase handles all session tracking
  return NextResponse.json({ success: true });
}
