import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { CuratorAuthService } from './curator-auth-service';

const INVITE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface CuratorInvite {
  id: string;
  email: string;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  inviter?: {
    email: string;
  };
}

export class CuratorInviteService {
  static async createInvite(
    email: string,
    invitedBy: string
  ): Promise<string | null> {
    // Use service role for admin operations to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if curator already exists
    console.log('Checking for existing curator with email:', email);
    const { data: existingCurator, error: curatorError } = await supabase
      .from('curators')
      .select('id')
      .eq('email', email)
      .single();

    if (curatorError && curatorError.code !== 'PGRST116') {
      console.error('Error checking existing curator:', curatorError);
    }

    if (existingCurator) {
      console.log('Curator already exists');
      throw new Error('A curator with this email already exists');
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from('curator_invites')
      .select('id')
      .eq('email', email)
      .is('accepted_at', null)
      .single();

    if (existingInvite) {
      console.log('Pending invite already exists');
      throw new Error('An invite for this email already exists');
    }

    // Generate invite token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY);

    console.log('Creating invite for:', email);
    // Create invite
    const { error } = await supabase.from('curator_invites').insert({
      email,
      token,
      invited_by: invitedBy,
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('Error creating invite:', error);
      return null;
    }

    console.log('Invite created successfully');

    return token;
  }

  static async validateInvite(token: string): Promise<CuratorInvite | null> {
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

    const { data: invite, error } = await supabase
      .from('curator_invites')
      .select('*, inviter:curators!invited_by(email)')
      .eq('token', token)
      .is('accepted_at', null)
      .single();

    if (error || !invite) {
      return null;
    }

    // Check if expired
    if (new Date(invite.expires_at) < new Date()) {
      return null;
    }

    return invite as any;
  }

  static async acceptInvite(token: string, password: string): Promise<boolean> {
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

    // Validate invite
    const invite = await this.validateInvite(token);
    if (!invite) {
      return false;
    }

    // Create curator account
    const curator = await CuratorAuthService.createCurator(
      invite.email,
      password
    );
    if (!curator) {
      return false;
    }

    // Mark invite as accepted
    await supabase
      .from('curator_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('token', token);

    return true;
  }

  static async listInvites(includeAccepted = false): Promise<CuratorInvite[]> {
    // Use service role for admin operations to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let query = supabase
      .from('curator_invites')
      .select('*, inviter:curators!invited_by(email)')
      .order('created_at', { ascending: false });

    if (!includeAccepted) {
      query = query.is('accepted_at', null);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error listing invites:', error);
      return [];
    }

    return data as any;
  }

  static async deleteInvite(inviteId: string): Promise<boolean> {
    // Use service role for admin operations to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from('curator_invites')
      .delete()
      .eq('id', inviteId)
      .is('accepted_at', null);

    return !error;
  }
}
