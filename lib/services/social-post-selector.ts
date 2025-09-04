import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

interface SocialPost {
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
  engagement_metrics?: {
    likes?: number;
    views?: number;
    shares?: number;
    comments?: number;
  };
  relevancy_score?: number;
  creator: {
    display_name: string;
  };
}

interface SelectedPost extends SocialPost {
  selectionReason?: string;
  aiGeneratedImage?: boolean;
}

export class SocialPostSelector {
  private openai: OpenAI | null = null;
  private supabase: ReturnType<typeof createClient<Database>> | null = null;

  constructor() {
    this.initializeServices();
  }

  private initializeServices() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && !this.openai) {
      this.openai = new OpenAI({ apiKey });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

    if (supabaseUrl && supabaseServiceKey && !this.supabase) {
      this.supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
    }
  }

  /**
   * Select top 5 social posts using AI, prioritizing platform diversity
   */
  async selectTopPosts(
    posts: SocialPost[],
    loungeTheme: string,
    targetCount: number = 5
  ): Promise<SelectedPost[]> {
    if (!this.openai) {
      console.error('OpenAI API not configured, falling back to basic selection');
      return this.fallbackSelection(posts, targetCount);
    }

    if (posts.length === 0) {
      return [];
    }

    // If we have 5 or fewer posts, return them all
    if (posts.length <= targetCount) {
      return posts;
    }

    try {
      // Prepare posts data for AI selection
      const postsData = posts.map((post, index) => ({
        index,
        platform: post.platform,
        title: post.title,
        description: post.description?.substring(0, 100) || post.ai_summary_short?.substring(0, 100) || '',
        creator: post.creator.display_name,
        relevancy: post.relevancy_score || 0,
        engagement: this.calculateEngagementScore(post.engagement_metrics),
        published: post.published_at,
        hasImage: !!post.thumbnail_url,
      }));

      // Create platform distribution summary
      const platformCounts = posts.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const prompt = `You are curating social media posts for a ${loungeTheme} email digest. Select the ${targetCount} MOST RELEVANT and ENGAGING posts that would interest ${loungeTheme} professionals.

SELECTION CRITERIA:
1. Platform Diversity: Try to select 1 post from each platform when possible (YouTube, X/Twitter, LinkedIn, Threads, RSS/Blog)
2. Relevance: Posts most relevant to ${loungeTheme} topics
3. Engagement: Prefer posts with higher engagement scores
4. Recency: Recent posts are preferred
5. Quality: Choose posts with substantive content over simple reactions

AVAILABLE PLATFORMS & COUNTS:
${Object.entries(platformCounts).map(([platform, count]) => `${platform}: ${count} posts`).join('\n')}

POSTS DATA:
${JSON.stringify(postsData, null, 2)}

Return a JSON object with:
{
  "selectedIndices": [array of ${targetCount} post indices],
  "reasoning": "Brief explanation of selection logic"
}

IMPORTANT: 
- Return EXACTLY ${targetCount} unique indices
- Prioritize getting 1 from each platform first
- Fill remaining slots with best posts regardless of platform
- Indices must be valid (0 to ${posts.length - 1})`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-5-mini', // Using GPT-5 mini as requested
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media curator for professional email digests. Always return valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        console.error('No response from OpenAI');
        return this.fallbackSelection(posts, targetCount);
      }

      const result = JSON.parse(response);
      const selectedIndices = result.selectedIndices || [];

      // Validate indices and get selected posts
      const selectedPosts: SelectedPost[] = [];
      const usedIndices = new Set<number>();

      for (const index of selectedIndices) {
        if (
          typeof index === 'number' &&
          index >= 0 &&
          index < posts.length &&
          !usedIndices.has(index)
        ) {
          usedIndices.add(index);
          selectedPosts.push({
            ...posts[index],
            selectionReason: result.reasoning,
          });
        }
      }

      // If we don't have enough posts, fill with fallback selection
      if (selectedPosts.length < targetCount) {
        const fallbackPosts = this.fallbackSelection(
          posts.filter((_, i) => !usedIndices.has(i)),
          targetCount - selectedPosts.length
        );
        selectedPosts.push(...fallbackPosts);
      }

      console.log(`AI selected ${selectedPosts.length} posts using GPT-5 mini`);
      return selectedPosts.slice(0, targetCount);
    } catch (error) {
      console.error('Error in AI post selection:', error);
      return this.fallbackSelection(posts, targetCount);
    }
  }

  /**
   * Fallback selection logic when AI is not available
   */
  private fallbackSelection(posts: SocialPost[], targetCount: number): SelectedPost[] {
    // Group posts by platform
    const platformGroups = new Map<string, SocialPost[]>();
    posts.forEach((post) => {
      const platform = post.platform;
      if (!platformGroups.has(platform)) {
        platformGroups.set(platform, []);
      }
      platformGroups.get(platform)!.push(post);
    });

    const selected: SelectedPost[] = [];
    const platforms = ['youtube', 'twitter', 'linkedin', 'threads', 'rss', 'website'];

    // First pass: Get one from each platform
    for (const platform of platforms) {
      if (selected.length >= targetCount) break;
      
      const platformPosts = platformGroups.get(platform) || [];
      if (platformPosts.length > 0) {
        // Sort by engagement and relevancy
        const sorted = platformPosts.sort((a, b) => {
          const scoreA = this.calculateOverallScore(a);
          const scoreB = this.calculateOverallScore(b);
          return scoreB - scoreA;
        });
        selected.push(sorted[0]);
      }
    }

    // Second pass: Fill remaining slots with best posts
    if (selected.length < targetCount) {
      const remainingPosts = posts
        .filter((post) => !selected.includes(post))
        .sort((a, b) => {
          const scoreA = this.calculateOverallScore(a);
          const scoreB = this.calculateOverallScore(b);
          return scoreB - scoreA;
        });

      const needed = targetCount - selected.length;
      selected.push(...remainingPosts.slice(0, needed));
    }

    return selected.slice(0, targetCount);
  }

  /**
   * Calculate engagement score for a post
   */
  private calculateEngagementScore(metrics?: any): number {
    if (!metrics) return 0;
    
    const likes = metrics.likes || 0;
    const views = metrics.views || 0;
    const shares = metrics.shares || 0;
    const comments = metrics.comments || 0;

    // Weighted engagement score
    return likes * 10 + views * 0.1 + shares * 20 + comments * 15;
  }

  /**
   * Calculate overall score for fallback selection
   */
  private calculateOverallScore(post: SocialPost): number {
    const engagementScore = this.calculateEngagementScore(post.engagement_metrics);
    const relevancyScore = (post.relevancy_score || 0) * 10;
    
    // Time decay factor (newer posts get higher score)
    const hoursAgo = (Date.now() - new Date(post.published_at).getTime()) / (1000 * 60 * 60);
    const recencyScore = Math.max(0, 100 - hoursAgo * 2);

    return engagementScore + relevancyScore + recencyScore;
  }

  /**
   * Format engagement metrics for display
   */
  static formatEngagement(metrics?: any): string {
    if (!metrics) return '';

    const parts = [];
    if (metrics.likes) {
      parts.push(`❤️ ${metrics.likes.toLocaleString()}`);
    }
    if (metrics.views) {
      parts.push(`👁️ ${metrics.views.toLocaleString()}`);
    }
    if (metrics.comments) {
      parts.push(`💬 ${metrics.comments.toLocaleString()}`);
    }

    return parts.join(' · ');
  }
}