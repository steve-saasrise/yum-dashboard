'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import type { Session, User, AuthError } from '@supabase/supabase-js';

// Simplified User Profile interface
export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  username?: string;
  role?: 'viewer' | 'curator' | 'admin';
  created_at?: string;
  last_sign_in_at?: string;
}

// Simplified Authentication state interface
export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
}

// Simplified Authentication context interface
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
  signInWithMagicLink: (email: string) => Promise<{ error?: AuthError }>;
  resetPassword: (email: string) => Promise<{ error?: AuthError }>;
  updateProfile: (
    updates: Partial<UserProfile>
  ) => Promise<{ error?: AuthError }>;
}

// Create Auth Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component - SIMPLIFIED VERSION
export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    loading: true,
  });

  // Initialize auth state
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Create basic profile from session
        const basicProfile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name,
          avatar_url: session.user.user_metadata?.avatar_url,
          username: session.user.user_metadata?.username,
          role: session.user.user_metadata?.role || 'viewer',
        };

        setState({
          user: session.user,
          session,
          profile: basicProfile,
          loading: false,
        });

        // Fetch full profile asynchronously (won't block)
        fetchUserProfile(session.user.id);
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    // Listen for auth changes - KEEP IT SIMPLE
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_OUT') {
        setState({
          user: null,
          session: null,
          profile: null,
          loading: false,
        });
        router.push('/');
      } else if (session) {
        // Update state with basic info immediately
        const basicProfile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          full_name: session.user.user_metadata?.full_name,
          avatar_url: session.user.user_metadata?.avatar_url,
          username: session.user.user_metadata?.username,
          role: session.user.user_metadata?.role || 'viewer',
        };

        setState({
          user: session.user,
          session,
          profile: basicProfile,
          loading: false,
        });

        // Fetch full profile asynchronously
        if (event === 'SIGNED_IN') {
          fetchUserProfile(session.user.id);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch user profile from database (non-blocking)
  const fetchUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('users')
        .select('role, full_name, avatar_url, username')
        .eq('id', userId)
        .single();

      if (data) {
        setState((prev) => ({
          ...prev,
          profile: prev.profile
            ? {
                ...prev.profile,
                role: data.role || prev.profile.role,
                full_name: data.full_name || prev.profile.full_name,
                avatar_url: data.avatar_url || prev.profile.avatar_url,
                username: data.username || prev.profile.username,
              }
            : null,
        }));
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // Authentication methods - SIMPLIFIED
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error || undefined };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata || {},
        },
      });
      return { error: error || undefined };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error || undefined };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const signInWithOAuth = async (provider: 'google') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      throw error;
    }
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      return { error: error || undefined };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      return { error: error || undefined };
    } catch (error) {
      return { error: error as AuthError };
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    try {
      if (!state.user?.id) {
        throw new Error('User not authenticated');
      }

      const { error } = await supabase
        .from('users')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.user.id);

      if (error) throw error;

      // Update local state
      setState((prev) => ({
        ...prev,
        profile: prev.profile ? { ...prev.profile, ...updates } : null,
      }));

      return { error: undefined };
    } catch (error) {
      return { error: error as AuthError };
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

export default useAuth;
