import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

async function handleSignout() {
  const supabase = await createClient();

  // Sign out the user
  await supabase.auth.signOut();

  // Redirect to home page
  return NextResponse.redirect(
    new URL('/', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
  );
}

// Support both GET and POST methods
export async function GET() {
  return handleSignout();
}

export async function POST() {
  return handleSignout();
}
