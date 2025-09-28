import { NextRequest, NextResponse } from 'next/server';
import { getHybridNewsService } from '@/lib/services/hybrid-news-service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const loungeType = searchParams.get('loungeType') || 'SaaS';

    console.log(`[Compare Funding] Starting comparison for ${loungeType}`);

    const hybridService = getHybridNewsService();

    // Run both methods in parallel
    const [withDedicatedFunding, withoutDedicatedFunding] = await Promise.all([
      // With dedicated GPT-5-mini funding search
      hybridService.generateNews({
        loungeType,
        maxBullets: 5,
        maxSpecialSection: 5,
        useRSSFeeds: true,
        fallbackToPureGeneration: true,
        minArticlesRequired: 10,
        useDedicatedFundingSearch: true,
        fundingSearchTimeframe: '24h',
      }),
      // Without dedicated funding search (RSS-only)
      hybridService.generateNews({
        loungeType,
        maxBullets: 5,
        maxSpecialSection: 5,
        useRSSFeeds: true,
        fallbackToPureGeneration: true,
        minArticlesRequired: 10,
        useDedicatedFundingSearch: false,
      }),
    ]);

    // Compare funding sections
    const comparison = {
      withDedicatedFunding: {
        fundingCount: withDedicatedFunding.specialSection?.length || 0,
        sources: [
          ...new Set(
            (withDedicatedFunding.specialSection || [])
              .map((item) => item.source)
              .filter(Boolean)
          ),
        ],
        hasTheSaasNews: (withDedicatedFunding.specialSection || []).some(
          (item) => item.sourceUrl?.includes('thesaasnews.com')
        ),
        sampleFunding: (withDedicatedFunding.specialSection || [])
          .slice(0, 2)
          .map((item) => ({
            text: item.text,
            amount: item.amount,
            source: item.source,
            sourceUrl: item.sourceUrl,
          })),
      },
      withoutDedicatedFunding: {
        fundingCount: withoutDedicatedFunding.specialSection?.length || 0,
        sources: [
          ...new Set(
            (withoutDedicatedFunding.specialSection || [])
              .map((item) => item.source)
              .filter(Boolean)
          ),
        ],
        hasTheSaasNews: (withoutDedicatedFunding.specialSection || []).some(
          (item) => item.sourceUrl?.includes('thesaasnews.com')
        ),
        sampleFunding: (withoutDedicatedFunding.specialSection || [])
          .slice(0, 2)
          .map((item) => ({
            text: item.text,
            amount: item.amount,
            source: item.source,
            sourceUrl: item.sourceUrl,
          })),
      },
      analysis: {
        dedicatedFundingAdvantage:
          (withDedicatedFunding.specialSection?.length || 0) -
          (withoutDedicatedFunding.specialSection?.length || 0),
        dedicatedHasMoreSources:
          [
            ...new Set(
              (withDedicatedFunding.specialSection || [])
                .map((item) => item.source)
                .filter(Boolean)
            ),
          ].length >
          [
            ...new Set(
              (withoutDedicatedFunding.specialSection || [])
                .map((item) => item.source)
                .filter(Boolean)
            ),
          ].length,
        bothHaveRealUrls:
          (withDedicatedFunding.specialSection || []).every((item) =>
            item.sourceUrl?.startsWith('http')
          ) &&
          (withoutDedicatedFunding.specialSection || []).every((item) =>
            item.sourceUrl?.startsWith('http')
          ),
      },
    };

    return NextResponse.json({
      success: true,
      loungeType,
      comparison,
      message:
        'Comparison complete. Check the results to see the difference between dedicated funding search and RSS-only approach.',
    });
  } catch (error: any) {
    console.error('[Compare Funding] Error:', error);

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
