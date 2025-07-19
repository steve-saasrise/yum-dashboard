import { createBrowserClient } from '@supabase/ssr';

// Supabase configuration
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Session configuration constants
export const SESSION_CONFIG = {
  // Session timeout: 30 minutes default, 24 hours maximum
  DEFAULT_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds
  MAX_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds

  // Auto-refresh when session expires in less than 5 minutes
  REFRESH_THRESHOLD: 5 * 60 * 1000, // 5 minutes in milliseconds

  // Cross-tab session sync check interval
  SYNC_CHECK_INTERVAL: 10 * 1000, // 10 seconds

  // Session storage keys for cross-tab sync
  STORAGE_KEYS: {
    SESSION_STATE: 'supabase_session_state',
    LAST_ACTIVITY: 'supabase_last_activity',
    LOGOUT_EVENT: 'supabase_logout_event',
  },
};

// Session utilities
export const SessionUtils = {
  // Check if session is near expiry
  isSessionNearExpiry: (session: { expires_at?: number } | null): boolean => {
    if (!session?.expires_at) return false;

    const now = Date.now();
    const sessionExpiry = new Date(session.expires_at * 1000).getTime();
    const timeUntilExpiry = sessionExpiry - now;

    return timeUntilExpiry <= SESSION_CONFIG.REFRESH_THRESHOLD;
  },

  // Check if session has expired
  isSessionExpired: (session: { expires_at?: number } | null): boolean => {
    if (!session?.expires_at) return false;

    const now = Date.now();
    const sessionExpiry = new Date(session.expires_at * 1000).getTime();

    return now >= sessionExpiry;
  },

  // Get time until session expires (in milliseconds)
  getTimeUntilExpiry: (session: { expires_at?: number } | null): number => {
    if (!session?.expires_at) return 0;

    const now = Date.now();
    const sessionExpiry = new Date(session.expires_at * 1000).getTime();

    return Math.max(0, sessionExpiry - now);
  },

  // Update last activity timestamp
  updateLastActivity: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY,
        Date.now().toString()
      );
    }
  },

  // Get last activity timestamp
  getLastActivity: (): number => {
    if (typeof window === 'undefined') return Date.now();

    const lastActivity = localStorage.getItem(
      SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY
    );
    return lastActivity ? parseInt(lastActivity, 10) : Date.now();
  },

  // Check if session has timed out due to inactivity
  hasSessionTimedOut: (): boolean => {
    const lastActivity = SessionUtils.getLastActivity();
    const timeSinceActivity = Date.now() - lastActivity;

    return timeSinceActivity > SESSION_CONFIG.DEFAULT_TIMEOUT;
  },

  // Trigger cross-tab logout event
  triggerCrossTabLogout: (): void => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT,
        Date.now().toString()
      );
      // Clear the event after a short delay to allow other tabs to detect it
      setTimeout(() => {
        localStorage.removeItem(SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT);
      }, 1000);
    }
  },

  // Clear all session-related storage
  clearSessionStorage: (): void => {
    if (typeof window !== 'undefined') {
      Object.values(SESSION_CONFIG.STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
      });
    }
  },

  // Enhanced logout with proper cleanup
  enhancedLogout: async (supabaseClient: {
    auth: { signOut: () => Promise<{ error?: unknown }> };
  }): Promise<{ error?: unknown }> => {
    try {
      // Clear local storage first
      SessionUtils.clearSessionStorage();

      // Trigger cross-tab logout
      SessionUtils.triggerCrossTabLogout();

      // Sign out from Supabase
      const { error } = await supabaseClient.auth.signOut();

      // Clear any remaining cookies/storage
      if (typeof window !== 'undefined') {
        // Clear any auth-related items from sessionStorage
        sessionStorage.clear();

        // Clear specific cookies if accessible
        try {
          document.cookie.split(';').forEach((c) => {
            const eqPos = c.indexOf('=');
            const name = eqPos > -1 ? c.substr(0, eqPos) : c;
            if (name.trim().startsWith('sb-')) {
              document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            }
          });
        } catch {
          // Cookie clearing may fail in some browsers, but that's okay
          // Cookie clearing may fail in some browsers, but that's okay
        }
      }

      return { error };
    } catch (error) {
      // Enhanced logout error - handled by return
      return { error };
    }
  },
};

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
export function getAuthErrorMessage(
  error: {
    message?: string;
    code?: string;
    name?: string;
    error_description?: string;
    error?: string;
  } | null
): string {
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

export function isExpiredLinkError(
  error: {
    message?: string;
    code?: string;
    error_description?: string;
    error?: string;
  } | null
): boolean {
  if (!error) return false;

  const message = error.message || error.error_description || error.error || '';
  return message.includes('expired') || message.includes('invalid_grant');
}

export function isRateLimitError(
  error: {
    message?: string;
    code?: string;
    status?: number;
    error_description?: string;
    error?: string;
  } | null
): boolean {
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
export async function sendMagicLink(
  email: string,
  additionalOptions?: {
    captchaToken?: string;
    shouldCreateUser?: boolean;
    data?: Record<string, unknown>;
  }
) {
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
