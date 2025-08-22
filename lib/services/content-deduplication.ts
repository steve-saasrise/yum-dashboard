import { createHash } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export interface ContentForDeduplication {
  title: string;
  description?: string;
  content_body?: string;
  url: string;
  platform: string;
  creator_id: string;
}

export interface DuplicateGroup {
  duplicate_group_id: string;
  primary_content_id: string;
  duplicate_count: number;
}

/**
 * Extract video ID from YouTube URL
 */
function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/,
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[2] && match[2].length === 11) {
      return match[2];
    }
  }
  return null;
}

/**
 * Extract video ID from platform-specific URLs
 */
function extractVideoId(url: string, platform: string): string | null {
  switch (platform.toLowerCase()) {
    case 'youtube':
      return extractYouTubeVideoId(url);
    default:
      return null;
  }
}

/**
 * Normalize text for consistent comparison
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace special characters with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Calculate similarity between two texts using Jaccard similarity of words
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(
    normalizeText(text1)
      .split(' ')
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    normalizeText(text2)
      .split(' ')
      .filter((w) => w.length > 2)
  );

  const intersection = new Set([...words1].filter((w) => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Create a content fingerprint for fuzzy matching
 * Uses first 100 significant words to create a stable signature
 */
function createContentFingerprint(text: string): string {
  const words = normalizeText(text)
    .split(' ')
    .filter((w) => w.length > 2) // Filter out short words
    .slice(0, 100); // Take first 100 significant words

  return words.join(' ');
}

/**
 * Get domain from URL for content context
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Get the most meaningful content text for hashing
 */
function getContentText(content: ContentForDeduplication): string {
  const { title, description, content_body, platform } = content;

  // For social media platforms, prefer description/content over generic titles
  if (
    platform === 'twitter' ||
    platform === 'threads' ||
    platform === 'linkedin'
  ) {
    // Use description (actual tweet/post content) if available, fallback to content_body, then title
    return description || content_body || title || '';
  }

  // For YouTube, RSS, etc., title is usually meaningful
  return title || description || content_body || '';
}

/**
 * Generate content hash for deduplication using fuzzy matching approach
 */
export function generateContentHash(content: ContentForDeduplication): string {
  const { url, platform, creator_id } = content;

  // Get the most relevant text content
  const contentText = getContentText(content);

  // For social media, use fuzzy fingerprinting to catch near-duplicates
  if (
    platform === 'twitter' ||
    platform === 'threads' ||
    platform === 'linkedin'
  ) {
    const fingerprint = createContentFingerprint(contentText);
    const components = [creator_id, fingerprint];

    const hashInput = components.join(':');
    return createHash('sha256').update(hashInput).digest('hex');
  }

  // For other content types, use exact matching with platform context
  const normalizedContent = normalizeText(contentText);
  const components = [creator_id, normalizedContent];

  // Add platform-specific context for certain types
  if (platform === 'youtube') {
    const videoId = extractVideoId(url, platform);
    if (videoId) {
      components.push(videoId);
    }
  } else if (platform === 'rss' || platform === 'website') {
    const domain = extractDomain(url);
    if (domain) {
      components.push(domain);
    }
  }

  // Generate SHA-256 hash
  const hashInput = components.join(':');
  return createHash('sha256').update(hashInput).digest('hex');
}

/**
 * Platform priority for determining primary content
 * Higher number = higher priority
 */
const PLATFORM_PRIORITY: Record<string, number> = {
  youtube: 10,
  twitter: 8,
  linkedin: 7,
  threads: 6,
  rss: 5,
  website: 4,
};

/**
 * Determine which content should be primary in a duplicate group
 */
export function selectPrimaryContent(
  contents: Array<{
    id: string;
    platform: string;
    published_at: string;
    engagement_metrics?: any;
  }>
): string {
  if (contents.length === 0) {
    throw new Error('No content provided for primary selection');
  }

  if (contents.length === 1) {
    return contents[0].id;
  }

  // Sort by priority (platform preference) then by published date (newer first)
  const sortedContents = contents.sort((a, b) => {
    const priorityA = PLATFORM_PRIORITY[a.platform] || 0;
    const priorityB = PLATFORM_PRIORITY[b.platform] || 0;

    if (priorityA !== priorityB) {
      return priorityB - priorityA; // Higher priority first
    }

    // If same platform, prefer newer content
    return (
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
  });

  return sortedContents[0].id;
}

/**
 * Content Deduplication Service
 */
export class ContentDeduplicationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Check if content hash already exists and return duplicate info
   */
  async findDuplicatesByHash(contentHash: string): Promise<{
    exists: boolean;
    duplicateGroupId?: string;
    existingContent?: Array<{
      id: string;
      platform: string;
      published_at: string;
      is_primary: boolean;
    }>;
  }> {
    const { data, error } = await this.supabase
      .from('content')
      .select('id, platform, published_at, is_primary, duplicate_group_id')
      .eq('content_hash', contentHash);

    if (error) {
      throw new Error(`Failed to check for duplicates: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { exists: false };
    }

    return {
      exists: true,
      duplicateGroupId: data[0]?.duplicate_group_id || undefined,
      existingContent: data,
    };
  }

  /**
   * Find similar content by creator using similarity threshold
   * Used as a fallback for cases where fingerprinting might miss near-duplicates
   */
  async findSimilarContentByCreator(
    creatorId: string,
    contentText: string,
    platform: string,
    similarityThreshold: number = 0.85
  ): Promise<{
    exists: boolean;
    duplicateGroupId?: string;
    existingContent?: Array<{
      id: string;
      platform: string;
      published_at: string;
      is_primary: boolean;
      description: string;
    }>;
  }> {
    // Only check for social media platforms and only recent content (last 30 days)
    if (!['twitter', 'linkedin', 'threads'].includes(platform)) {
      return { exists: false };
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await this.supabase
      .from('content')
      .select(
        'id, platform, published_at, is_primary, duplicate_group_id, description'
      )
      .eq('creator_id', creatorId)
      .in('platform', ['twitter', 'linkedin', 'threads'])
      .gte('published_at', thirtyDaysAgo.toISOString())
      .not('content_hash', 'is', null);

    if (error) {
      throw new Error(`Failed to check for similar content: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return { exists: false };
    }

    // Check similarity with each piece of content
    for (const item of data) {
      if (item.description) {
        const similarity = calculateTextSimilarity(
          contentText,
          item.description
        );
        if (similarity >= similarityThreshold) {
          return {
            exists: true,
            duplicateGroupId: item.duplicate_group_id || undefined,
            existingContent: data.filter(
              (d) =>
                d.duplicate_group_id === item.duplicate_group_id ||
                d.id === item.id
            ),
          };
        }
      }
    }

    return { exists: false };
  }

  /**
   * Process content for deduplication during ingestion
   */
  async processContentForDeduplication(
    content: ContentForDeduplication & {
      id: string;
      published_at: string;
    }
  ): Promise<{
    contentHash: string;
    duplicateGroupId: string | null;
    isPrimary: boolean;
    shouldStore: boolean;
  }> {
    const contentHash = generateContentHash(content);
    const contentText = getContentText(content);

    // Check for existing duplicates by hash first
    let duplicateInfo = await this.findDuplicatesByHash(contentHash);

    // If no hash matches, try similarity-based matching for social media
    if (
      !duplicateInfo.exists &&
      ['twitter', 'linkedin', 'threads'].includes(content.platform)
    ) {
      duplicateInfo = await this.findSimilarContentByCreator(
        content.creator_id,
        contentText,
        content.platform,
        0.85 // 85% similarity threshold
      );
    }

    if (!duplicateInfo.exists) {
      // No duplicates found, this is primary
      return {
        contentHash,
        duplicateGroupId: null,
        isPrimary: true,
        shouldStore: true,
      };
    }

    // Duplicates exist, determine if this should be primary
    // Ensure existingContent is an array
    const existingContent = Array.isArray(duplicateInfo.existingContent)
      ? duplicateInfo.existingContent
      : [];

    const allContent = [
      ...existingContent,
      {
        id: content.id,
        platform: content.platform,
        published_at: content.published_at,
        is_primary: false, // Will be determined below
      },
    ];

    const newPrimaryId = selectPrimaryContent(allContent);
    const isNewContentPrimary = newPrimaryId === content.id;

    // If new content becomes primary, update existing content
    if (isNewContentPrimary && duplicateInfo.duplicateGroupId) {
      await this.supabase
        .from('content')
        .update({ is_primary: false })
        .eq('duplicate_group_id', duplicateInfo.duplicateGroupId);
    }

    return {
      contentHash,
      duplicateGroupId: duplicateInfo.duplicateGroupId || `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      isPrimary: isNewContentPrimary,
      shouldStore: true, // We still store duplicates but mark them appropriately
    };
  }

  /**
   * Get duplicate groups for management
   */
  async getDuplicateGroups(
    limit = 50,
    offset = 0
  ): Promise<{
    groups: DuplicateGroup[];
    total: number;
  }> {
    const { data, error, count } = await this.supabase
      .from('content')
      .select('duplicate_group_id, is_primary', { count: 'exact' })
      .not('duplicate_group_id', 'is', null)
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch duplicate groups: ${error.message}`);
    }

    // Group and count duplicates
    const groupMap = new Map<
      string,
      { primary_content_id: string | null; count: number }
    >();

    data?.forEach((item) => {
      const groupId = item.duplicate_group_id!;
      const existing = groupMap.get(groupId) || {
        primary_content_id: null,
        count: 0,
      };
      existing.count++;
      groupMap.set(groupId, existing);
    });

    const groups: DuplicateGroup[] = Array.from(groupMap.entries()).map(
      ([groupId, info]) => ({
        duplicate_group_id: groupId,
        primary_content_id: info.primary_content_id || '',
        duplicate_count: info.count,
      })
    );

    return {
      groups,
      total: count || 0,
    };
  }

  /**
   * Manually override primary content in a duplicate group
   */
  async setPrimaryContent(
    duplicateGroupId: string,
    newPrimaryId: string
  ): Promise<void> {
    // First, set all content in group to non-primary
    await this.supabase
      .from('content')
      .update({ is_primary: false })
      .eq('duplicate_group_id', duplicateGroupId);

    // Then set the new primary
    const { error } = await this.supabase
      .from('content')
      .update({ is_primary: true })
      .eq('id', newPrimaryId)
      .eq('duplicate_group_id', duplicateGroupId);

    if (error) {
      throw new Error(`Failed to set primary content: ${error.message}`);
    }
  }
}
