import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGPT5NewsService } from '@/lib/services/gpt5-news-service';
import type { Database } from '@/types/database.types';

export const maxDuration = 60; // 60 seconds for direct generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Cron] Starting SaaS news generation...');

    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the SaaS lounge
    const { data: saasLounge, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('name', 'SaaS')
      .eq('is_system_lounge', true)
      .single();

    if (loungeError || !saasLounge) {
      console.error('Error fetching SaaS lounge:', loungeError);
      return NextResponse.json(
        { error: 'Failed to fetch SaaS lounge' },
        { status: 500 }
      );
    }

    // Generate news using GPT-5 service
    const gpt5Service = getGPT5NewsService();
    const newsData = await gpt5Service.generateNews({
      loungeType: 'saas',
      maxBullets: 5,
      maxSpecialSection: 5,
    });

    console.log('[Cron] Generated SaaS news:', {
      bullets: newsData.items.length,
      specialSection: newsData.specialSection?.length || 0,
      hasBigStory: !!newsData.bigStory,
    });

    // Prepare data for database - ensure it's properly typed as Json
    const aiNewsData = {
      lounge_id: saasLounge.id,
      content: {
        bigStory: newsData.bigStory,
        bullets: newsData.items,
        fundingNews: newsData.specialSection,
        fundingTitle: newsData.specialSectionTitle || 'SaaS Funding & M&A',
        generatedAt: newsData.generatedAt,
      } as any, // Type as any to satisfy Json type requirement
      generated_at: new Date().toISOString(),
      news_date: new Date().toISOString().split('T')[0], // Today's date
    };

    // Check if news already exists for today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingNews } = await supabase
      .from('ai_news')
      .select('id')
      .eq('lounge_id', saasLounge.id)
      .eq('news_date', today)
      .single();

    let result;
    if (existingNews) {
      // Update existing news
      const { data, error } = await supabase
        .from('ai_news')
        .update({
          content: aiNewsData.content,
          generated_at: aiNewsData.generated_at,
        })
        .eq('id', existingNews.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating AI news:', error);
        return NextResponse.json(
          { error: 'Failed to update AI news in database' },
          { status: 500 }
        );
      }
      result = data;
      console.log('[Cron] Updated existing SaaS news for today');
    } else {
      // Insert new news
      const { data, error } = await supabase
        .from('ai_news')
        .insert(aiNewsData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting AI news:', error);
        return NextResponse.json(
          { error: 'Failed to save AI news to database' },
          { status: 500 }
        );
      }
      result = data;
      console.log('[Cron] Saved new SaaS news to database');
    }

    return NextResponse.json({
      success: true,
      message: 'SaaS news generated and saved successfully',
      data: {
        loungeId: saasLounge.id,
        loungeName: saasLounge.name,
        newsId: result.id,
        newsDate: result.news_date,
        items: {
          bigStory: newsData.bigStory ? 1 : 0,
          bullets: newsData.items.length,
          funding: newsData.specialSection?.length || 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in SaaS news generation cron job:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
