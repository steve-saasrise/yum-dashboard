import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Email configuration for magic links
export const emailConfig = {
  redirectTo: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
  resetPasswordRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password`,
};

// Rate limiting configuration
export const rateLimitConfig = {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  magicLinkCooldown: 60 * 1000, // 1 minute between magic link requests
};

// Magic link configuration
export const magicLinkConfig = {
  expiresIn: 3600, // 1 hour in seconds
  shouldCreateUser: true, // Create user if they don't exist
  data: {
    // Additional metadata can be added here
  },
};

// Authentication error helpers
export function getAuthErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';

  const message =
    error.message ||
    error.error_description ||
    error.error ||
    'Authentication failed';

  // Handle specific error types
  if (message.includes('expired') || message.includes('invalid_grant')) {
    return 'This magic link has expired. Please request a new one.';
  }

  if (message.includes('Email link is invalid')) {
    return 'This magic link is invalid or has already been used. Please request a new one.';
  }

  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many requests. Please wait before trying again.';
  }

  if (message.includes('Invalid login credentials')) {
    return 'Invalid authentication. Please try again.';
  }

  if (message.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link.';
  }

  if (message.includes('User already registered')) {
    return 'This email is already registered. Please sign in instead.';
  }

  // Return the original message if no specific handling is needed
  return message;
}

export function isExpiredLinkError(error: any): boolean {
  if (!error) return false;

  const message = error.message || error.error_description || error.error || '';
  return message.includes('expired') || message.includes('invalid_grant');
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const message = error.message || error.error_description || error.error || '';
  return (
    message.includes('rate limit') || message.includes('too many requests')
  );
}

// Create browser client
export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// OAuth provider configuration
export const oauthProviders = {
  google: {
    provider: 'google' as const,
    options: {
      redirectTo: emailConfig.emailRedirectTo,
      scopes: 'email profile',
    },
  },
};

// Auth configuration
export const authConfig = {
  providers: ['google', 'email'] as const,
  redirectTo: emailConfig.redirectTo,
  emailRedirectTo: emailConfig.emailRedirectTo,
  resetPasswordRedirectTo: emailConfig.resetPasswordRedirectTo,
};

// Helper function to handle magic link with enhanced configuration
export async function sendMagicLink(email: string, additionalOptions?: any) {
  const supabase = createBrowserSupabaseClient();

  return await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: emailConfig.emailRedirectTo,
      shouldCreateUser: magicLinkConfig.shouldCreateUser,
      data: magicLinkConfig.data,
      ...additionalOptions,
    },
  });
}

// Helper function to handle OAuth sign in
export async function signInWithOAuth(provider: keyof typeof oauthProviders) {
  const supabase = createBrowserSupabaseClient();
  const config = oauthProviders[provider];

  return await supabase.auth.signInWithOAuth({
    provider: config.provider,
    options: config.options,
  });
}

export default createBrowserSupabaseClient;
