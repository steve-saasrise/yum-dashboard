import { NextRequest, NextResponse } from 'next/server';
import { AIImageService } from '@/lib/services/ai-image-service';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting AI image cleanup cron job');

    const aiImageService = AIImageService.getInstance();
    const result = await aiImageService.cleanupExpiredImages();

    console.log('AI image cleanup completed:', result);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.deleted} expired images, freed ${(result.freedBytes / 1024 / 1024).toFixed(2)} MB`,
      ...result,
    });
  } catch (error) {
    console.error('Error in AI image cleanup cron:', error);
    return NextResponse.json(
      {
        error: 'Failed to cleanup expired images',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
