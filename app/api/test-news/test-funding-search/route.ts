import { NextRequest, NextResponse } from 'next/server';
import { getGPT5MiniFundingService } from '@/lib/services/gpt5-mini-funding-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const loungeType = searchParams.get('loungeType') || 'SaaS';
    const maxResults = parseInt(searchParams.get('maxResults') || '10');
    const timeframe = searchParams.get('timeframe') || '24h';

    console.log(`[Test Funding] Starting funding search for ${loungeType} (timeframe: ${timeframe})`);

    const fundingService = getGPT5MiniFundingService();
    const startTime = Date.now();

    const result = await fundingService.searchFundingNews({
      loungeType,
      maxResults,
      timeframe,
    });

    const duration = Date.now() - startTime;

    // Analysis of results
    const analysis = {
      totalFound: result.totalFound,
      duration: `${duration}ms`,
      timeframe,
      loungeType,
      sources: [...new Set(result.fundingItems.map(item => item.source))],
      thesaasnewsCount: result.fundingItems.filter(
        item => item.sourceUrl.includes('thesaasnews.com')
      ).length,
      averageAmountLength: result.fundingItems
        .map(item => item.amount?.length || 0)
        .reduce((a, b) => a + b, 0) / (result.fundingItems.length || 1),
      seriesBreakdown: result.fundingItems.reduce((acc, item) => {
        const series = item.series || 'Unknown';
        acc[series] = (acc[series] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      industries: [...new Set(result.fundingItems
        .map(item => item.industry)
        .filter(Boolean)
      )],
      hasRealUrls: result.fundingItems.every(
        item => item.sourceUrl && item.sourceUrl.startsWith('http')
      ),
    };

    // Sample funding items for inspection
    const sampleItems = result.fundingItems.slice(0, 3).map(item => ({
      company: item.company,
      amount: item.amount,
      series: item.series,
      source: item.source,
      sourceUrl: item.sourceUrl,
      summary: item.summary.substring(0, 100) + '...',
    }));

    return NextResponse.json({
      success: true,
      message: `Found ${result.totalFound} funding items from specialized sources`,
      analysis,
      sampleItems,
      fullResults: result,
    });
  } catch (error: any) {
    console.error('[Test Funding] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}