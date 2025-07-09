'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Session, User, AuthError } from '@supabase/supabase-js';

// User Profile interface
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  username?: string;
  created_at?: string;
  updated_at?: string;
  last_sign_in_at?: string;
}

// Authentication state interface
export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  error: AuthError | null;
}

// Authentication context interface
interface AuthContextType {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<{ error?: AuthError }>;
  signUp: (
    email: string,
    password: string,
    metadata?: any
  ) => Promise<{ error?: AuthError }>;
  signOut: () => Promise<{ error?: AuthError }>;
  signInWithOAuth: (provider: 'google') => Promise<void>;
  signInWithMagicLink: (
    email: string,
    redirectTo?: string
  ) => Promise<{ error?: AuthError }>;
  resetPassword: (email: string) => Promise<{ error?: AuthError }>;
  updateProfile: (
    updates: Partial<UserProfile>
  ) => Promise<{ error?: AuthError }>;
  refreshSession: () => Promise<{ error?: AuthError }>;
}

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Transform Supabase user to UserProfile
  const transformUser = (user: User | null): UserProfile | null => {
    if (!user) return null;

    return {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      username: user.user_metadata?.username || user.user_metadata?.user_name,
      created_at: user.created_at,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
    };
  };

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        setState((prev) => ({
          ...prev,
          session,
          user: session?.user || null,
          profile: transformUser(session?.user || null),
          loading: false,
          error: error || null,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error as AuthError,
        }));
      }
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setState((prev) => ({
        ...prev,
        session,
        user: session?.user || null,
        profile: transformUser(session?.user || null),
        loading: false,
        error: null,
      }));

      // Handle routing based on auth state
      if (event === 'SIGNED_IN') {
        router.refresh();
      } else if (event === 'SIGNED_OUT') {
        router.push('/');
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Password validation helper
  const validatePassword = (
    password: string,
    options: {
      minLength?: number;
      requireUppercase?: boolean;
      requireLowercase?: boolean;
      requireNumbers?: boolean;
      requireSpecialChar?: boolean;
    } = {}
  ) => {
    const {
      minLength = 8,
      requireUppercase = true,
      requireLowercase = true,
      requireNumbers = true,
      requireSpecialChar = true,
    } = options;

    const errors: string[] = [];

    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters long`);
    }

    if (requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (requireSpecialChar && !/[!@#$%^&*(),.?":{}|]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  };

  // Authentication methods
  const signIn = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    // Validate password
    const validation = validatePassword(password);
    if (!validation.isValid) {
      const error = { message: validation.errors.join(', ') } as AuthError;
      setState((prev) => ({ ...prev, loading: false, error }));
      return { error };
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      });

      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const signOut = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.signOut();
      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const signInWithOAuth: (provider: 'google') => Promise<void> = useCallback(
    async (provider) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));

        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) {
          throw error;
        }
      } catch (error) {
        const authError = error as AuthError;
        setState((prev) => ({ ...prev, loading: false, error: authError }));
        throw error;
      } finally {
        setState((prev) => ({ ...prev, loading: false }));
      }
    },
    [supabase]
  );

  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // First check if user is rate limited
      const rateLimitResponse = await fetch(
        `/api/auth/magic-link?email=${encodeURIComponent(email)}`
      );
      if (rateLimitResponse.ok) {
        const rateLimitData = await rateLimitResponse.json();
        if (rateLimitData.rateLimited) {
          const remainingTime = rateLimitData.remainingTime;
          const error = {
            message: `Rate limit exceeded. Please wait ${remainingTime} seconds before trying again.`,
          } as AuthError;
          setState((prev) => ({ ...prev, loading: false, error }));
          return { error };
        }
      }

      // Send magic link through our enhanced API
      const response = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMessage = data.message || 'Failed to send magic link';

        if (response.status === 429) {
          errorMessage =
            data.message ||
            'Too many requests. Please wait before trying again.';
        }

        const error = { message: errorMessage } as AuthError;
        setState((prev) => ({ ...prev, loading: false, error }));
        return { error };
      }

      // Success - magic link sent
      setState((prev) => ({ ...prev, loading: false, error: null }));
      return { error: undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const resetPassword = async (email: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.updateUser({
        data: updates,
      });

      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const refreshSession = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const { error } = await supabase.auth.refreshSession();
      setState((prev) => ({ ...prev, loading: false, error: error || null }));
      return { error: error || undefined };
    } catch (error) {
      const authError = error as AuthError;
      setState((prev) => ({ ...prev, loading: false, error: authError }));
      return { error: authError };
    }
  };

  const value: AuthContextType = {
    state,
    signIn,
    signUp,
    signOut,
    signInWithOAuth,
    signInWithMagicLink,
    resetPassword,
    updateProfile,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// Custom hooks
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser() {
  const { state } = useAuth();
  return state.user;
}

export function useSession() {
  const { state } = useAuth();
  return state.session;
}

export function useProfile() {
  const { state } = useAuth();
  return state.profile;
}

export function useAuthLoading() {
  const { state } = useAuth();
  return state.loading;
}

export function useAuthError() {
  const { state } = useAuth();
  return state.error;
}

export default useAuth;
