import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const PASSWORD_RESET_EXPIRY = 60 * 60 * 1000; // 1 hour

export class CuratorPasswordResetService {
  static async createResetToken(email: string): Promise<string | null> {
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

    // Find curator by email
    const { data: curator, error: curatorError } = await supabase
      .from('curators')
      .select('id')
      .eq('email', email)
      .single();

    if (curatorError || !curator) {
      // Don't reveal if email exists or not
      return null;
    }

    // Generate token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY);

    // Delete any existing unused tokens for this curator
    await supabase
      .from('curator_password_resets')
      .update({ used: true })
      .eq('curator_id', curator.id)
      .eq('used', false);

    // Create new reset token
    const { error: insertError } = await supabase
      .from('curator_password_resets')
      .insert({
        curator_id: curator.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error creating reset token:', insertError);
      return null;
    }

    return token;
  }

  static async validateResetToken(
    token: string
  ): Promise<{ curatorId: string; email: string } | null> {
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

    // Find valid reset token
    const { data: reset, error } = await supabase
      .from('curator_password_resets')
      .select('curator_id, expires_at, curators!inner(email)')
      .eq('token', token)
      .eq('used', false)
      .single();

    if (error || !reset) {
      return null;
    }

    // Check if expired
    if (new Date(reset.expires_at) < new Date()) {
      return null;
    }

    return {
      curatorId: reset.curator_id,
      email: (reset as any).curators.email,
    };
  }

  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<boolean> {
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

    // Validate token first
    const validation = await this.validateResetToken(token);
    if (!validation) {
      return false;
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    const { error: updateError } = await supabase
      .from('curators')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', validation.curatorId);

    if (updateError) {
      console.error('Error updating password:', updateError);
      return false;
    }

    // Mark token as used
    await supabase
      .from('curator_password_resets')
      .update({ used: true })
      .eq('token', token);

    return true;
  }
}
