import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

interface NewsContent {
  id: string;
  title: string;
  url: string;
  published_at: string;
  creator_name: string;
  engagement_metrics?: any;
  content_body?: string;
  platform: string;
}

interface Lounge {
  id: string;
  name: string;
  description?: string;
  theme_description?: string;
}

export class NewsAggregationService {
  private supabase: ReturnType<typeof createClient<Database>> | null = null;

  constructor() {
    this.initializeSupabase();
  }

  private initializeSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey && !this.supabase) {
      this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    }
  }

  /**
   * Get all active lounges that need daily summaries
   */
  async getActiveLounges(): Promise<Lounge[]> {
    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    const { data, error } = await this.supabase
      .from('lounges')
      .select('id, name, description, theme_description')
      .eq('is_system_lounge', true)
      .order('name');

    if (error) {
      console.error('Error fetching lounges:', error);
      throw error;
    }

    return (data || []).map((lounge) => ({
      ...lounge,
      description: lounge.description || undefined,
      theme_description: lounge.theme_description || undefined,
    }));
  }

  /**
   * Get news content for a specific lounge from the last 24 hours
   */
  async getNewsContentForLounge(
    loungeId: string,
    hoursAgo: number = 24
  ): Promise<NewsContent[]> {
    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    // Get creators in this lounge
    const { data: loungeCreators, error: creatorsError } = await this.supabase
      .from('creator_lounges')
      .select('creator_id')
      .eq('lounge_id', loungeId);

    if (creatorsError || !loungeCreators || loungeCreators.length === 0) {
      console.log(`No creators found for lounge ${loungeId}`);
      return [];
    }

    const creatorIds = loungeCreators.map((lc) => lc.creator_id);

    // Get news content from these creators
    const { data: content, error: contentError } = await this.supabase
      .from('content')
      .select(
        `
        id,
        title,
        url,
        published_at,
        platform,
        content_body,
        engagement_metrics,
        creator:creators(
          display_name
        )
      `
      )
      .in('creator_id', creatorIds)
      .gte('published_at', cutoffDate.toISOString())
      .eq('processing_status', 'processed')
      .eq('is_primary', true)
      .not('relevancy_checked_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(50);

    if (contentError) {
      console.error('Error fetching content:', contentError);
      throw contentError;
    }

    // Transform the data
    return (content || []).map((item) => ({
      id: item.id,
      title: item.title || 'Untitled',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
      platform: item.platform,
      creator_name: item.creator?.display_name || 'Unknown',
      engagement_metrics: item.engagement_metrics,
      content_body: item.content_body || undefined,
    }));
  }

  /**
   * Get general news content (not lounge-specific) from news creators
   */
  async getGeneralNewsContent(
    hoursAgo: number = 24,
    limit: number = 50
  ): Promise<NewsContent[]> {
    if (!this.supabase) {
      throw new Error('Supabase not initialized');
    }

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hoursAgo);

    // Get news creators (content_type = 'news')
    const { data: newsCreators, error: creatorsError } = await this.supabase
      .from('creators')
      .select('id')
      .eq('content_type', 'news');

    if (creatorsError || !newsCreators || newsCreators.length === 0) {
      console.log('No news creators found');
      return [];
    }

    const newsCreatorIds = newsCreators.map((c) => c.id);

    // Get news content
    const { data: content, error: contentError } = await this.supabase
      .from('content')
      .select(
        `
        id,
        title,
        url,
        published_at,
        platform,
        content_body,
        engagement_metrics,
        creator:creators(
          display_name
        )
      `
      )
      .in('creator_id', newsCreatorIds)
      .gte('published_at', cutoffDate.toISOString())
      .eq('processing_status', 'processed')
      .eq('is_primary', true)
      .not('relevancy_checked_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (contentError) {
      console.error('Error fetching news content:', contentError);
      throw contentError;
    }

    // Transform the data
    return (content || []).map((item) => ({
      id: item.id,
      title: item.title || 'Untitled',
      url: item.url,
      published_at: item.published_at || new Date().toISOString(),
      platform: item.platform,
      creator_name: item.creator?.display_name || 'Unknown',
      engagement_metrics: item.engagement_metrics,
      content_body: item.content_body || undefined,
    }));
  }

  /**
   * Prioritize content with funding/exit news for SaaS sector
   */
  prioritizeFundingNews(content: NewsContent[]): NewsContent[] {
    const fundingKeywords = [
      'funding',
      'raised',
      'investment',
      'series',
      'exit',
      'acquisition',
      'acquired',
      'ipo',
      'valuation',
      'venture',
      'capital',
      'seed',
      'merger',
      'sold',
      'buyout',
    ];

    return content.sort((a, b) => {
      const aTitle = (a.title || '').toLowerCase();
      const bTitle = (b.title || '').toLowerCase();
      const aBody = (a.content_body || '').toLowerCase();
      const bBody = (b.content_body || '').toLowerCase();

      // Check for funding keywords
      const aHasFunding = fundingKeywords.some(
        (kw) => aTitle.includes(kw) || aBody.includes(kw)
      );
      const bHasFunding = fundingKeywords.some(
        (kw) => bTitle.includes(kw) || bBody.includes(kw)
      );

      // Prioritize funding news
      if (aHasFunding && !bHasFunding) return -1;
      if (!aHasFunding && bHasFunding) return 1;

      // Then sort by engagement
      const aEngagement = this.calculateEngagementScore(a.engagement_metrics);
      const bEngagement = this.calculateEngagementScore(b.engagement_metrics);

      if (aEngagement !== bEngagement) {
        return bEngagement - aEngagement;
      }

      // Finally by date
      return (
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
      );
    });
  }

  /**
   * Calculate engagement score for prioritization
   */
  private calculateEngagementScore(metrics: any): number {
    if (!metrics) return 0;

    return (
      (metrics.views || 0) +
      (metrics.likes || 0) * 10 +
      (metrics.comments || 0) * 5 +
      (metrics.shares || 0) * 8
    );
  }

  /**
   * Get topic name for a lounge (for OpenAI prompt)
   */
  getTopicForLounge(lounge: Lounge): string {
    // Use theme description if available, otherwise use name
    if (lounge.theme_description) {
      return lounge.theme_description;
    }

    // Map common lounge names to topics
    const topicMap: Record<string, string> = {
      saas: 'SaaS and B2B Software',
      ai: 'Artificial Intelligence and Machine Learning',
      fintech: 'Financial Technology',
      ecommerce: 'E-commerce and Online Retail',
      crypto: 'Cryptocurrency and Blockchain',
      health: 'Healthcare and Digital Health',
      edtech: 'Education Technology',
      marketing: 'Marketing Technology and Growth',
      dev: 'Software Development and Engineering',
      productivity: 'Productivity and Collaboration Tools',
    };

    const lowerName = lounge.name.toLowerCase();
    for (const [key, value] of Object.entries(topicMap)) {
      if (lowerName.includes(key)) {
        return value;
      }
    }

    // Default: use the lounge name directly
    return lounge.name;
  }
}
