import { NextRequest, NextResponse } from 'next/server';
import { NewsSummaryService } from '@/lib/services/news-summary-service';
import { NewsAggregationService } from '@/lib/services/news-aggregation-service';

// This endpoint will be called by Vercel Cron at 8:25 AM ET daily (5 minutes before digest)
export async function GET(request: NextRequest) {
  try {
    // Verify this is a cron job request (security)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Starting daily news summary generation...');

    const summaryService = new NewsSummaryService();
    const aggregationService = new NewsAggregationService();

    // Get all active lounges
    const lounges = await aggregationService.getActiveLounges();

    const results = {
      totalLounges: lounges.length,
      successful: 0,
      failed: 0,
      summaries: [] as any[],
    };

    // Generate summary for each lounge
    for (const lounge of lounges) {
      try {
        console.log(
          `Generating summary for lounge: ${lounge.name} (${lounge.id})`
        );

        // Get news content for this lounge
        const newsContent = await aggregationService.getNewsContentForLounge(
          lounge.id
        );

        if (newsContent.length === 0) {
          console.log(`No news content found for lounge ${lounge.name}`);
          continue;
        }

        // Prioritize funding/exit news for SaaS lounges
        const prioritizedContent = lounge.name.toLowerCase().includes('saas')
          ? aggregationService.prioritizeFundingNews(newsContent)
          : newsContent;

        // Get the topic for this lounge
        const topic = aggregationService.getTopicForLounge(lounge);

        // Generate AI summary
        const summary = await summaryService.generateDailySummary(
          topic,
          prioritizedContent,
          lounge.id
        );

        // Save to database
        const summaryId = await summaryService.saveSummary(summary);

        results.successful++;
        results.summaries.push({
          loungeId: lounge.id,
          loungeName: lounge.name,
          summaryId,
          bulletCount: summary.bullets.length,
          tokenCount: summary.tokenCount,
        });

        console.log(
          `Successfully generated summary for ${lounge.name}: ${summaryId}`
        );
      } catch (error) {
        console.error(
          `Failed to generate summary for lounge ${lounge.name}:`,
          error
        );
        results.failed++;
      }
    }

    // Also generate a general news summary (not lounge-specific)
    try {
      console.log('Generating general news summary...');

      const generalNews = await aggregationService.getGeneralNewsContent();

      if (generalNews.length > 0) {
        const prioritizedNews =
          aggregationService.prioritizeFundingNews(generalNews);

        const generalSummary = await summaryService.generateDailySummary(
          'Technology and Business',
          prioritizedNews
        );

        const summaryId = await summaryService.saveSummary(generalSummary);

        results.successful++;
        results.summaries.push({
          loungeId: null,
          loungeName: 'General News',
          summaryId,
          bulletCount: generalSummary.bullets.length,
          tokenCount: generalSummary.tokenCount,
        });

        console.log(
          `Successfully generated general news summary: ${summaryId}`
        );
      }
    } catch (error) {
      console.error('Failed to generate general news summary:', error);
      results.failed++;
    }

    console.log(
      `Daily news summary generation complete. Success: ${results.successful}, Failed: ${results.failed}`
    );

    return NextResponse.json({
      success: true,
      message: 'Daily news summaries generated',
      stats: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in news summary generation:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate news summaries',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Optional: Manual trigger endpoint for testing
export async function POST(request: NextRequest) {
  try {
    // Check for admin authentication or special test token
    const authHeader = request.headers.get('authorization');
    const isAdmin =
      authHeader === `Bearer ${process.env.ADMIN_API_KEY}` ||
      authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse optional parameters
    const body = await request.json().catch(() => ({}));
    const { loungeId, testMode = false } = body;

    console.log(
      `Manual news summary generation triggered${loungeId ? ` for lounge ${loungeId}` : ''}`
    );

    const summaryService = new NewsSummaryService();
    const aggregationService = new NewsAggregationService();

    if (loungeId) {
      // Generate for specific lounge
      const lounges = await aggregationService.getActiveLounges();
      const lounge = lounges.find((l) => l.id === loungeId);

      if (!lounge) {
        return NextResponse.json(
          { error: 'Lounge not found' },
          { status: 404 }
        );
      }

      const newsContent =
        await aggregationService.getNewsContentForLounge(loungeId);

      if (newsContent.length === 0) {
        return NextResponse.json(
          {
            error: 'No news content found for this lounge',
          },
          { status: 404 }
        );
      }

      const topic = aggregationService.getTopicForLounge(lounge);
      const prioritizedContent = lounge.name.toLowerCase().includes('saas')
        ? aggregationService.prioritizeFundingNews(newsContent)
        : newsContent;

      const summary = await summaryService.generateDailySummary(
        topic,
        prioritizedContent,
        loungeId
      );

      if (!testMode) {
        const summaryId = await summaryService.saveSummary(summary);
        return NextResponse.json({
          success: true,
          summaryId,
          summary: summary.bullets,
          tokenCount: summary.tokenCount,
        });
      } else {
        // Test mode - return summary without saving
        return NextResponse.json({
          success: true,
          testMode: true,
          summary: summary.bullets,
          tokenCount: summary.tokenCount,
          sourceContentCount: summary.sourceContentIds.length,
        });
      }
    } else {
      // Run full generation like the cron job
      return GET(request);
    }
  } catch (error) {
    console.error('Error in manual news summary generation:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate news summary',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
