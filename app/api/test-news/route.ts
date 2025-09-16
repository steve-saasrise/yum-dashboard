import { NextRequest, NextResponse } from 'next/server';
import { getGPT5NewsService } from '@/lib/services/gpt5-news-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { loungeType = 'saas', maxBullets = 5, maxSpecialSection = 5 } = body;

    const gpt5Service = getGPT5NewsService();
    const newsData = await gpt5Service.generateNews({
      loungeType,
      maxBullets,
      maxSpecialSection,
    });

    return NextResponse.json(newsData);
  } catch (error: any) {
    console.error('[API] Error generating news:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate news' },
      { status: 500 }
    );
  }
}
