import { NextRequest, NextResponse } from 'next/server';
import { getHybridNewsService } from '@/lib/services/hybrid-news-service';
import { getRSSFeedService } from '@/lib/services/rss-feed-service';
import { NewsSummaryService } from '@/lib/services/news-summary-service';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Check for API key in headers
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.TEST_API_KEY && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get('mode') || 'hybrid';
    const testRss = searchParams.get('testRss') === 'true';

    console.log('[Test Hybrid News] Starting test with mode:', mode);

    // Test RSS feeds only
    if (testRss) {
      console.log('[Test Hybrid News] Testing RSS feeds...');
      const rssService = getRSSFeedService();
      const articles = await rssService.fetchAllFeeds();

      return NextResponse.json({
        success: true,
        mode: 'rss-test',
        totalArticles: articles.length,
        articles: articles.slice(0, 10).map(a => ({
          title: a.title,
          source: a.source,
          url: a.link,
          pubDate: a.pubDate,
          category: a.sourceCategory,
        })),
        sources: [...new Set(articles.map(a => a.source))],
      });
    }

    // Test hybrid news generation
    const hybridService = getHybridNewsService();

    const startTime = Date.now();

    const result = await hybridService.generateNews({
      loungeType: 'SaaS Pulse',
      maxBullets: 5,
      maxSpecialSection: 5,
      useRSSFeeds: mode === 'hybrid' || mode === 'rss-only',
      fallbackToPureGeneration: mode === 'hybrid',
    });

    const duration = Date.now() - startTime;

    // Check if we got real URLs (from RSS) vs generated ones
    const realUrls = result.items.filter(
      item => item.sourceUrl && item.sourceUrl.startsWith('http')
    ).length;

    // Save the generated news to the database for the email preview
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!
      );

      // Get the SaaS lounge ID
      const { data: lounge } = await supabase
        .from('lounges')
        .select('id')
        .eq('name', 'SaaS Pulse')
        .eq('is_system_lounge', true)
        .single();

      if (lounge) {
        const summaryService = new NewsSummaryService();

        // Format the result to match the expected structure
        const summaryToSave = {
          bigStory: result.bigStory,
          bullets: result.items.map(item => ({
            text: item.text,
            summary: item.summary,
            sourceUrl: item.sourceUrl,
            source: item.source,
            amount: item.amount,
            series: item.series,
          })),
          specialSection: result.specialSection?.map(item => ({
            text: item.text,
            summary: item.summary,
            sourceUrl: item.sourceUrl,
            source: item.source,
            amount: item.amount,
            series: item.series,
          })),
          topic: result.topic,
          loungeId: lounge.id,
          generatedAt: result.generatedAt,
          specialSectionTitle: result.specialSectionTitle,
          modelUsed: mode === 'hybrid' ? 'hybrid-gpt5-rss' : 'gpt-5',
          tokenCount: 0, // Not tracked for hybrid mode
          generationTimeMs: duration,
          sourceContentIds: [], // Not applicable for hybrid mode
        };

        await summaryService.saveSummary(summaryToSave);
        console.log('[Test Hybrid News] Saved news summary to database for lounge:', lounge.id);
      }
    } catch (saveError) {
      console.error('[Test Hybrid News] Failed to save summary to database:', saveError);
      // Don't fail the request if saving fails, just log the error
    }

    return NextResponse.json({
      success: true,
      mode,
      duration,
      data: {
        bigStory: result.bigStory,
        bulletCount: result.items.length,
        bullets: result.items,
        specialSectionCount: result.specialSection?.length || 0,
        specialSection: result.specialSection,
        specialSectionTitle: result.specialSectionTitle,
      },
      metadata: {
        topic: result.topic,
        generatedAt: result.generatedAt,
        realUrlsCount: realUrls,
        totalItems: result.items.length,
      },
    });
  } catch (error: any) {
    console.error('[Test Hybrid News] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate news',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for API key in headers
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.TEST_API_KEY && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      loungeType = 'SaaS Pulse',
      maxBullets = 5,
      maxSpecialSection = 5,
      useRSSFeeds = true,
      fallbackToPureGeneration = true,
    } = body;

    console.log('[Test Hybrid News] POST request with config:', body);

    const hybridService = getHybridNewsService();

    const startTime = Date.now();

    const result = await hybridService.generateNews({
      loungeType,
      maxBullets,
      maxSpecialSection,
      useRSSFeeds,
      fallbackToPureGeneration,
    });

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration,
      config: {
        loungeType,
        maxBullets,
        maxSpecialSection,
        useRSSFeeds,
        fallbackToPureGeneration,
      },
      result,
    });
  } catch (error: any) {
    console.error('[Test Hybrid News] POST Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate news',
        details: error.message,
      },
      { status: 500 }
    );
  }
}