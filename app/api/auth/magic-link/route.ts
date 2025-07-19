import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  rateLimitConfig,
  magicLinkConfig,
  getAuthErrorMessage,
  isRateLimitError,
} from '@/lib/supabase';
import { z } from 'zod';

// Rate limiting storage (in production, use Redis or a database)
const rateLimitStore = new Map<
  string,
  { count: number; resetTime: number; lastRequest: number }
>();

// Clean up old entries every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of rateLimitStore.entries()) {
      if (now > value.resetTime) {
        rateLimitStore.delete(key);
      }
    }
  },
  10 * 60 * 1000
);

// Input validation schema
const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
  redirectTo: z.string().url().optional(),
});

function getRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email}`;
}

function isRateLimited(key: string): { limited: boolean; resetTime?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return { limited: false };
  }

  // Reset if window has expired
  if (now > entry.resetTime) {
    rateLimitStore.delete(key);
    return { limited: false };
  }

  // Check if within cooldown period
  if (now - entry.lastRequest < rateLimitConfig.magicLinkCooldown) {
    return {
      limited: true,
      resetTime: entry.lastRequest + rateLimitConfig.magicLinkCooldown,
    };
  }

  // Check if max attempts exceeded
  if (entry.count >= rateLimitConfig.maxAttempts) {
    return { limited: true, resetTime: entry.resetTime };
  }

  return { limited: false };
}

function updateRateLimit(key: string): void {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + rateLimitConfig.windowMs,
      lastRequest: now,
    });
  } else {
    rateLimitStore.set(key, {
      count: entry.count + 1,
      resetTime: entry.resetTime,
      lastRequest: now,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = magicLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors.map((e) => e.message),
        },
        { status: 400 }
      );
    }

    const { email, redirectTo } = validation.data;

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimitKey = getRateLimitKey(ip, email);

    // Check rate limiting
    const { limited, resetTime } = isRateLimited(rateLimitKey);
    if (limited) {
      const remainingTime = resetTime
        ? Math.ceil((resetTime - Date.now()) / 1000)
        : 60;
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please wait ${remainingTime} seconds before trying again.`,
          retryAfter: remainingTime,
        },
        {
          status: 429,
          headers: {
            'Retry-After': remainingTime.toString(),
          },
        }
      );
    }

    // Update rate limit counter
    updateRateLimit(rateLimitKey);

    // Create Supabase server client
    const cookieStore = await cookies();
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

    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          redirectTo ||
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
        shouldCreateUser: magicLinkConfig.shouldCreateUser,
        data: {
          ...magicLinkConfig.data,
          timestamp: new Date().toISOString(),
          source: 'magic-link-api',
        },
      },
    });

    if (error) {
      // Error logging removed - error details are captured in the response

      // Return user-friendly error message
      const userMessage = getAuthErrorMessage(error);

      // Don't increment rate limit for certain errors
      if (isRateLimitError(error)) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: userMessage,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Magic link failed',
          message: userMessage,
        },
        { status: 400 }
      );
    }

    // Success response
    return NextResponse.json({
      success: true,
      message: 'Magic link sent successfully',
      email,
      expiresIn: magicLinkConfig.expiresIn,
    });
  } catch {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check rate limit status
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    const rateLimitKey = getRateLimitKey(ip, email);
    const { limited, resetTime } = isRateLimited(rateLimitKey);

    return NextResponse.json({
      email,
      rateLimited: limited,
      resetTime: resetTime || null,
      remainingTime: resetTime
        ? Math.max(0, Math.ceil((resetTime - Date.now()) / 1000))
        : 0,
    });
  } catch {
    // Rate limit check failed
    return NextResponse.json(
      { error: 'Failed to check rate limit' },
      { status: 500 }
    );
  }
}
