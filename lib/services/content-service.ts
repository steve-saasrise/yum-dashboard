import { SupabaseClient } from '@supabase/supabase-js';
import {
  Content,
  CreateContentInput,
  UpdateContentInput,
  ContentFilters,
  BatchContentResult,
  ContentError,
  CreateContentInputSchema,
  UpdateContentInputSchema,
  ContentFiltersSchema,
  calculateWordCount,
  calculateReadingTime,
  extractTextFromHTML,
} from '@/types/content';
import {
  ContentDeduplicationService,
  generateContentHash,
} from './content-deduplication';

export class ContentService {
  private deduplicationService: ContentDeduplicationService;

  constructor(private supabase: SupabaseClient) {
    this.deduplicationService = new ContentDeduplicationService(supabase);
  }

  /**
   * Store a single content item with duplicate checking
   */
  async storeContent(input: CreateContentInput): Promise<Content> {
    // Validate input
    const validation = CreateContentInputSchema.safeParse(input);
    if (!validation.success) {
      throw new ContentError(
        `Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }

    const validatedInput = validation.data;

    // Check for duplicates
    const duplicate = await this.checkDuplicate(
      validatedInput.creator_id,
      validatedInput.platform_content_id,
      validatedInput.platform
    );

    if (duplicate) {
      throw new ContentError(
        'Content already exists for this creator and platform',
        'DUPLICATE_CONTENT',
        409
      );
    }

    // Calculate metrics if not provided
    const content_body = validatedInput.content_body || '';
    const textContent = extractTextFromHTML(content_body);
    const word_count =
      validatedInput.word_count ?? calculateWordCount(textContent);
    const reading_time_minutes =
      validatedInput.reading_time_minutes ?? calculateReadingTime(textContent);

    // Generate temporary ID for deduplication processing
    const tempContentId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

    // Process deduplication
    const deduplicationResult =
      await this.deduplicationService.processContentForDeduplication({
        id: tempContentId,
        title: validatedInput.title || '',
        description: validatedInput.description,
        content_body: validatedInput.content_body,
        url: validatedInput.url,
        platform: validatedInput.platform,
        creator_id: validatedInput.creator_id,
        published_at: validatedInput.published_at || new Date().toISOString(),
      });

    // Insert content with deduplication fields
    const { data, error } = await this.supabase
      .from('content')
      .insert({
        ...validatedInput,
        word_count,
        reading_time_minutes,
        media_urls: validatedInput.media_urls || [],
        engagement_metrics: validatedInput.engagement_metrics || {},
        // Add deduplication fields
        content_hash: deduplicationResult.contentHash,
        duplicate_group_id: deduplicationResult.duplicateGroupId,
        is_primary: deduplicationResult.isPrimary,
        // IMPORTANT: Content with processing_status = 'pending' will NOT appear in the dashboard
        // Only content with processing_status = 'processed' is shown to users
        // Add new platforms here when implementing their fetchers
        processing_status:
          validatedInput.platform === 'rss' ||
          validatedInput.platform === 'youtube' ||
          validatedInput.platform === 'twitter' ||
          validatedInput.platform === 'threads' ||
          validatedInput.platform === 'linkedin'
            ? 'processed'
            : 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new ContentError(
        `Failed to store content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data as Content;
  }

  /**
   * Store multiple content items with transaction support
   */
  async storeMultipleContent(
    inputs: CreateContentInput[]
  ): Promise<BatchContentResult> {
    const result: BatchContentResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    // Process each content item
    for (const input of inputs) {
      try {
        // Check if content exists
        const exists = await this.checkDuplicate(
          input.creator_id,
          input.platform_content_id,
          input.platform
        );

        if (exists) {
          // Update existing content if it exists
          await this.updateContentByPlatformId(
            input.creator_id,
            input.platform_content_id,
            input.platform,
            {
              title: input.title,
              description: input.description,
              thumbnail_url: input.thumbnail_url,
              content_body: input.content_body,
              media_urls: input.media_urls,
              engagement_metrics: input.engagement_metrics,
            }
          );
          result.updated++;
        } else {
          // Create new content
          await this.storeContent(input);
          result.created++;
        }
      } catch (error) {
        result.errors.push({
          platform_content_id: input.platform_content_id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        result.success = false;
      }
    }

    result.skipped =
      inputs.length - result.created - result.updated - result.errors.length;
    return result;
  }

  /**
   * Check if content already exists
   */
  async checkDuplicate(
    creator_id: string,
    platform_content_id: string,
    platform: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('content')
      .select('id')
      .eq('creator_id', creator_id)
      .eq('platform_content_id', platform_content_id)
      .eq('platform', platform)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows found" which is expected
      throw new ContentError(
        `Failed to check duplicate: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return !!data;
  }

  /**
   * Update content by ID
   */
  async updateContent(
    contentId: string,
    input: UpdateContentInput
  ): Promise<Content> {
    // Validate input
    const validation = UpdateContentInputSchema.safeParse(input);
    if (!validation.success) {
      throw new ContentError(
        `Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }

    const { data, error } = await this.supabase
      .from('content')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contentId)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ContentError('Content not found', 'CONTENT_NOT_FOUND', 404);
      }
      throw new ContentError(
        `Failed to update content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data as Content;
  }

  /**
   * Update content by platform ID (for batch operations)
   */
  async updateContentByPlatformId(
    creator_id: string,
    platform_content_id: string,
    platform: string,
    input: UpdateContentInput
  ): Promise<Content> {
    const validation = UpdateContentInputSchema.safeParse(input);
    if (!validation.success) {
      throw new ContentError(
        `Validation error: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }

    const { data, error } = await this.supabase
      .from('content')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString(),
      })
      .eq('creator_id', creator_id)
      .eq('platform_content_id', platform_content_id)
      .eq('platform', platform)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ContentError('Content not found', 'CONTENT_NOT_FOUND', 404);
      }
      throw new ContentError(
        `Failed to update content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data as Content;
  }

  /**
   * Get content by ID
   */
  async getContent(contentId: string): Promise<Content> {
    const { data, error } = await this.supabase
      .from('content')
      .select('*')
      .eq('id', contentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ContentError('Content not found', 'CONTENT_NOT_FOUND', 404);
      }
      throw new ContentError(
        `Failed to fetch content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data as Content;
  }

  /**
   * Get filtered content list
   */
  async getContentList(filters: ContentFilters = {}): Promise<{
    content: Content[];
    total: number;
  }> {
    // Validate filters
    const validation = ContentFiltersSchema.safeParse(filters);
    if (!validation.success) {
      throw new ContentError(
        `Invalid filters: ${validation.error.errors.map((e) => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }

    const validatedFilters = validation.data;
    const {
      creator_id,
      platform,
      processing_status,
      from_date,
      to_date,
      search,
      limit = 20,
      offset = 0,
      sort_by = 'published_at',
      sort_order = 'desc',
    } = validatedFilters;

    // Build query
    let query = this.supabase.from('content').select('*', { count: 'exact' });

    // Apply filters
    if (creator_id) {
      query = query.eq('creator_id', creator_id);
    }
    if (platform) {
      query = query.eq('platform', platform);
    }
    if (processing_status) {
      query = query.eq('processing_status', processing_status);
    }
    if (from_date) {
      query = query.gte('published_at', from_date);
    }
    if (to_date) {
      query = query.lte('published_at', to_date);
    }
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,description.ilike.%${search}%,content_body.ilike.%${search}%`
      );
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new ContentError(
        `Failed to fetch content list: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return {
      content: (data || []) as Content[],
      total: count || 0,
    };
  }

  /**
   * Delete content by ID
   */
  async deleteContent(contentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('content')
      .delete()
      .eq('id', contentId);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new ContentError('Content not found', 'CONTENT_NOT_FOUND', 404);
      }
      throw new ContentError(
        `Failed to delete content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }
  }

  /**
   * Delete content by creator
   */
  async deleteContentByCreator(creatorId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('content')
      .delete()
      .eq('creator_id', creatorId)
      .select();

    if (error) {
      throw new ContentError(
        `Failed to delete creator content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data?.length || 0;
  }

  /**
   * Mark content as processed
   */
  async markContentProcessed(
    contentId: string,
    aiSummary?: string
  ): Promise<Content> {
    return this.updateContent(contentId, {
      processing_status: 'processed',
      ai_summary: aiSummary,
      error_message: undefined,
    });
  }

  /**
   * Mark content as failed
   */
  async markContentFailed(
    contentId: string,
    errorMessage: string
  ): Promise<Content> {
    return this.updateContent(contentId, {
      processing_status: 'failed',
      error_message: errorMessage,
    });
  }

  /**
   * Mark all pending RSS content as processed (migration helper)
   */
  async processAllPendingRSSContent(): Promise<number> {
    const { data, error } = await this.supabase
      .from('content')
      .update({ processing_status: 'processed' })
      .eq('platform', 'rss')
      .eq('processing_status', 'pending')
      .select();

    if (error) {
      throw new ContentError(
        `Failed to process pending RSS content: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    return data?.length || 0;
  }

  /**
   * Get content statistics for a creator
   */
  async getCreatorContentStats(creatorId: string): Promise<{
    total: number;
    byPlatform: Record<string, number>;
    byStatus: Record<string, number>;
    lastUpdated?: string;
  }> {
    const { data, error } = await this.supabase
      .from('content')
      .select('platform, processing_status, updated_at')
      .eq('creator_id', creatorId);

    if (error) {
      throw new ContentError(
        `Failed to fetch content stats: ${error.message}`,
        'STORAGE_ERROR',
        500
      );
    }

    const stats = {
      total: data?.length || 0,
      byPlatform: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      lastUpdated: undefined as string | undefined,
    };

    if (data && data.length > 0) {
      // Count by platform
      data.forEach((item) => {
        stats.byPlatform[item.platform] =
          (stats.byPlatform[item.platform] || 0) + 1;
        stats.byStatus[item.processing_status || 'pending'] =
          (stats.byStatus[item.processing_status || 'pending'] || 0) + 1;
      });

      // Get most recent update
      const sortedByDate = data.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
      stats.lastUpdated = sortedByDate[0].updated_at;
    }

    return stats;
  }
}
