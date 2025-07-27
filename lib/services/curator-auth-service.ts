import { createServerClient } from '@supabase/ssr';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { cookies } from 'next/headers';
import type { Curator, CuratorSession } from '@/types/curator';

const CURATOR_SESSION_KEY = 'curator-session';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export class CuratorAuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  static async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static async createCurator(
    email: string,
    password: string
  ): Promise<Curator | null> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const passwordHash = await this.hashPassword(password);

    const { data, error } = await supabase
      .from('curators')
      .insert({
        email,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating curator:', error);
      return null;
    }

    return {
      id: data.id,
      email: data.email,
      is_admin: data.is_admin,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  static async login(
    email: string,
    password: string
  ): Promise<CuratorSession | null> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Get curator by email
    const { data: curator, error } = await supabase
      .from('curators')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !curator) {
      console.log('Curator not found for email:', email);
      return null;
    }

    console.log('Found curator:', curator.email);
    console.log('Password hash exists:', !!curator.password_hash);

    // Verify password
    const isValid = await this.verifyPassword(password, curator.password_hash);
    console.log('Password verification result:', isValid);

    if (!isValid) {
      return null;
    }

    // Create session
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_DURATION);

    const session: CuratorSession = {
      curator: {
        id: curator.id,
        email: curator.email,
        is_admin: curator.is_admin,
        created_at: curator.created_at,
        updated_at: curator.updated_at,
      },
      token,
      expires_at: expiresAt.toISOString(),
    };

    // Store session in cookie
    cookieStore.set(CURATOR_SESSION_KEY, JSON.stringify(session), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiresAt,
      path: '/',
    });

    return session;
  }

  static async logout(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(CURATOR_SESSION_KEY);
  }

  static async getCurrentCurator(): Promise<Curator | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(CURATOR_SESSION_KEY);

    if (!sessionCookie) {
      return null;
    }

    try {
      const session: CuratorSession = JSON.parse(sessionCookie.value);

      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        await this.logout();
        return null;
      }

      return session.curator;
    } catch (error) {
      console.error('Error parsing curator session:', error);
      return null;
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    const curator = await this.getCurrentCurator();
    return curator !== null;
  }
}
