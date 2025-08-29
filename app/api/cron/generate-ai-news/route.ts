import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AINewsService } from '@/lib/services/ai-news-service';
import type { Database } from '@/types/database.types';

export const maxDuration = 60; // 60 seconds timeout
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize Supabase client with service key
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get all active lounges
    const { data: lounges, error: loungesError } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('is_system_lounge', true)
      .order('name');

    if (loungesError || !lounges) {
      console.error('Error fetching lounges:', loungesError);
      return NextResponse.json(
        { error: 'Failed to fetch lounges' },
        { status: 500 }
      );
    }

    console.log(`Starting AI news generation for ${lounges.length} lounges`);
    console.log('Using model: o4-mini-deep-research with web search');

    // Initialize AI news service
    const aiNewsService = new AINewsService();
    const results = {
      successful: 0,
      failed: 0,
      lounges: [] as any[],
    };

    // Generate news for each lounge
    for (const lounge of lounges) {
      try {
        console.log(`Generating news for lounge: ${lounge.name}`);

        // Generate AI news
        const newsResult = await aiNewsService.generateNews(
          lounge.name,
          lounge.description || undefined
        );

        // Save to database
        const { data: savedSummary, error: saveError } = await supabase
          .from('daily_news_summaries')
          .insert({
            lounge_id: lounge.id,
            topic: newsResult.topic,
            summary_bullets: newsResult.items as any,
            generated_at: new Date().toISOString(),
            model_used: 'gpt-4o-mini',
            token_count: 0, // You can add token tracking if needed
            generation_time_ms: 0, // You can add timing if needed
            used_in_digest: false,
            metadata: {
              cron_generated: true,
              generated_at: new Date().toISOString(),
            },
          })
          .select('id')
          .single();

        if (saveError) {
          console.error(`Error saving summary for ${lounge.name}:`, saveError);
          results.failed++;
        } else {
          console.log(
            `Successfully saved summary for ${lounge.name}:`,
            savedSummary.id
          );
          results.successful++;
          results.lounges.push({
            lounge: lounge.name,
            summaryId: savedSummary.id,
            itemCount: newsResult.items.length,
          });
        }
      } catch (error) {
        console.error(`Error generating news for ${lounge.name}:`, error);
        results.failed++;
      }
    }

    // Also generate a general "Technology and Business" summary
    try {
      console.log('Generating general Technology and Business summary');
      const generalNews = await aiNewsService.generateNews(
        'Technology and Business'
      );

      const { data: savedGeneral, error: saveError } = await supabase
        .from('daily_news_summaries')
        .insert({
          lounge_id: null,
          topic: 'Technology and Business',
          summary_bullets: generalNews.items as any,
          generated_at: new Date().toISOString(),
          model_used: 'gpt-4o-mini',
          token_count: 0,
          generation_time_ms: 0,
          used_in_digest: false,
          metadata: {
            cron_generated: true,
            is_general: true,
            generated_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (!saveError && savedGeneral) {
        results.successful++;
        results.lounges.push({
          lounge: 'General (Technology and Business)',
          summaryId: savedGeneral.id,
          itemCount: generalNews.items.length,
        });
      }
    } catch (error) {
      console.error('Error generating general news:', error);
      results.failed++;
    }

    console.log('AI news generation completed:', results);

    return NextResponse.json({
      success: true,
      message: `Generated AI news for ${results.successful} lounges`,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in AI news generation cron job:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    );
  }
}
