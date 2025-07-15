import { z } from 'zod';

export enum Platform {
  YOUTUBE = 'youtube',
  TWITTER = 'twitter',
  LINKEDIN = 'linkedin',
  THREADS = 'threads',
  RSS = 'rss',
  UNKNOWN = 'unknown',
}

export interface PlatformInfo {
  platform: Platform;
  platformUserId: string;
  profileUrl: string;
  metadata: {
    channelId?: string;
    username?: string;
    companyId?: string;
    feedUrl?: string;
    feedType?: 'rss' | 'atom';
  };
}

export class PlatformDetectionError extends Error {
  constructor(
    public code: 'INVALID_URL' | 'UNSUPPORTED_PLATFORM' | 'PARSE_ERROR',
    message: string,
    public url?: string
  ) {
    super(message);
    this.name = 'PlatformDetectionError';
  }
}

const urlSchema = z.string().url();

export class PlatformDetector {
  private static readonly patterns = {
    [Platform.YOUTUBE]: [
      /^https?:\/\/(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /^https?:\/\/(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ],
    [Platform.TWITTER]: [
      /^https?:\/\/(?:www\.)?twitter\.com\/([a-zA-Z0-9_]+)/,
      /^https?:\/\/(?:www\.)?x\.com\/([a-zA-Z0-9_]+)/,
    ],
    [Platform.LINKEDIN]: [
      /^https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9-]+)/,
      /^https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9-]+)/,
    ],
    [Platform.THREADS]: [
      // Profile URLs with @username
      /^https?:\/\/(?:www\.)?threads\.(?:com|net)\/@([a-zA-Z0-9._]+)/,
      // Post URLs format: threads.com/t/PostID
      /^https?:\/\/(?:www\.)?threads\.(?:com|net)\/t\/[a-zA-Z0-9_-]+/,
      // Post URLs with username: threads.com/@username/post/PostID
      /^https?:\/\/(?:www\.)?threads\.(?:com|net)\/@([a-zA-Z0-9._]+)\/post\/[a-zA-Z0-9_-]+/,
    ],
    [Platform.RSS]: [
      /\.(rss|xml|atom)(?:\?.*)?$/i,
      /\/feed\/?(?:\?.*)?$/i,
      /\/rss\/?(?:\?.*)?$/i,
      /\/atom\/?(?:\?.*)?$/i,
    ],
  };

  static detect(url: string): PlatformInfo {
    // Validate URL format first
    const trimmedUrl = url.trim();
    try {
      urlSchema.parse(trimmedUrl);
    } catch {
      throw new PlatformDetectionError(
        'INVALID_URL',
        'Invalid URL format',
        url
      );
    }

    // Normalize URL for pattern matching
    const normalizedUrl = trimmedUrl.toLowerCase();

    // Try to match against each platform
    for (const [platform, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        const match = normalizedUrl.match(pattern);
        if (match) {
          return this.extractPlatformInfo(
            platform as Platform,
            trimmedUrl,
            match
          );
        }
      }
    }

    throw new PlatformDetectionError(
      'UNSUPPORTED_PLATFORM',
      'URL does not match any supported platform',
      url
    );
  }

  private static extractPlatformInfo(
    platform: Platform,
    originalUrl: string,
    match: RegExpMatchArray
  ): PlatformInfo {
    // Extract the captured group from the original match (case-sensitive)
    const patterns = this.patterns[platform as keyof typeof this.patterns];
    const matchingPattern = patterns.find((p: RegExp) =>
      originalUrl.toLowerCase().match(p)
    );
    const originalMatch = matchingPattern
      ? originalUrl.match(matchingPattern)
      : null;
    const platformUserId = originalMatch?.[1] || match[1] || '';

    switch (platform) {
      case Platform.YOUTUBE:
        return {
          platform,
          platformUserId,
          profileUrl: originalUrl,
          metadata: {
            channelId: this.isChannelId(platformUserId)
              ? platformUserId
              : undefined,
            username: !this.isChannelId(platformUserId)
              ? platformUserId
              : undefined,
          },
        };

      case Platform.TWITTER:
        return {
          platform,
          platformUserId,
          profileUrl: originalUrl,
          metadata: {
            username: platformUserId,
          },
        };

      case Platform.LINKEDIN:
        const isCompany = originalUrl.includes('/company/');
        return {
          platform,
          platformUserId,
          profileUrl: originalUrl,
          metadata: {
            companyId: isCompany ? platformUserId : undefined,
            username: !isCompany ? platformUserId : undefined,
          },
        };

      case Platform.THREADS: {
        let userId = platformUserId;
        let profileUrl = originalUrl;

        // For post URLs without username, extract from URL path
        if (!userId && originalUrl.includes('/t/')) {
          // This is a post URL without username - we'll use the domain as identifier
          userId = 'threads-post';
        }

        // Convert post URLs to profile URLs when possible
        if (userId && userId !== 'threads-post') {
          profileUrl = `https://www.threads.com/@${userId}`;
        }

        return {
          platform,
          platformUserId: userId,
          profileUrl,
          metadata: {
            username: userId !== 'threads-post' ? userId : undefined,
          },
        };
      }

      case Platform.RSS:
        const feedType = this.determineFeedType(originalUrl);
        return {
          platform,
          platformUserId: this.extractDomainFromUrl(originalUrl),
          profileUrl: originalUrl,
          metadata: {
            feedUrl: originalUrl,
            feedType,
          },
        };

      default:
        throw new PlatformDetectionError(
          'PARSE_ERROR',
          'Failed to extract platform information',
          originalUrl
        );
    }
  }

  private static isChannelId(id: string): boolean {
    return id.startsWith('UC') && id.length === 24;
  }

  private static determineFeedType(url: string): 'rss' | 'atom' {
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.includes('atom')) return 'atom';
    return 'rss';
  }

  private static extractDomainFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }
}
