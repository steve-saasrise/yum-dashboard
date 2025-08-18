import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redis } from '@/lib/redis';
import { z } from 'zod';

// Rate limit configuration
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const MAGIC_LINK_COOLDOWN = 60; // 1 minute between requests

// Input validation schema
const magicLinkSchema = z.object({
  email: z.string().email('Invalid email address'),
});

async function checkRateLimit(email: string, ip: string) {
  // If Redis is not configured, allow all requests (development)
  if (!redis) {
    console.warn('Redis not configured - rate limiting disabled');
    return { limited: false };
  }

  const key = `rate_limit:magic_link:${ip}:${email}`;

  try {
    // Get current count
    const count = await redis.get(key);

    if (count && parseInt(count as string) >= RATE_LIMIT_MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      return {
        limited: true,
        remainingSeconds: ttl > 0 ? ttl : RATE_LIMIT_WINDOW,
      };
    }

    // Check cooldown
    const cooldownKey = `cooldown:magic_link:${email}`;
    const cooldown = await redis.get(cooldownKey);
    if (cooldown) {
      const ttl = await redis.ttl(cooldownKey);
      return {
        limited: true,
        remainingSeconds: ttl > 0 ? ttl : MAGIC_LINK_COOLDOWN,
      };
    }

    // Increment counter
    const newCount = await redis.incr(key);
    if (newCount === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }

    // Set cooldown
    await redis.set(cooldownKey, '1', { ex: MAGIC_LINK_COOLDOWN });

    return { limited: false };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On Redis error, allow the request
    return { limited: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const validation = magicLinkSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const { email } = validation.data;

    // Get client IP for rate limiting
    const ip =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      '127.0.0.1';

    // Check rate limiting
    const { limited, remainingSeconds } = await checkRateLimit(email, ip);
    if (limited) {
      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Please wait ${remainingSeconds} seconds before trying again`,
        },
        { status: 429 }
      );
    }

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
              // Ignore cookie errors in Server Components
            }
          },
        },
      }
    );

    // Send magic link
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Magic link sent! Check your email.',
    });
  } catch (error) {
    console.error('Magic link error:', error);
    return NextResponse.json(
      { error: 'Failed to send magic link' },
      { status: 500 }
    );
  }
}
