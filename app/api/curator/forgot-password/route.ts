import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CuratorPasswordResetService } from '@/lib/services/curator-password-reset-service';

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);

    const token = await CuratorPasswordResetService.createResetToken(email);

    // Send email with reset link
    if (token) {
      if (process.env.RESEND_API_KEY) {
        const { sendPasswordResetEmail } = await import(
          '@/lib/services/email-service'
        );
        await sendPasswordResetEmail(email, token);
      } else {
        // Fallback to console logging if no email service configured
        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/curator/reset-password?token=${token}`;
        console.log('Password reset link:', resetUrl);
        console.log('In production, this would be sent to:', email);
      }
    }

    // Always return success for security
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password reset error:', error);
    // Always return success for security
    return NextResponse.json({ success: true });
  }
}
