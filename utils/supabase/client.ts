import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database.types';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build time, these might not be available
  // Return a properly typed client that will fail gracefully
  if (!url || !key) {
    // This is safe because during static generation,
    // the client won't actually be used for API calls
    return createBrowserClient<Database>('', '');
  }

  return createBrowserClient<Database>(url, key);
}
