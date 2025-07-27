import { NextResponse } from 'next/server';
import { curatorLoginSchema } from '@/lib/validations/curator';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Login attempt for email:', body.email);
    console.log('Password length:', body.password?.length);

    // Validate input
    const validatedData = curatorLoginSchema.parse(body);
    console.log('Validation passed for:', validatedData.email);

    // Attempt login
    const session = await CuratorAuthService.login(
      validatedData.email,
      validatedData.password
    );

    if (!session) {
      console.log('Login failed - invalid credentials');
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    console.log('Login successful for:', session.curator.email);
    return NextResponse.json({ session });
  } catch (error) {
    console.error('Login error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      const zodError = error as any;
      console.error('Validation errors:', zodError.errors);
      return NextResponse.json(
        { error: zodError.errors[0]?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'An error occurred during login' },
      { status: 500 }
    );
  }
}
