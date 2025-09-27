import { NextRequest, NextResponse } from 'next/server';
import { render } from '@react-email/render';
import { DailyDigestEmail } from '@/emails/daily-digest';
import { DigestService } from '@/lib/services/digest-service';
import { NewsSummaryService } from '@/lib/services/news-summary-service';
import { getSaaSStockMoversService } from '@/lib/services/saas-stock-movers-service';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/auth/admin-check';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Check admin access
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    console.log('[Test] Generating digest preview...');

    // Import services for session management
    const { OpenGraphService } = await import('@/lib/services/opengraph-service');

    // Start digest session to prevent duplicate images
    OpenGraphService.startDigestSession();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Get the SaaS lounge for testing
    const { data: lounge, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description, theme_description')
      .eq('name', 'SaaS Pulse')
      .eq('is_system_lounge', true)
      .single();

    if (loungeError || !lounge) {
      return NextResponse.json(
        { error: 'Failed to fetch SaaS lounge' },
        { status: 500 }
      );
    }

    // Get AI-generated news summary
    let aiNewsSummary = undefined;
    try {
      const summaryService = new NewsSummaryService();
      const summary = await summaryService.getLatestSummary(lounge.id);
      if (summary) {
        const enhanced = await summaryService.enhanceSummaryWithImages(
          summary,
          lounge.theme_description || lounge.name
        );
        aiNewsSummary = {
          ...enhanced,
          specialSectionTitle: summary.specialSectionTitle,
          generatedAt: summary.generatedAt,
        };
      }
    } catch (error) {
      console.error('Error fetching AI news summary:', error);
    }

    // Get stock movers data using hybrid approach
    let stockMovers = undefined;
    try {
      const stockMoversService = getSaaSStockMoversService();
      stockMovers = await stockMoversService.generateStockMovers();
      console.log('Successfully fetched SaaS stock movers for preview');
    } catch (error) {
      console.error('Error fetching SaaS stock movers:', error);
    }

    // Get news content
    const newsContent = aiNewsSummary
      ? []
      : await DigestService.getNewsContent(5);

    // Get top social posts
    const topSocialPosts = await DigestService.getTopSocialPosts(
      lounge.id,
      lounge.theme_description || lounge.name,
      5
    );

    // Get additional social content
    const socialContent = await DigestService.getSocialContentForLounge(
      lounge.id,
      10
    );

    // Combine content
    const content = [...newsContent, ...socialContent];

    // Format date
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Format content for email
    const emailContent = content.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || undefined,
      url: item.url,
      creator_name: item.creator.display_name,
      platform: item.platform,
      thumbnail_url: item.thumbnail_url || undefined,
      published_at: item.published_at,
      ai_summary_short: item.ai_summary_short || undefined,
      content_body: item.content_body || undefined,
      reference_type: item.reference_type as
        | 'quote'
        | 'retweet'
        | 'reply'
        | undefined,
      referenced_content: item.referenced_content || undefined,
    }));

    // Fetch active advertisers
    const { data: advertisers } = await supabase
      .from('email_advertisers')
      .select('position, company_name, logo_url, link_url, tagline')
      .eq('is_active', true)
      .order('position');

    // Format top social posts
    const formattedTopPosts = topSocialPosts.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description || undefined,
      url: item.url,
      creator_name: item.creator.display_name,
      platform: item.platform,
      thumbnail_url: item.thumbnail_url || undefined,
      published_at: item.published_at,
      ai_summary_short: item.ai_summary_short || undefined,
      content_body: item.content_body || undefined,
      reference_type: item.reference_type as
        | 'quote'
        | 'retweet'
        | 'reply'
        | undefined,
      referenced_content: item.referenced_content || undefined,
      engagement_metrics: (item as any).engagement_metrics || undefined,
    }));

    // Render email to HTML
    const emailHtml = await render(
      DailyDigestEmail({
        loungeName: lounge.name,
        loungeDescription: lounge.description,
        content: emailContent,
        topSocialPosts: formattedTopPosts,
        recipientEmail: 'llm-test@dailynews.com',
        unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/settings/account`,
        date,
        aiNewsSummary,
        stockMovers,
        advertisers: advertisers || [],
      })
    );

    // End digest session before returning success
    OpenGraphService.endDigestSession();

    return NextResponse.json({
      success: true,
      html: emailHtml,
      digestData: {
        loungeName: lounge.name,
        loungeDescription: lounge.description,
        contentCount: emailContent.length,
        topSocialPostsCount: formattedTopPosts.length,
        hasAINewsSummary: !!aiNewsSummary,
        hasStockMovers: !!stockMovers,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating digest preview:', error);

    // End session even on error to clean up
    try {
      const { OpenGraphService } = await import('@/lib/services/opengraph-service');
      OpenGraphService.endDigestSession();
    } catch (cleanupError) {
      console.error('Error cleaning up session:', cleanupError);
    }

    return NextResponse.json(
      {
        error: 'Failed to generate digest preview',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
