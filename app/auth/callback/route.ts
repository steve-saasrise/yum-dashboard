import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // Use the configured app URL instead of extracting origin from request
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const code = searchParams.get('code');
  const type = searchParams.get('type');

  // For password reset, always redirect to reset-password page
  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/auth/reset-password?code=${code}`);
  }

  // Check for redirectTo first (our app's parameter), then next, then default to /dashboard
  const redirectTo =
    searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/dashboard';
  const error = searchParams.get('error');
  const error_description = searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    // OAuth error - redirecting to error page
    return NextResponse.redirect(
      `${origin}/auth/error?error=${encodeURIComponent(error)}&description=${encodeURIComponent(error_description || '')}`
    );
  }

  if (code) {
    try {
      const cookieStore = await cookies();

      // Create server client directly
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) => {
                  cookieStore.set(name, value, options);
                });
              } catch {
                // The `set` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
              }
            },
          },
        }
      );

      // Exchange the code for a session
      const { data, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        // Session exchange error - details in error redirect

        // Handle specific auth errors with user-friendly messages
        let userMessage = exchangeError.message;

        if (
          exchangeError.message?.includes('expired') ||
          exchangeError.message?.includes('invalid_grant')
        ) {
          userMessage =
            'This magic link has expired. Please request a new one.';
        } else if (exchangeError.message?.includes('Email link is invalid')) {
          userMessage =
            'This magic link is invalid or has already been used. Please request a new one.';
        } else if (exchangeError.message?.includes('rate limit')) {
          userMessage = 'Too many requests. Please wait before trying again.';
        } else if (
          exchangeError.message?.includes('Invalid login credentials')
        ) {
          userMessage = 'Invalid authentication. Please try again.';
        }

        return NextResponse.redirect(
          `${origin}/auth/error?error=session_exchange_failed&description=${encodeURIComponent(userMessage)}`
        );
      }

      if (data.user && data.session) {
        // Get or create user profile data
        const { error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        // If profile doesn't exist, create one
        if (profileError && profileError.code === 'PGRST116') {
          const { error: insertError } = await supabase
            .from('user_profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              full_name:
                data.user.user_metadata?.full_name ||
                data.user.user_metadata?.name,
              avatar_url:
                data.user.user_metadata?.avatar_url ||
                data.user.user_metadata?.picture,
              username:
                data.user.user_metadata?.username ||
                data.user.user_metadata?.user_name,
              provider: data.user.app_metadata?.provider,
              provider_id: data.user.user_metadata?.provider_id,
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            // Profile creation error - continuing anyway
            // Continue anyway, profile can be created later
          }
        }

        // Successful authentication - redirect to the intended page
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    } catch {
      if (process.env.NODE_ENV === 'development') {
        // Callback processing error - redirecting to error page
      }
      return NextResponse.redirect(
        `${origin}/auth/error?error=callback_processing_failed&description=${encodeURIComponent('Failed to process authentication callback')}`
      );
    }
  }

  // If we get here, something went wrong
  return NextResponse.redirect(
    `${origin}/auth/error?error=invalid_callback&description=${encodeURIComponent('Invalid authentication callback')}`
  );
}
