import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { Session } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser client for client-side operations
export const createBrowserSupabaseClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

// Legacy clients for backward compatibility
export const supabase = createBrowserSupabaseClient();

// Admin client for elevated permissions
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// OAuth provider configurations
export const oauthProviders = {
  google: {
    enabled: true,
    scopes: ['openid', 'email', 'profile'],
    additionalParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
  },
} as const;

export type OAuthProvider = keyof typeof oauthProviders;

// Authentication configuration
export const authConfig = {
  redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  providers: {
    google: {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      scopes: 'openid email profile',
    },
  },
  // Password requirements
  password: {
    minLength: 8,
    requireSpecialChar: true,
    requireNumber: true,
    requireUppercase: true,
  },
  // Session configuration
  session: {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    refreshThreshold: 60 * 60, // 1 hour
  },
  // Magic link configuration
  magicLink: {
    enabled: true,
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  },
  // OAuth-specific settings
  oauth: {
    // Enable PKCE for enhanced security (required for mobile apps)
    pkce: true,
    // Flow type (implicit or code)
    flowType: 'pkce' as const,
    // Redirect settings
    redirects: {
      success: '/dashboard',
      error: '/auth/error',
      signOut: '/',
    },
  },
};

// Helper function to get OAuth sign-in URL
export const getOAuthSignInUrl = async (
  provider: OAuthProvider,
  options?: {
    redirectTo?: string;
    scopes?: string;
  }
) => {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo:
        options?.redirectTo || authConfig.providers[provider].redirectTo,
      scopes: options?.scopes || authConfig.providers[provider].scopes,
    },
  });

  return { data, error };
};

// Authentication error types
export type AuthError = {
  message: string;
  status?: number;
  code?: string;
};

// User type with additional profile fields
export type UserProfile = {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  username?: string;
  created_at: string;
  updated_at: string;
  last_sign_in_at?: string;
  provider?: string;
  provider_id?: string;
};

// Authentication state type
export type AuthState = {
  user: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: AuthError | null;
};
