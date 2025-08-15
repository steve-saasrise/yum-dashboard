import { Resend } from 'resend';
import { PasswordResetEmail } from '@/emails/password-reset';
import { CuratorInviteEmail } from '@/emails/curator-invite';

// Lazy initialize Resend client to avoid build-time errors
let resend: Resend | null = null;

const getResendClient = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

const FROM_EMAIL =
  process.env.EMAIL_FROM || 'Daily News <noreply@dailynews.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(email: string, token: string) {
  try {
    const resetUrl = `${APP_URL}/curator/reset-password?token=${token}`;

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your password',
      react: PasswordResetEmail({ resetUrl }),
    });

    if (error) {
      console.error('Failed to send password reset email:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
}

export async function sendCuratorInviteEmail(
  email: string,
  token: string,
  inviterName: string
) {
  try {
    const inviteUrl = `${APP_URL}/curator/accept-invite?token=${token}`;

    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `You're invited to join Daily News as a curator`,
      react: CuratorInviteEmail({ inviteUrl, inviterName }),
    });

    if (error) {
      console.error('Failed to send curator invite email:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error sending curator invite email:', error);
    throw error;
  }
}
