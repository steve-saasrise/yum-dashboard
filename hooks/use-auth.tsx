'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  createBrowserSupabaseClient,
  SessionUtils,
  SESSION_CONFIG,
} from '@/lib/supabase';
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
  role?: 'viewer' | 'curator' | 'admin';
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
  const sessionCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const activityUpdateInterval = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
    error: null,
  });

  // Transform Supabase user to UserProfile with database profile data
  const transformUser = async (
    user: User | null,
    options: { skipDatabaseFetch?: boolean } = {}
  ): Promise<UserProfile | null> => {
    if (!user) return null;

    // Create basic profile from user metadata
    const basicProfile: UserProfile = {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || user.user_metadata?.name,
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
      username: user.user_metadata?.username || user.user_metadata?.user_name,
      created_at: user.created_at,
      updated_at: new Date().toISOString(),
      last_sign_in_at: user.last_sign_in_at,
    };

    // Skip database fetch if requested, in non-browser environment, or disabled via env
    if (
      options.skipDatabaseFetch ||
      typeof window === 'undefined' ||
      process.env.NEXT_PUBLIC_SKIP_PROFILE_FETCH === 'true'
    ) {
      return basicProfile;
    }

    try {
      // Get user data from the consolidated users table
      const { data: userData } = await supabase
        .from('users')
        .select('role, full_name, avatar_url, username, updated_at')
        .eq('id', user.id)
        .single();

      if (userData) {
        return {
          ...basicProfile,
          full_name: userData.full_name || basicProfile.full_name,
          avatar_url: userData.avatar_url || basicProfile.avatar_url,
          username: userData.username || basicProfile.username,
          updated_at: userData.updated_at || basicProfile.updated_at,
          role: userData.role || 'viewer',
        };
      }

      return {
        ...basicProfile,
        role: 'viewer',
      };
    } catch (error: any) {
      // Handle abort error specifically
      if (error?.name === 'AbortError' || error?.message?.includes('timeout')) {
        console.warn('User profile fetch timed out, using basic profile');
      } else {
        console.error('AuthProvider: Error fetching user profile:', error);
      }

      return basicProfile;
    }
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

        // Check if session has timed out due to inactivity
        if (session && SessionUtils.hasSessionTimedOut()) {
          await SessionUtils.enhancedLogout(supabase);
          setState((prev) => ({
            ...prev,
            session: null,
            user: null,
            profile: null,
            loading: false,
            error: null,
          }));
          return;
        }

        // First, set the session immediately with a basic profile
        const basicProfile = await transformUser(session?.user || null, {
          skipDatabaseFetch: true,
        });

        setState((prev) => ({
          ...prev,
          session,
          user: session?.user || null,
          profile: basicProfile,
          loading: false,
          error: error || null,
        }));

        // Then fetch the full profile asynchronously without blocking
        if (session?.user) {
          transformUser(session.user)
            .then((fullProfile) => {
              if (fullProfile) {
                setState((prev) => ({
                  ...prev,
                  profile: fullProfile,
                }));
              }
            })
            .catch((err) => {
              console.warn('Failed to fetch full user profile:', err);
            });
        }

        // If we have a session, update last activity and start monitoring
        if (session) {
          SessionUtils.updateLastActivity();
          startSessionMonitoring(session);
        }
      } catch (error) {
        console.error('AuthProvider: Error in getInitialSession:', error);
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error as AuthError,
        }));
      }
    };

    // Start session monitoring for automatic refresh and timeout checking
    const startSessionMonitoring = (session: Session) => {
      // Clear any existing intervals
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      if (activityUpdateInterval.current) {
        clearInterval(activityUpdateInterval.current);
      }

      // Check session status every 30 seconds
      sessionCheckInterval.current = setInterval(async () => {
        const currentSession = state.session;
        if (!currentSession) return;

        // Check for inactivity timeout
        if (SessionUtils.hasSessionTimedOut()) {
          await handleSessionTimeout();
          return;
        }

        // Check if session needs refresh
        if (SessionUtils.isSessionNearExpiry(currentSession)) {
          await handleSessionRefresh();
        }
      }, 30000); // Check every 30 seconds

      // Update activity every 10 seconds when user is active
      activityUpdateInterval.current = setInterval(() => {
        SessionUtils.updateLastActivity();
      }, SESSION_CONFIG.SYNC_CHECK_INTERVAL);
    };

    // Handle session timeout
    const handleSessionTimeout = async () => {
      await SessionUtils.enhancedLogout(supabase);
      setState((prev) => ({
        ...prev,
        session: null,
        user: null,
        profile: null,
        error: { message: 'Session timed out due to inactivity' } as AuthError,
      }));
      router.push('/auth/login?reason=session_timeout');
    };

    // Handle session refresh
    const handleSessionRefresh = async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          await handleSessionTimeout();
        } else {
          SessionUtils.updateLastActivity();
        }
      } catch (error) {
        console.error('Session refresh error:', error);
        await handleSessionTimeout();
      }
    };

    // Listen for cross-tab logout events
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SESSION_CONFIG.STORAGE_KEYS.LOGOUT_EVENT && e.newValue) {
        setState((prev) => ({
          ...prev,
          session: null,
          user: null,
          profile: null,
          error: null,
        }));
        router.push('/');
      }
    };

    // Listen for user activity to update last activity timestamp
    const updateActivity = () => {
      if (state.session) {
        SessionUtils.updateLastActivity();
      }
    };

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    getInitialSession();

    // Add event listeners
    window.addEventListener('storage', handleStorageChange);
    activityEvents.forEach((event) => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // First, set the session immediately with a basic profile
      const basicProfile = await transformUser(session?.user || null, {
        skipDatabaseFetch: true,
      });

      setState((prev) => ({
        ...prev,
        session,
        user: session?.user || null,
        profile: basicProfile,
        loading: false,
        error: null,
      }));

      // Then fetch the full profile asynchronously without blocking
      if (session?.user) {
        transformUser(session.user)
          .then((fullProfile) => {
            if (fullProfile) {
              setState((prev) => ({
                ...prev,
                profile: fullProfile,
              }));
            }
          })
          .catch((err) => {
            console.warn(
              'Failed to fetch full user profile during auth state change:',
              err
            );
          });
      }

      // Update activity and start monitoring if we have a session
      if (session) {
        SessionUtils.updateLastActivity();
        startSessionMonitoring(session);
      } else {
        // Clear intervals when logged out
        if (sessionCheckInterval.current) {
          clearInterval(sessionCheckInterval.current);
          sessionCheckInterval.current = null;
        }
        if (activityUpdateInterval.current) {
          clearInterval(activityUpdateInterval.current);
          activityUpdateInterval.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();

      // Clear intervals
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
      }
      if (activityUpdateInterval.current) {
        clearInterval(activityUpdateInterval.current);
      }

      // Remove event listeners
      window.removeEventListener('storage', handleStorageChange);
      activityEvents.forEach((event) => {
        document.removeEventListener(event, updateActivity);
      });
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
      // Clear session monitoring intervals
      if (sessionCheckInterval.current) {
        clearInterval(sessionCheckInterval.current);
        sessionCheckInterval.current = null;
      }
      if (activityUpdateInterval.current) {
        clearInterval(activityUpdateInterval.current);
        activityUpdateInterval.current = null;
      }

      // Use enhanced logout with proper cleanup
      const { error } = await SessionUtils.enhancedLogout(supabase);

      // Clear local auth state regardless of logout result
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: (error as AuthError) || null,
      }));

      return { error: (error as AuthError) || undefined };
    } catch (error) {
      const authError = error as AuthError;
      // Still clear the local state even if logout failed
      setState((prev) => ({
        ...prev,
        user: null,
        session: null,
        profile: null,
        loading: false,
        error: authError,
      }));
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
      if (!state.user?.id) {
        throw new Error('User not authenticated');
      }

      // Update the users table with the new data
      const { error: updateError } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.user.id);

      if (updateError) {
        throw updateError;
      }

      // Update local state with the new profile data
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        profile: prev.profile ? { ...prev.profile, ...updates } : null,
      }));

      return { error: undefined };
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

      // Update last activity on successful refresh
      if (!error) {
        SessionUtils.updateLastActivity();
      }

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

// Enhanced session utilities hooks
export function useSessionInfo() {
  const { state } = useAuth();

  if (!state.session) {
    return {
      isAuthenticated: false,
      timeUntilExpiry: 0,
      isNearExpiry: false,
      isExpired: false,
    };
  }

  const timeUntilExpiry = SessionUtils.getTimeUntilExpiry(state.session);

  return {
    isAuthenticated: true,
    timeUntilExpiry,
    isNearExpiry: SessionUtils.isSessionNearExpiry(state.session),
    isExpired: SessionUtils.isSessionExpired(state.session),
    lastActivity: SessionUtils.getLastActivity(),
  };
}

export function useSessionTimeout() {
  const { state } = useAuth();

  return {
    hasTimedOut: SessionUtils.hasSessionTimedOut(),
    timeRemaining: Math.max(
      0,
      SESSION_CONFIG.DEFAULT_TIMEOUT -
        (Date.now() - SessionUtils.getLastActivity())
    ),
    isActive: !!state.session,
  };
}

export default useAuth;
