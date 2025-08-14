import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
              // Ensure cookies work with Cloudflare proxy
              const modifiedOptions = { ...options };

              // Don't set domain to let browser handle it
              delete modifiedOptions.domain;

              // Always set secure in production
              if (process.env.NODE_ENV === 'production') {
                modifiedOptions.secure = true;
              }

              // Ensure SameSite is set for compatibility
              modifiedOptions.sameSite = modifiedOptions.sameSite || 'lax';

              cookieStore.set(name, value, modifiedOptions);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
