// Proxy configuration for Cloudflare and Railway deployment
import { NextRequest } from 'next/server';

/**
 * Gets the actual origin URL considering proxy headers
 * This is crucial for proper cookie and redirect handling when behind Cloudflare proxy
 */
export function getOriginUrl(request: NextRequest): string {
  // Check for Cloudflare headers first
  const cfHost = request.headers.get('cf-connecting-ip');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host');

  // Determine the actual protocol (Cloudflare terminates SSL)
  const protocol =
    forwardedProto ||
    (cfHost ? 'https' : 'http') ||
    (request.url.startsWith('https') ? 'https' : 'http');

  // Determine the actual host
  const actualHost = forwardedHost || host || 'localhost:3000';

  // In production, prefer the configured URL if available
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_APP_URL
  ) {
    // But ensure we're using HTTPS if behind Cloudflare
    const configuredUrl = new URL(process.env.NEXT_PUBLIC_APP_URL);
    if (forwardedProto === 'https' || cfHost) {
      configuredUrl.protocol = 'https:';
    }
    return configuredUrl.toString().replace(/\/$/, ''); // Remove trailing slash
  }

  return `${protocol}://${actualHost}`;
}

/**
 * Cookie configuration for Cloudflare proxy compatibility
 */
export function getCookieOptions(isAuthCookie: boolean = false) {
  const isProduction = process.env.NODE_ENV === 'production';

  const baseOptions: any = {
    path: '/',
    sameSite: 'lax' as const,
    httpOnly: false, // Must be false for client-side access
  };

  // In production or for auth cookies, always use secure
  if (isProduction || isAuthCookie) {
    baseOptions.secure = true;
  }

  // For auth cookies, set extended expiry
  if (isAuthCookie) {
    baseOptions.maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
  }

  // Don't set domain - let browser handle it for better proxy compatibility
  // This prevents cookie domain mismatches with Cloudflare proxy

  return baseOptions;
}

/**
 * Checks if the request is coming through a proxy
 */
export function isProxiedRequest(request: NextRequest): boolean {
  return !!(
    request.headers.get('x-forwarded-proto') ||
    request.headers.get('x-forwarded-host') ||
    request.headers.get('x-forwarded-for') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('cf-ray')
  );
}

/**
 * Gets the real client IP considering proxy headers
 */
export function getClientIp(request: NextRequest): string | null {
  // Cloudflare specific header
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) return cfIp;

  // Standard proxy headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return null;
}
