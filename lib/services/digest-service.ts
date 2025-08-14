import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { DailyDigestEmail } from '@/emails/daily-digest';

const resend = new Resend(process.env.RESEND_API_KEY);
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
   * Get content for a specific lounge
   * Implements the logic: 9 most recent posts + at least 1 YouTube video
   * Prioritizes content from last 24 hours, falls back to older if needed
   */
  static async getContentForLounge(
    loungeId: string,
    limit: number = 10
  ): Promise<ContentForDigest[]> {
    const supabase = getSupabaseClient();

    // First, get creators associated with this lounge
    const { data: creatorIds, error: creatorError } = await supabase
      .from('creator_lounges')
      .select('creator_id')
      .eq('lounge_id', loungeId);

    if (creatorError) {
      console.error('Error fetching creators for lounge:', creatorError);
      throw creatorError;
    }

    if (!creatorIds || creatorIds.length === 0) {
      return [];
    }

    const creatorIdList = creatorIds.map((c: any) => c.creator_id);

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // First try to get content from last 24 hours
    let { data: allContent } = await supabase
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
        creators!inner(
          display_name
        )
      `
      )
      .in('creator_id', creatorIdList)
      .eq('processing_status', 'processed')
      .gte('published_at', twentyFourHoursAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit * 2);

    // If not enough content from last 24 hours, get older content
    if (!allContent || allContent.length < limit) {
      const { data: olderContent, error: olderError } = await supabase
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
          creators!inner(
            display_name
          )
        `
        )
        .in('creator_id', creatorIdList)
        .eq('processing_status', 'processed')
        .order('published_at', { ascending: false })
        .limit(limit * 2);

      if (olderError) {
        console.error('Error fetching older content:', olderError);
      } else {
        allContent = olderContent;
      }
    }

    const contentError = null; // Add this for compatibility with error handling below

    if (contentError) {
      console.error('Error fetching content:', contentError);
      throw contentError;
    }

    if (!allContent || allContent.length === 0) {
      return [];
    }

    // Separate YouTube videos from other content
    const youtubeVideos = allContent.filter(
      (c: any) => c.platform === 'youtube'
    );
    const otherContent = allContent.filter(
      (c: any) => c.platform !== 'youtube'
    );

    // Ensure at least 1 YouTube video if available
    const selectedContent: ContentForDigest[] = [];

    // Add at least one YouTube video if available
    if (youtubeVideos.length > 0) {
      const video: any = youtubeVideos[0];
      selectedContent.push({
        ...video,
        creator: video.creators,
      });
    }

    // Fill the rest with other content (up to 9 items if we have 1 YouTube video)
    const remainingSlots = limit - selectedContent.length;
    const additionalContent = otherContent.slice(0, remainingSlots);

    selectedContent.push(
      ...additionalContent.map((c: any) => ({
        ...c,
        creator: c.creators,
      }))
    );

    // If we still have slots and more YouTube videos, add them
    if (selectedContent.length < limit && youtubeVideos.length > 1) {
      const additionalYouTube = youtubeVideos
        .slice(1, limit - selectedContent.length + 1)
        .map((c: any) => ({
          ...c,
          creator: c.creators,
        }));
      selectedContent.push(...additionalYouTube);
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
      // Get content for this lounge
      const content = await this.getContentForLounge(lounge.id);

      if (content.length === 0) {
        console.log(
          `No content available for ${lounge.name} lounge, skipping digest`
        );
        return;
      }

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
      }));

      // Send email
      const { error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: recipientEmail,
        subject: `${lounge.name} Daily Digest - ${content.length} updates`,
        react: DailyDigestEmail({
          loungeName: lounge.name,
          loungeDescription: lounge.description,
          content: emailContent,
          recipientEmail,
          unsubscribeUrl,
          date,
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
      .select('id, name, description')
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
