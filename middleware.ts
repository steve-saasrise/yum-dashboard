import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';

// Session configuration
const SESSION_CONFIG = {
  // Session timeout: 30 minutes default, 24 hours maximum
  DEFAULT_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // Auto-refresh when session expires in less than 5 minutes
  REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes in milliseconds

  // Protected routes that require curator authentication
  CURATOR_PROTECTED_ROUTES: ['/dashboard', '/profile', '/settings'],

  // Auth routes that should redirect if already authenticated
  AUTH_ROUTES: ['/auth/login', '/auth/signup', '/auth/forgot-password'],

  // Curator auth routes
  CURATOR_AUTH_ROUTES: ['/curator/login'],

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
    // Check if route requires curator authentication
    const isCuratorProtectedRoute =
      SESSION_CONFIG.CURATOR_PROTECTED_ROUTES.some((route) =>
        pathname.startsWith(route)
      );
    const isCuratorAuthRoute =
      SESSION_CONFIG.CURATOR_AUTH_ROUTES.includes(pathname);

    // For curator routes, check session cookie directly
    if (isCuratorProtectedRoute || isCuratorAuthRoute) {
      // Check if curator session exists
      const curatorSession = request.cookies.get('curator-session');
      const isAuthenticated = !!curatorSession;

      // Handle unauthenticated access to curator protected routes
      if (isCuratorProtectedRoute && !isAuthenticated) {
        const redirectUrl = new URL('/curator/login', origin);
        redirectUrl.searchParams.set('redirectTo', pathname);
        return NextResponse.redirect(redirectUrl);
      }

      // Handle authenticated access to curator auth routes
      if (isCuratorAuthRoute && isAuthenticated) {
        const redirectTo =
          request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
        return NextResponse.redirect(new URL(redirectTo, origin));
      }

      // For authenticated curators, continue with the request
      if (isAuthenticated) {
        return response;
      }
    }

    // For non-curator routes, use regular Supabase auth (commented out for now)
    // This preserves the existing auth flow if needed in the future
    /*
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

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    const isProtectedRoute = SESSION_CONFIG.PROTECTED_ROUTES.some((route) =>
      pathname.startsWith(route)
    );

    const isAuthRoute = SESSION_CONFIG.AUTH_ROUTES.includes(pathname);

    if (isProtectedRoute && (!session || error)) {
      const redirectUrl = new URL('/auth/login', origin);
      redirectUrl.searchParams.set('redirectTo', pathname);
      return NextResponse.redirect(redirectUrl);
    }
    */

    return response;
  } catch (error) {
    console.error('Middleware error:', error);

    // On middleware errors for curator protected routes, redirect to curator login
    const isCuratorProtectedRoute =
      SESSION_CONFIG.CURATOR_PROTECTED_ROUTES.some((route) =>
        pathname.startsWith(route)
      );

    if (isCuratorProtectedRoute) {
      const redirectUrl = new URL('/curator/login', origin);
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
