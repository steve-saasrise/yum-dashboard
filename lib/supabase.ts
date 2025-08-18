import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create browser client - let Supabase handle all session management
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
  );
}

// Simple error message helper
export function getAuthErrorMessage(
  error: { message?: string } | null
): string {
  if (!error) return 'An unknown error occurred';

  const message = error.message || 'Authentication failed';

  // Handle common error types with user-friendly messages
  if (message.includes('Invalid login credentials')) {
    return 'Invalid email or password';
  }

  if (message.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link';
  }

  if (message.includes('User already registered')) {
    return 'This email is already registered. Please sign in instead';
  }

  return message;
}

export default createBrowserSupabaseClient;
