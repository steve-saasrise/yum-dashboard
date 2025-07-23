import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Session configuration
const SESSION_CONFIG = {
  // Session timeout: 30 minutes default, 24 hours maximum
  DEFAULT_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // Auto-refresh when session expires in less than 5 minutes
  REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes in milliseconds

  // Protected routes that require authentication
  PROTECTED_ROUTES: ['/dashboard', '/profile', '/settings'],

  // Auth routes that should redirect if already authenticated
  AUTH_ROUTES: ['/auth/login', '/auth/signup', '/auth/forgot-password'],

  // Public routes that don't require any checks
  PUBLIC_ROUTES: ['/', '/auth/callback', '/auth/error', '/api/health'],
};

// Security headers
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = NextResponse.next();

  // Add security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Skip session checks for API routes (except auth APIs) and static files
  if (
    (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return response;
  }

  // Skip checks for public routes
  if (SESSION_CONFIG.PUBLIC_ROUTES.includes(pathname)) {
    return response;
  }

  try {
    // Create Supabase server client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    // Get current session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    // Check if route is protected
    const isProtectedRoute = SESSION_CONFIG.PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    // Check if route is auth-only (should redirect if authenticated)
    const isAuthRoute = SESSION_CONFIG.AUTH_ROUTES.includes(pathname);

    // Handle unauthenticated access to protected routes
    if (isProtectedRoute && (!session || error)) {
      const redirectUrl = new URL('/auth/login', origin);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Handle authenticated access to auth routes
    if (isAuthRoute && session && !error) {
      const redirectTo =
        request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, origin));
    }

    // Session validation and refresh logic for authenticated users
    if (session && !error) {
      const now = Date.now();
      const sessionExpiry = new Date(session.expires_at! * 1000).getTime();
      const timeUntilExpiry = sessionExpiry - now;

      // Check if session has expired
      if (timeUntilExpiry <= 0) {
        // Clear auth cookies
        response.cookies.delete('sb-access-token');
        response.cookies.delete('sb-refresh-token');

        const redirectUrl = new URL('/auth/login', origin);
        redirectUrl.searchParams.set('redirectTo', pathname);
        redirectUrl.searchParams.set('reason', 'session_expired');
        return NextResponse.redirect(redirectUrl);
      }

      // Auto-refresh if session expires soon (within 5 minutes)
      if (timeUntilExpiry <= SESSION_CONFIG.REFRESH_THRESHOLD) {
        try {
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession();

          if (refreshError || !refreshData.session) {
            // Clear auth cookies
            response.cookies.delete('sb-access-token');
            response.cookies.delete('sb-refresh-token');

            const redirectUrl = new URL('/auth/login', origin);
            redirectUrl.searchParams.set('redirectTo', pathname);
            redirectUrl.searchParams.set('reason', 'refresh_failed');
            return NextResponse.redirect(redirectUrl);
          }
        } catch (refreshError) {
          console.error('Session refresh error:', refreshError);

          // On refresh error for protected routes, redirect to login
          if (isProtectedRoute) {
            const redirectUrl = new URL('/auth/login', origin);
            redirectUrl.searchParams.set('redirectTo', pathname);
            redirectUrl.searchParams.set('reason', 'refresh_error');
            return NextResponse.redirect(redirectUrl);
          }
        }
      }

      // Note: Inactivity timeout is handled client-side in the AuthProvider
      // No need for additional session duration checks here

      // Add session info to response headers for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        response.headers.set(
          'X-Session-Expires-In',
          Math.floor(timeUntilExpiry / 1000).toString()
        );
        response.headers.set('X-Session-User-Id', session.user.id);
      }
    }

    return response;
  } catch (error) {
    console.error('Middleware error:', error);

    // On middleware errors for protected routes, redirect to login
    const isProtectedRoute = SESSION_CONFIG.PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    if (isProtectedRoute) {
      const redirectUrl = new URL('/auth/login', origin);
      redirectUrl.searchParams.set('redirectTo', pathname);
      redirectUrl.searchParams.set('reason', 'middleware_error');
      return NextResponse.redirect(redirectUrl);
    }

    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
