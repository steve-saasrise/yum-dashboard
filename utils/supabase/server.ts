import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from '@/types/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
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
              const modifiedOptions = { ...options };

              // For auth cookies, preserve Supabase's cookie settings
              // but ensure secure flag in production
              if (name.startsWith('sb-')) {
                if (process.env.NODE_ENV === 'production') {
                  modifiedOptions.secure = true;
                }
                modifiedOptions.sameSite = modifiedOptions.sameSite || 'lax';
                modifiedOptions.path = modifiedOptions.path || '/';
              }

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
