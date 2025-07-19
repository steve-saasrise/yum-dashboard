import Parser from 'rss-parser';
import {
  RSSFeed,
  RSSFetchResult,
  RSSFetchOptions,
  RSSFetchError,
  RSSErrorCode,
  DEFAULT_RSS_FETCH_OPTIONS,
  RSS_ERROR_MESSAGES,
  isValidRSSUrl,
  normalizeRSSDate,
} from '@/types/rss';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';

/**
 * RSS Fetcher Service
 *
 * Handles fetching and parsing RSS feeds from various sources.
 * Provides error handling, timeout management, and data normalization.
 */
export class RSSFetcher {
  private parser: Parser;

  constructor(private options: RSSFetchOptions = {}) {
    const mergedOptions = { ...DEFAULT_RSS_FETCH_OPTIONS, ...options };

    this.parser = new Parser({
      timeout: mergedOptions.timeout,
      customFields: mergedOptions.customFields,
      headers: {
        'User-Agent':
          mergedOptions.userAgent || DEFAULT_RSS_FETCH_OPTIONS.userAgent!,
        ...mergedOptions.headers,
      },
    });
  }

  /**
   * Fetch and parse a single RSS feed from a URL
   */
  async parseURL(
    url: string,
    options?: Partial<RSSFetchOptions>
  ): Promise<RSSFetchResult> {
    const startTime = Date.now();

    try {
      // Validate URL
      if (!isValidRSSUrl(url)) {
        throw new RSSFetchError(
          RSS_ERROR_MESSAGES.INVALID_URL,
          'INVALID_URL',
          400,
          url
        );
      }

      // Merge options for this specific request
      const fetchOptions = { ...this.options, ...options };

      // Create a new parser with request-specific options if needed
      let parser = this.parser;
      if (options) {
        parser = new Parser({
          timeout: fetchOptions.timeout,
          customFields: fetchOptions.customFields,
          headers: {
            'User-Agent':
              fetchOptions.userAgent || DEFAULT_RSS_FETCH_OPTIONS.userAgent!,
            ...fetchOptions.headers,
          },
        });
      }

      // Fetch and parse the RSS feed
      const rawFeed = await parser.parseURL(url);

      // Normalize the feed data
      const normalizedFeed = this.normalizeFeed(rawFeed, url, fetchOptions);

      const responseTime = Date.now() - startTime;

      // Store content if storage is enabled
      let storedContent = undefined;
      if (
        fetchOptions.storage?.enabled &&
        fetchOptions.storage.supabaseClient &&
        fetchOptions.storage.creator_id
      ) {
        storedContent = await this.storeContent(
          normalizedFeed,
          fetchOptions.storage
        );
      }

      return {
        success: true,
        feed: normalizedFeed,
        fetchedAt: new Date(),
        responseTime,
        storedContent,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const rssError = this.handleError(error, url);

      return {
        success: false,
        error: rssError.message,
        fetchedAt: new Date(),
        responseTime,
      };
    }
  }

  /**
   * Parse RSS content from a string
   */
  async parseString(
    content: string,
    feedUrl?: string
  ): Promise<RSSFetchResult> {
    const startTime = Date.now();

    try {
      const rawFeed = await this.parser.parseString(content);
      const normalizedFeed = this.normalizeFeed(
        rawFeed,
        feedUrl || 'string-content'
      );

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        feed: normalizedFeed,
        fetchedAt: new Date(),
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const rssError = this.handleError(error, feedUrl);

      return {
        success: false,
        error: rssError.message,
        fetchedAt: new Date(),
        responseTime,
      };
    }
  }

  /**
   * Fetch multiple RSS feeds in parallel
   */
  async parseMultipleFeeds(
    urls: string[],
    options?: Partial<RSSFetchOptions>
  ): Promise<RSSFetchResult[]> {
    const promises = urls.map((url) => this.parseURL(url, options));
    return Promise.all(promises);
  }

  /**
   * Test if a URL contains a valid RSS feed
   */
  async testFeed(url: string): Promise<boolean> {
    try {
      const result = await this.parseURL(url, { timeout: 5000, maxItems: 1 });
      return result.success && !!result.feed;
    } catch {
      return false;
    }
  }

  /**
   * Normalize raw feed data from rss-parser to our standard format
   */
  private normalizeFeed(
    rawFeed: {
      title?: string;
      description?: string;
      link?: string;
      feedUrl?: string;
      lastBuildDate?: string;
      language?: string;
      copyright?: string;
      generator?: string;
      docs?: string;
      managingEditor?: string;
      webMaster?: string;
      pubDate?: string;
      ttl?: string | number;
      image?: {
        url?: string;
        title?: string;
        link?: string;
        width?: string;
        height?: string;
      };
      itunes?: Record<string, unknown>;
      items?: Array<{
        title?: string;
        link?: string;
        pubDate?: string;
        isoDate?: string;
        creator?: string;
        author?: string;
        'dc:creator'?: string;
        content?: string;
        description?: string;
        summary?: string;
        contentSnippet?: string;
        categories?: string[];
        enclosure?: { url?: string; type?: string; length?: string | number };
        enclosures?: Array<{ url?: string }>;
        'media:content'?: { $?: { url?: string } };
        guid?: unknown;
        id?: unknown;
        comments?: string;
        itunes?: Record<string, unknown>;
        custom?: Record<string, unknown>;
        [key: string]: unknown;
      }>;
    },
    feedUrl: string,
    options?: Partial<RSSFetchOptions>
  ): RSSFeed {
    const maxItems = options?.maxItems || DEFAULT_RSS_FETCH_OPTIONS.maxItems!;

    // Take only the specified number of items
    const items = (rawFeed.items || []).slice(0, maxItems).map((item) => ({
      title: item.title,
      link: item.link,
      pubDate: normalizeRSSDate(item.pubDate || item.isoDate),
      creator: item.creator || item.author || item['dc:creator'],
      content: item.content || item.description || item.summary,
      contentSnippet:
        item.contentSnippet ||
        this.extractTextFromHTML(item.content || item.description),
      guid:
        (typeof item.guid === 'string' ? item.guid : undefined) ||
        (typeof item.id === 'string' ? item.id : undefined),
      categories: this.extractCategories(item),
      comments: item.comments,
      enclosure:
        item.enclosure && item.enclosure.url
          ? {
              url: item.enclosure.url,
              type: item.enclosure.type || '',
              length: item.enclosure.length
                ? parseInt(String(item.enclosure.length), 10)
                : undefined,
            }
          : undefined,
      itunes: item.itunes,
      custom: this.extractCustomFields(item, 'item'),
    }));

    return {
      feedUrl,
      title: rawFeed.title || 'Untitled Feed',
      description: rawFeed.description,
      link: rawFeed.link,
      language: rawFeed.language,
      copyright: rawFeed.copyright,
      lastBuildDate: normalizeRSSDate(rawFeed.lastBuildDate),
      pubDate: normalizeRSSDate(rawFeed.pubDate),
      ttl: rawFeed.ttl ? parseInt(String(rawFeed.ttl), 10) : undefined,
      generator: rawFeed.generator,
      managingEditor: rawFeed.managingEditor,
      webMaster: rawFeed.webMaster,
      image:
        rawFeed.image && rawFeed.image.url
          ? {
              url: rawFeed.image.url,
              title: rawFeed.image.title,
              link: rawFeed.image.link,
              width: rawFeed.image.width
                ? parseInt(rawFeed.image.width, 10)
                : undefined,
              height: rawFeed.image.height
                ? parseInt(rawFeed.image.height, 10)
                : undefined,
            }
          : undefined,
      itunes: rawFeed.itunes,
      items,
      custom: this.extractCustomFields(rawFeed, 'feed'),
    };
  }

  /**
   * Extract categories from item, handling various formats
   */
  private extractCategories(item: {
    categories?:
      | string
      | string[]
      | Array<{ _?: string; name?: string; [key: string]: unknown }>;
    category?: string | string[];
    [key: string]: unknown;
  }): string[] {
    const categories: string[] = [];

    if (item.categories) {
      if (Array.isArray(item.categories)) {
        categories.push(
          ...item.categories.map((cat) =>
            typeof cat === 'string' ? cat : cat._ || cat.name || ''
          )
        );
      } else if (typeof item.categories === 'string') {
        categories.push(item.categories);
      }
    }

    // Handle RSS 2.0 category format
    if (item.category) {
      if (Array.isArray(item.category)) {
        categories.push(...item.category);
      } else {
        categories.push(item.category);
      }
    }

    return categories.filter(Boolean);
  }

  /**
   * Extract custom fields based on parser configuration
   */
  private extractCustomFields(
    item: {
      enclosure?: { url?: string };
      enclosures?: Array<{ url?: string }>;
      'media:content'?: { $?: { url?: string } };
      [key: string]: unknown;
    },
    type: 'feed' | 'item'
  ): Record<string, unknown> | undefined {
    const customFields = this.options.customFields?.[type];
    if (!customFields || customFields.length === 0) {
      return undefined;
    }

    const custom: Record<string, unknown> = {};
    for (const field of customFields) {
      if (item[field] !== undefined) {
        custom[field] = item[field];
      }
    }

    return Object.keys(custom).length > 0 ? custom : undefined;
  }

  /**
   * Extract plain text from HTML content
   */
  private extractTextFromHTML(html?: string): string | undefined {
    if (!html) return undefined;

    // Basic HTML tag removal - for more robust parsing, consider using a proper HTML parser
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Handle and categorize errors
   */
  private handleError(error: unknown, feedUrl?: string): RSSFetchError {
    let code: RSSErrorCode = 'UNKNOWN_ERROR';
    let message = RSS_ERROR_MESSAGES.UNKNOWN_ERROR;
    let statusCode: number | undefined;

    if (error instanceof RSSFetchError) {
      return error;
    }

    // Network errors
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED')
    ) {
      code = 'NETWORK_ERROR';
      message = RSS_ERROR_MESSAGES.NETWORK_ERROR;
    } else if (
      (error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ETIMEDOUT') ||
      (error instanceof Error && error.message?.includes('timeout'))
    ) {
      code = 'TIMEOUT';
      message = RSS_ERROR_MESSAGES.TIMEOUT;
    } else if (
      (error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404) ||
      (error instanceof Error && error.message?.includes('404'))
    ) {
      code = 'NOT_FOUND';
      message = RSS_ERROR_MESSAGES.NOT_FOUND;
      statusCode = 404;
    } else if (error instanceof Error && error.message?.includes('CORS')) {
      code = 'CORS_ERROR';
      message = RSS_ERROR_MESSAGES.CORS_ERROR;
    } else if (
      error instanceof Error &&
      (error.message?.includes('parse') || error.message?.includes('XML'))
    ) {
      code = 'PARSE_ERROR';
      message = RSS_ERROR_MESSAGES.PARSE_ERROR;
    } else if (
      error instanceof Error &&
      error.message?.includes('Invalid URL')
    ) {
      code = 'INVALID_URL';
      message = RSS_ERROR_MESSAGES.INVALID_URL;
      statusCode = 400;
    }

    return new RSSFetchError(
      `${message}${error instanceof Error && error.message ? `: ${error.message}` : ''}`,
      code,
      statusCode,
      feedUrl
    );
  }

  /**
   * Get the current parser configuration
   */
  getOptions(): RSSFetchOptions {
    return { ...this.options };
  }

  /**
   * Update parser options
   */
  updateOptions(options: Partial<RSSFetchOptions>): void {
    this.options = { ...this.options, ...options };

    // Recreate parser with new options
    this.parser = new Parser({
      timeout: this.options.timeout,
      customFields: this.options.customFields,
      headers: {
        'User-Agent':
          this.options.userAgent || DEFAULT_RSS_FETCH_OPTIONS.userAgent!,
        ...this.options.headers,
      },
    });
  }

  /**
   * Store RSS feed content to database
   */
  private async storeContent(
    feed: RSSFeed,
    storageOptions: NonNullable<RSSFetchOptions['storage']>
  ): Promise<RSSFetchResult['storedContent']> {
    try {
      const contentService = new ContentService(storageOptions.supabaseClient);
      const normalizer = new ContentNormalizer();

      // Normalize all feed items for storage
      const normalizedContent = normalizer.normalizeMultiple(
        storageOptions.creator_id,
        'rss',
        feed.items,
        feed.feedUrl
      );

      // Store content in batch
      const result =
        await contentService.storeMultipleContent(normalizedContent);

      return {
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        errors: result.errors,
      };
    } catch (error) {
      // Failed to store RSS content - error details in return object
      return {
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [
          {
            error:
              error instanceof Error ? error.message : 'Unknown storage error',
          },
        ],
      };
    }
  }
}

// Export a default instance for convenience
export const defaultRSSFetcher = new RSSFetcher();

// Export utility functions for common RSS operations
export const fetchRSSFeed = (
  url: string,
  options?: Partial<RSSFetchOptions>
) => {
  return defaultRSSFetcher.parseURL(url, options);
};

export const fetchMultipleRSSFeeds = (
  urls: string[],
  options?: Partial<RSSFetchOptions>
) => {
  return defaultRSSFetcher.parseMultipleFeeds(urls, options);
};

export const testRSSFeed = (url: string) => {
  return defaultRSSFetcher.testFeed(url);
};
