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

  // Create response first
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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
              // Check if this is an auth cookie and if Remember Me is enabled
              const isAuthCookie = name.startsWith('sb-');

              // For auth cookies, extend the max age if we detect a persistent session
              if (isAuthCookie && options) {
                // Set 1-year expiry for auth cookies in persistent sessions (Facebook-style)
                options.maxAge = 365 * 24 * 60 * 60; // 365 days in seconds
              }

              // Set cookies on both request and response
              request.cookies.set({ name, value, ...options });
              response.cookies.set({ name, value, ...options });
            });
          },
        },
      }
    );

    // IMPORTANT: Always use getUser() in middleware, never getSession()
    // getUser() sends a request to the Supabase Auth server to validate the token
    // First refresh the session to ensure it's valid
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const isProtectedRoute = SESSION_CONFIG.PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    const isAuthRoute = SESSION_CONFIG.AUTH_ROUTES.includes(pathname);

    // Redirect to login if accessing protected route without valid user
    if (isProtectedRoute && (!user || error)) {
      const redirectUrl = new URL('/auth/login', origin);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect to dashboard if accessing auth route with authenticated user
    if (isAuthRoute && user && !error) {
      const redirectTo =
        request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, origin));
    }

    // For curator login routes, redirect to regular login
    if (pathname.startsWith('/curator/')) {
      const redirectUrl = new URL('/auth/login', origin);
      if (pathname !== '/curator/login') {
        redirectUrl.searchParams.set(
          'redirectTo',
          pathname.replace('/curator', '')
        );
      }
      return NextResponse.redirect(redirectUrl);
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
