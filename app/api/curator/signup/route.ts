import { NextResponse } from 'next/server';
import { curatorSignupSchema } from '@/lib/validations/curator';
import { CuratorAuthService } from '@/lib/services/curator-auth-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Validate input
    const validatedData = curatorSignupSchema.parse(body);

    // Create curator
    const curator = await CuratorAuthService.createCurator(
      validatedData.email,
      validatedData.password
    );

    if (!curator) {
      return NextResponse.json(
        { error: 'Failed to create curator account' },
        { status: 400 }
      );
    }

    // Auto-login after signup
    const session = await CuratorAuthService.login(
      validatedData.email,
      validatedData.password
    );

    if (!session) {
      return NextResponse.json(
        { error: 'Account created but login failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Signup error:', error);

    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid input data' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'An error occurred during signup' },
      { status: 500 }
    );
  }
}
