import { createClient } from '@supabase/supabase-js';
import { UAParser } from 'ua-parser-js';
import crypto from 'crypto';

// Create admin client for server-side operations
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

const getSupabaseAdmin = () => {
  if (supabaseAdmin) return supabaseAdmin;

  // Check if we're on the server side
  if (typeof window !== 'undefined') {
    throw new Error('SecurityService should only be used on the server side');
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing Supabase environment variables for SecurityService');
    throw new Error('Missing Supabase environment variables');
  }

  supabaseAdmin = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdmin;
};

export interface SecurityCheckResult {
  requiresReAuth: boolean;
  reason?: string;
  lastVerifiedAt?: Date;
}

export interface DeviceInfo {
  device_type: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_fingerprint: string;
  device_name?: string;
}

export class SecurityService {
  private static readonly REAUTH_THRESHOLD_MINUTES = 15;
  private static readonly MAX_FAILED_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION_MINUTES = 30;

  static async trackDeviceSession(
    userId: string,
    sessionId: string,
    userAgent: string,
    ipAddress: string,
    isNewDevice: boolean = false
  ) {
    try {
      const deviceInfo = this.parseUserAgent(userAgent);
      const fingerprint = this.generateDeviceFingerprint(userAgent, ipAddress);

      console.log('Tracking device session:', {
        userId,
        deviceInfo,
        fingerprint: fingerprint.substring(0, 10) + '...',
      });

      // Check if this device already exists
      const { data: existingDevice } = await getSupabaseAdmin()
        .from('device_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('device_fingerprint', fingerprint)
        .single();

      if (existingDevice) {
        // Update existing device session
        console.log('Updating existing device session:', existingDevice.id);
        const { error: updateError } = await getSupabaseAdmin()
          .from('device_sessions')
          .update({
            session_id: sessionId,
            last_active: new Date().toISOString(),
            ip_address: ipAddress,
            is_current: true,
          })
          .eq('id', (existingDevice as any).id);

        if (updateError) {
          console.error('Error updating device session:', updateError);
        }
      } else {
        // Create new device session
        const location = await this.getLocationFromIP(ipAddress);

        const sessionData = {
          user_id: userId,
          session_id: sessionId,
          ...deviceInfo,
          ip_address: ipAddress,
          location,
          device_fingerprint: fingerprint,
          is_current: true,
        };

        console.log(
          'Creating new device session with data:',
          JSON.stringify(sessionData, null, 2)
        );
        const { error: insertError } = await getSupabaseAdmin()
          .from('device_sessions')
          .insert(sessionData);

        if (insertError) {
          console.error(
            'Error inserting device session:',
            JSON.stringify(insertError, null, 2)
          );
        } else {
          console.log('Device session created successfully');
        }

        // Log new device login event
        await this.logSecurityEvent(
          userId,
          'new_device_login',
          'warning',
          'New device login detected',
          { device_info: deviceInfo, location },
          ipAddress,
          userAgent
        );

        // Send email alert for new device
        if (isNewDevice) {
          await this.sendSecurityAlert(userId, 'new_device', {
            device: deviceInfo,
            location,
            ip: ipAddress,
          });
        }
      }

      // Mark other sessions as not current
      await getSupabaseAdmin()
        .from('device_sessions')
        .update({ is_current: false })
        .eq('user_id', userId)
        .neq('session_id', sessionId);
    } catch (error) {
      console.error('Error tracking device session:', error);
    }
  }

  static async logSecurityEvent(
    userId: string,
    eventType: string,
    severity: 'info' | 'warning' | 'critical',
    description: string,
    metadata: any = {},
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const location = ipAddress
        ? await this.getLocationFromIP(ipAddress)
        : null;

      await getSupabaseAdmin().from('security_events').insert({
        user_id: userId,
        event_type: eventType,
        severity,
        description,
        metadata,
        ip_address: ipAddress,
        user_agent: userAgent,
        location,
        session_id: metadata.session_id,
      });
    } catch (error) {
      console.error('Error logging security event:', error);
    }
  }

  static async checkForReAuthentication(
    userId: string
  ): Promise<SecurityCheckResult> {
    try {
      const { data: user } = await getSupabaseAdmin()
        .from('users')
        .select('last_password_verified_at')
        .eq('id', userId)
        .single();

      if (!user?.last_password_verified_at) {
        return { requiresReAuth: true, reason: 'No recent authentication' };
      }

      const lastVerified = new Date(user.last_password_verified_at as string);
      const minutesSinceVerification =
        (Date.now() - lastVerified.getTime()) / (1000 * 60);

      if (minutesSinceVerification > this.REAUTH_THRESHOLD_MINUTES) {
        return {
          requiresReAuth: true,
          reason: 'Authentication expired',
          lastVerifiedAt: lastVerified,
        };
      }

      return { requiresReAuth: false, lastVerifiedAt: lastVerified };
    } catch (error) {
      console.error('Error checking re-authentication:', error);
      return {
        requiresReAuth: true,
        reason: 'Error checking authentication status',
      };
    }
  }

  static async updatePasswordVerification(userId: string) {
    try {
      await getSupabaseAdmin()
        .from('users')
        .update({
          last_password_verified_at: new Date().toISOString(),
          last_sensitive_action_at: new Date().toISOString(),
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error updating password verification:', error);
    }
  }

  static async checkSuspiciousActivity(
    userId: string,
    ipAddress: string
  ): Promise<boolean> {
    try {
      // Check for concurrent logins from different locations
      const { data: recentSessions } = await getSupabaseAdmin()
        .from('device_sessions')
        .select('ip_address, location, last_active')
        .eq('user_id', userId)
        .gte(
          'last_active',
          new Date(Date.now() - 60 * 60 * 1000).toISOString()
        ); // Last hour

      if (recentSessions && recentSessions.length > 1) {
        const uniqueLocations = new Set(
          recentSessions
            .map((s) => (s.location as any)?.country)
            .filter(Boolean)
        );

        if (uniqueLocations.size > 1) {
          await this.logSecurityEvent(
            userId,
            'concurrent_login',
            'warning',
            'Concurrent logins from different countries detected',
            { locations: Array.from(uniqueLocations) },
            ipAddress
          );
          return true;
        }
      }

      // Check for rapid IP changes
      const { data: recentEvents } = await getSupabaseAdmin()
        .from('security_events')
        .select('ip_address, created_at')
        .eq('user_id', userId)
        .eq('event_type', 'login')
        .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()) // Last 30 minutes
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentEvents && recentEvents.length >= 3) {
        const uniqueIPs = new Set(recentEvents.map((e) => e.ip_address));
        if (uniqueIPs.size >= 3) {
          await this.logSecurityEvent(
            userId,
            'suspicious_login_pattern',
            'critical',
            'Multiple login attempts from different IPs',
            { ip_addresses: Array.from(uniqueIPs) },
            ipAddress
          );
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking suspicious activity:', error);
      return false;
    }
  }

  static async handleFailedLogin(email: string, ipAddress: string) {
    try {
      const { data: user } = await getSupabaseAdmin()
        .from('users')
        .select('id, failed_login_attempts, account_locked_until')
        .eq('email', email)
        .single();

      if (!user) return;

      // Check if account is currently locked
      if (
        user.account_locked_until &&
        new Date(user.account_locked_until as string) > new Date()
      ) {
        return;
      }

      const newFailedAttempts =
        ((user.failed_login_attempts as number) || 0) + 1;

      if (newFailedAttempts >= this.MAX_FAILED_ATTEMPTS) {
        // Lock the account
        const lockUntil = new Date(
          Date.now() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000
        );

        await getSupabaseAdmin()
          .from('users')
          .update({
            failed_login_attempts: newFailedAttempts,
            account_locked_until: lockUntil.toISOString(),
          })
          .eq('id', (user as any).id);

        await this.logSecurityEvent(
          (user as any).id,
          'account_locked',
          'critical',
          `Account locked due to ${newFailedAttempts} failed login attempts`,
          { locked_until: lockUntil },
          ipAddress
        );

        await this.sendSecurityAlert((user as any).id, 'account_locked', {
          attempts: newFailedAttempts,
          locked_until: lockUntil,
          ip: ipAddress,
        });
      } else {
        // Increment failed attempts
        await getSupabaseAdmin()
          .from('users')
          .update({ failed_login_attempts: newFailedAttempts })
          .eq('id', (user as any).id);

        if (newFailedAttempts >= 3) {
          await this.logSecurityEvent(
            (user as any).id,
            'brute_force_attempt',
            'warning',
            `${newFailedAttempts} failed login attempts`,
            { attempts: newFailedAttempts },
            ipAddress
          );
        }
      }
    } catch (error) {
      console.error('Error handling failed login:', error);
    }
  }

  static async handleSuccessfulLogin(userId: string) {
    try {
      // Reset failed login attempts
      await getSupabaseAdmin()
        .from('users')
        .update({
          failed_login_attempts: 0,
          account_locked_until: null,
        })
        .eq('id', userId);
    } catch (error) {
      console.error('Error handling successful login:', error);
    }
  }

  private static parseUserAgent(userAgent: string): DeviceInfo {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    let deviceType = 'desktop';
    if (result.device.type === 'mobile') deviceType = 'mobile';
    else if (result.device.type === 'tablet') deviceType = 'tablet';

    return {
      device_type: deviceType,
      browser: result.browser.name || 'Unknown',
      browser_version: result.browser.version || '',
      os: result.os.name || 'Unknown',
      os_version: result.os.version || '',
      device_fingerprint: this.generateDeviceFingerprint(userAgent, ''),
      device_name: result.device.model,
    };
  }

  private static generateDeviceFingerprint(
    userAgent: string,
    ipAddress: string
  ): string {
    const data = `${userAgent}-${ipAddress.split('.').slice(0, 2).join('.')}`;
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex')
      .substring(0, 32);
  }

  private static async getLocationFromIP(ipAddress: string): Promise<any> {
    try {
      // In production, you'd use a service like ipapi.co or ipgeolocation.io
      // For now, return mock data
      return {
        city: 'Unknown',
        country: 'Unknown',
        coordinates: null,
      };
    } catch (error) {
      console.error('Error getting location from IP:', error);
      return null;
    }
  }

  static async sendSecurityAlert(userId: string, alertType: string, data: any) {
    try {
      const { data: user } = await getSupabaseAdmin()
        .from('users')
        .select('email, security_settings')
        .eq('id', userId)
        .single();

      if (!user || !(user.security_settings as any)?.email_alerts) return;

      // In production, integrate with email service (SendGrid, Resend, etc.)
      console.log(`Security Alert for ${user.email}:`, alertType, data);

      // You would send actual email here
      // await sendEmail({
      //   to: user.email,
      //   subject: getAlertSubject(alertType),
      //   template: getAlertTemplate(alertType),
      //   data
      // })
    } catch (error) {
      console.error('Error sending security alert:', error);
    }
  }
}
