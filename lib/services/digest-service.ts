import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { DailyDigestEmail } from '@/emails/daily-digest';
import { NewsSummaryService } from './news-summary-service';
import { SocialPostSelector } from './social-post-selector';
import { OpenGraphService } from './opengraph-service';
import { AIImageService } from './ai-image-service';
import { ImageOptimizer } from './image-optimizer';
import { getGPT5StockMoversService } from './gpt5-stock-movers-service';

// Lazy initialize Resend client to avoid build-time errors
let resend: Resend | null = null;

const getResendClient = () => {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
};

const FROM_EMAIL =
  process.env.DIGEST_EMAIL_FROM ||
  process.env.EMAIL_FROM ||
  'Daily News <noreply@dailynews.app>';

// Create Supabase client with service role for server-side operations
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

interface Lounge {
  id: string;
  name: string;
  description: string;
  theme_description?: string;
}

interface ContentForDigest {
  id: string;
  title: string;
  description: string | null;
  url: string;
  platform: 'youtube' | 'twitter' | 'linkedin' | 'threads' | 'rss' | 'website';
  thumbnail_url: string | null;
  published_at: string;
  ai_summary_short: string | null;
  content_body: string | null;
  reference_type: string | null;
  referenced_content: any | null;
  creator: {
    display_name: string;
  };
}

export class DigestService {
  /**
   * Get all system lounges
   */
  static async getLounges(): Promise<Lounge[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('lounges')
      .select('id, name, description')
      .eq('is_system_lounge', true)
      .order('name');

    if (error) {
      console.error('Error fetching lounges:', error);
      throw error;
    }

    return data || [];
  }

  /**
   * Get news content for digest (max 5 items from last 24 hours)
   * Only includes content from creators marked as 'news' type
   */
  static async getNewsContent(limit: number = 5): Promise<ContentForDigest[]> {
    const supabase = getSupabaseClient();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Get news creators
    const { data: newsCreators } = await supabase
      .from('creators')
      .select('id')
      .eq('content_type', 'news');

    if (!newsCreators || newsCreators.length === 0) {
      return [];
    }

    const newsCreatorIds = newsCreators.map((c) => c.id);

    // Get news content from last 24 hours
    const { data: newsContent } = await supabase
      .from('content')
      .select(
        `
        id,
        title,
        description,
        url,
        platform,
        thumbnail_url,
        published_at,
        ai_summary_short,
        content_body,
        reference_type,
        referenced_content,
        creators!inner(
          display_name
        )
      `
      )
      .in('creator_id', newsCreatorIds)
      .eq('processing_status', 'processed')
      .eq('is_primary', true)
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .not('relevancy_checked_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit);

    return (newsContent || []).map((content) => ({
      ...content,
      creator: (content as any).creators,
    })) as ContentForDigest[];
  }

  /**
   * Get AI-selected top social posts for the email digest
   * Prioritizes platform diversity and relevance
   */
  static async getTopSocialPosts(
    loungeId: string,
    loungeTheme: string,
    limit: number = 5
  ): Promise<ContentForDigest[]> {
    // Get all available social content (more than needed for selection)
    const allSocialContent = await this.getSocialContentForLounge(loungeId, 20);

    if (allSocialContent.length === 0) {
      return [];
    }

    // Use AI to select the top posts
    const selector = new SocialPostSelector();
    const selectedPosts = await selector.selectTopPosts(
      allSocialContent as any,
      loungeTheme,
      limit
    );

    // Process selected posts for image generation if needed
    const postsNeedingImages = selectedPosts.filter(
      (post) => !post.thumbnail_url
    );

    if (postsNeedingImages.length > 0) {
      console.log(
        `Generating AI images for ${postsNeedingImages.length} social posts`
      );

      // Generate AI images for posts without thumbnails
      const aiImageService = AIImageService.getInstance();
      const imagePromises = postsNeedingImages.map(async (post) => {
        // Clean the title by removing platform-specific prefixes
        let cleanedTitle = post.title;
        const platformPrefixes = [
          'Tweet by @',
          'Tweet by ',
          'Thread by @',
          'Thread by ',
          'Post by @',
          'Post by ',
          'Update by @',
          'Update by ',
        ];

        for (const prefix of platformPrefixes) {
          if (cleanedTitle.toLowerCase().startsWith(prefix.toLowerCase())) {
            cleanedTitle = ''; // Don't use platform-specific titles for image generation
            break;
          }
        }

        // If title was a platform prefix, use description or summary instead
        const titleForImage =
          cleanedTitle || post.description || post.ai_summary_short || '';

        const generatedImage = await aiImageService.generateFallbackImage({
          url: post.url,
          title: titleForImage,
          source: post.creator.display_name,
          category: loungeTheme,
          description: post.description || post.ai_summary_short || undefined,
          isBigStory: false, // Square images for social posts
        });

        if (generatedImage) {
          post.thumbnail_url = generatedImage.imageUrl;
          (post as any).aiGeneratedImage = true;
        }

        return post;
      });

      await Promise.all(imagePromises);
    }

    return selectedPosts as ContentForDigest[];
  }

  /**
   * Get social content for digest (max 10 items)
   * Only includes content from creators marked as 'social' type
   * Content is filtered by lounge associations
   */
  static async getSocialContentForLounge(
    loungeId: string,
    limit: number = 10
  ): Promise<ContentForDigest[]> {
    const supabase = getSupabaseClient();

    // Get the lounge's relevancy threshold
    const { data: lounge, error: loungeError } = await supabase
      .from('lounges')
      .select('relevancy_threshold')
      .eq('id', loungeId)
      .single();

    if (loungeError) {
      console.error('Error fetching lounge threshold:', loungeError);
    }

    const relevancyThreshold = lounge?.relevancy_threshold || 70;

    // First, get creators associated with this lounge
    const { data: creatorLounges, error: creatorError } = await supabase
      .from('creator_lounges')
      .select('creator_id, creators!inner(content_type)')
      .eq('lounge_id', loungeId);

    if (creatorError) {
      console.error('Error fetching creators for lounge:', creatorError);
      throw creatorError;
    }

    if (!creatorLounges || creatorLounges.length === 0) {
      return [];
    }

    // Filter for social creators only (or creators without a type, defaulting to social)
    const socialCreators = creatorLounges.filter(
      (cl: any) =>
        cl.creators?.content_type === 'social' || !cl.creators?.content_type
    );

    if (socialCreators.length === 0) {
      return [];
    }

    const creatorIdList = socialCreators.map((c: any) => c.creator_id);

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Define the platform priority order and target counts
    const platformConfig = [
      { platforms: ['youtube'], targetCount: 2, maxCount: 2 },
      { platforms: ['rss', 'website'], targetCount: 2, maxCount: 2 }, // Blog posts
      { platforms: ['linkedin'], targetCount: 2, maxCount: 2 },
      { platforms: ['twitter'], targetCount: 2, maxCount: 2 }, // LIMIT X TO 2
      { platforms: ['threads'], targetCount: 2, maxCount: 2 },
    ];

    const selectedContent: ContentForDigest[] = [];
    const usedIds = new Set<string>();

    // Phase 1: Try to get up to 2 from each platform (recent only, from last 24 hours)
    for (const config of platformConfig) {
      const query = supabase
        .from('content')
        .select(
          `
          id,
          title,
          description,
          url,
          platform,
          thumbnail_url,
          published_at,
          ai_summary_short,
          relevancy_score,
          content_body,
          reference_type,
          referenced_content,
          creators!inner(
            display_name
          )
        `
        )
        .in('creator_id', creatorIdList)
        .in('platform', config.platforms)
        .eq('processing_status', 'processed')
        .eq('is_primary', true) // Only show primary content (filter duplicates)
        .gte('published_at', twentyFourHoursAgo.toISOString())
        .gte('relevancy_score', relevancyThreshold)
        .order('relevancy_score', { ascending: false, nullsFirst: false })
        .order('published_at', { ascending: false })
        .limit(2); // Just get up to 2 per platform

      const { data: platformContent } = await query;

      // Add what we got (might be 0, 1, or 2 items)
      for (const content of platformContent || []) {
        if (!usedIds.has(content.id)) {
          selectedContent.push({
            ...content,
            creator: (content as any).creators,
          });
          usedIds.add(content.id);
        }
      }
    }

    // Phase 2: Fill to 10 items with best available recent content (no platform restrictions)
    if (selectedContent.length < limit) {
      const needed = limit - selectedContent.length;

      // Get the IDs we've already selected to exclude them
      const selectedIds = Array.from(usedIds);

      let fillQuery = supabase
        .from('content')
        .select(
          `
          id,
          title,
          description,
          url,
          platform,
          thumbnail_url,
          published_at,
          ai_summary_short,
          relevancy_score,
          content_body,
          reference_type,
          referenced_content,
          creators!inner(
            display_name
          )
        `
        )
        .in('creator_id', creatorIdList)
        .eq('processing_status', 'processed')
        .eq('is_primary', true) // Only show primary content (filter duplicates)
        .gte('published_at', twentyFourHoursAgo.toISOString())
        .gte('relevancy_score', relevancyThreshold);

      // Exclude already selected content
      if (selectedIds.length > 0) {
        fillQuery = fillQuery.not('id', 'in', `(${selectedIds.join(',')})`);
      }

      const { data: fillContent } = await fillQuery
        .order('relevancy_score', { ascending: false, nullsFirst: false })
        .order('published_at', { ascending: false })
        .limit(needed);

      // Add the best remaining content regardless of platform
      for (const content of fillContent || []) {
        selectedContent.push({
          ...content,
          creator: (content as any).creators,
        });
        if (selectedContent.length >= limit) break;
      }
    }

    return selectedContent.slice(0, limit);
  }

  /**
   * Generate and send digest for a specific lounge
   */
  static async sendLoungeDigest(
    lounge: Lounge,
    recipientEmail: string,
    unsubscribeToken?: string
  ): Promise<void> {
    try {
      // Get AI-generated news summary for this lounge
      let aiNewsSummary:
        | {
            bigStory?: {
              title: string;
              summary: string;
              source?: string;
              sourceUrl?: string;
              imageUrl?: string;
            };
            bullets: Array<{
              text: string;
              sourceUrl?: string;
              imageUrl?: string;
              source?: string;
            }>;
            specialSection?: Array<{
              text: string;
              summary?: string;
              sourceUrl?: string;
              imageUrl?: string;
              source?: string;
              amount?: string;
              series?: string;
            }>;
            specialSectionTitle?: string;
            generatedAt: string;
          }
        | undefined = undefined;
      try {
        const summaryService = new NewsSummaryService();
        const summary = await summaryService.getLatestSummary(lounge.id);
        if (summary) {
          // Enhance with images for email, passing lounge theme for AI fallback
          const enhanced = await summaryService.enhanceSummaryWithImages(
            summary,
            lounge.theme_description || lounge.name
          );
          aiNewsSummary = {
            ...enhanced,
            specialSectionTitle: summary.specialSectionTitle,
            generatedAt: summary.generatedAt,
          };

          // Crop the big story image to ensure perfect fit
          if (aiNewsSummary.bigStory?.imageUrl) {
            const croppedImage = await ImageOptimizer.cropForEmailHero(
              aiNewsSummary.bigStory.imageUrl,
              560, // width
              315 // height (16:9 aspect ratio)
            );
            if (croppedImage) {
              aiNewsSummary.bigStory.imageUrl = croppedImage;
            }
          }
        }
      } catch (summaryError) {
        console.error('Error fetching AI news summary:', summaryError);
      }

      // Get stock movers data for SaaS lounges
      let stockMovers = undefined;
      if (lounge.name.toLowerCase().includes('saas')) {
        try {
          const stockMoversService = getGPT5StockMoversService();
          stockMovers = await stockMoversService.generateStockMovers();
          console.log('Successfully fetched stock movers for SaaS lounge');
        } catch (stockError) {
          console.error('Error fetching stock movers:', stockError);
          // Continue without stock data if it fails
        }
      }

      // Get news content (same for all users) - fallback if no AI summary
      const newsContent = aiNewsSummary ? [] : await this.getNewsContent(5);

      // Get AI-selected top social posts for this lounge
      const topSocialPosts = await this.getTopSocialPosts(
        lounge.id,
        lounge.theme_description || lounge.name,
        5
      );

      // Get additional social content for the regular feed section
      const socialContent = await this.getSocialContentForLounge(lounge.id, 10);

      if (
        !aiNewsSummary &&
        newsContent.length === 0 &&
        socialContent.length === 0
      ) {
        console.log(
          `No content available for ${lounge.name} lounge, skipping digest`
        );
        return;
      }

      // Combine content with news first, then social
      const content = [...newsContent, ...socialContent];

      // Format date
      const date = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      // Generate unsubscribe URL - always point to settings/account since unsubscribe tokens aren't implemented
      const unsubscribeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/account`;

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

      // Format top social posts for email
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

      // Send email
      const { error } = await getResendClient().emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `${lounge.name} Daily Digest - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
        react: DailyDigestEmail({
          loungeName: lounge.name,
          loungeDescription: lounge.description,
          content: emailContent,
          topSocialPosts: formattedTopPosts,
          recipientEmail,
          unsubscribeUrl,
          date,
          aiNewsSummary,
          stockMovers,
        }),
      });

      if (error) {
        console.error(
          `Failed to send ${lounge.name} digest to ${recipientEmail}:`,
          error
        );
        throw error;
      }

      console.log(
        `Successfully sent ${lounge.name} digest to ${recipientEmail}`
      );

      // Update last_sent timestamp in email_digests table
      await this.updateLastSent(recipientEmail, lounge.id);
    } catch (error) {
      console.error(`Error sending digest for ${lounge.name}:`, error);
      throw error;
    }
  }

  /**
   * Send daily digests for subscribed lounges to a user
   */
  static async sendDailyDigests(recipientEmail: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', recipientEmail)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return;
    }

    // Get lounges this user is subscribed to
    const { data: subscriptions, error: subError } = await supabase
      .from('lounge_digest_subscriptions')
      .select('lounge_id')
      .eq('user_id', userData.id)
      .eq('subscribed', true);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No lounge subscriptions found for ${recipientEmail}`);
      return;
    }

    // Get lounge details for subscribed lounges
    const loungeIds = subscriptions.map((s) => s.lounge_id);
    const { data: lounges, error: loungeError } = await supabase
      .from('lounges')
      .select('id, name, description, theme_description')
      .in('id', loungeIds);

    if (loungeError || !lounges) {
      console.error('Error fetching lounges:', loungeError);
      return;
    }

    console.log(
      `Sending ${lounges.length} lounge digests to ${recipientEmail}`
    );

    // Send digest for each subscribed lounge
    for (const lounge of lounges) {
      try {
        await this.sendLoungeDigest(lounge, recipientEmail);

        // Add a small delay between emails to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to send ${lounge.name} digest:`, error);
        // Continue with other lounges even if one fails
      }
    }
  }

  /**
   * Update the last_sent timestamp for a user's digest
   */
  static async updateLastSent(
    userEmail: string,
    loungeId?: string
  ): Promise<void> {
    const supabase = getSupabaseClient();

    // Get user ID from email
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user:', userError);
      return;
    }

    // Update or create email_digest record
    const { error } = await supabase.from('email_digests').upsert(
      {
        user_id: userData.id,
        frequency: 'daily',
        last_sent: new Date().toISOString(),
        active: true,
        lounges_included: loungeId ? [loungeId] : null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

    if (error) {
      console.error('Error updating last_sent:', error);
    }
  }

  /**
   * Get users who have subscribed to at least one lounge
   */
  static async getUsersWithLoungeSubscriptions(): Promise<string[]> {
    const supabase = getSupabaseClient();

    // Get all unique users who have at least one lounge subscription
    const { data, error } = await supabase
      .from('lounge_digest_subscriptions')
      .select('users!inner(email)')
      .eq('subscribed', true);

    if (error) {
      console.error('Error fetching users with subscriptions:', error);
      return [];
    }

    // Deduplicate emails (in case a user is subscribed to multiple lounges)
    const uniqueEmails = [
      ...new Set(data?.map((d: any) => d.users.email) || []),
    ];

    console.log(`Found ${uniqueEmails.length} users with lounge subscriptions`);
    return uniqueEmails;
  }

  /**
   * Get users who should receive daily digests (legacy method)
   */
  static async getUsersForDailyDigest(): Promise<string[]> {
    // This method is kept for backward compatibility
    // Now it just calls the new method
    return this.getUsersWithLoungeSubscriptions();
  }
}
