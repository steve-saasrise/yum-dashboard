import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Use the actual host from request headers for better proxy compatibility
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`;
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
                  // For auth cookies, extend the max age for persistent sessions
                  const isAuthCookie = name.startsWith('sb-');
                  if (isAuthCookie && options) {
                    // Set 1-year expiry for auth cookies (Facebook-style)
                    options.maxAge = 365 * 24 * 60 * 60; // 365 days in seconds

                    // Preserve domain if set by Supabase for cookie chunking
                    // Always set secure in production or with HTTPS
                    const isProduction = process.env.NODE_ENV === 'production';
                    const isHttps =
                      request.headers.get('x-forwarded-proto') === 'https';
                    if (isProduction || isHttps) {
                      options.secure = true;
                    }
                    options.sameSite = options.sameSite || 'lax';
                    options.path = options.path || '/';
                  }
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
        // The user will be automatically created in the users table by the trigger
        // Let's fetch the user's role and update their metadata for immediate access
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', data.user.id)
            .single();

          if (userData?.role) {
            // Update the user's metadata to include the role
            // This makes the role immediately available without database queries
            await supabase.auth.updateUser({
              data: { role: userData.role },
            });
          }
        } catch (roleError) {
          // If we can't fetch the role, continue anyway
          console.error('Failed to fetch user role:', roleError);
        }

        // Session tracking will be handled by the useSessionTracking hook on the client side
        // after the redirect completes

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
