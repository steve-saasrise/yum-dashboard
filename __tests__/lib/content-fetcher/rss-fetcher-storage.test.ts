import { RSSFetcher } from '@/lib/content-fetcher/rss-fetcher';
import { ContentService } from '@/lib/services/content-service';
import { ContentNormalizer } from '@/lib/services/content-normalizer';
import { RSSFetchOptions } from '@/types/rss';
import {
  createMockRSSFeed,
  createMockRSSItem,
  createMockContent,
  MockSupabaseBuilder,
  mockFetch,
} from '../../utils/test-helpers';

// Mock the rss-parser module
jest.mock('rss-parser', () => {
  return jest.fn().mockImplementation(() => ({
    parseURL: jest.fn().mockResolvedValue({
      title: 'Test Feed',
      description: 'Test feed description',
      link: 'https://example.com',
      items: [
        {
          title: 'Test Article',
          link: 'https://example.com/article',
          guid: 'test-guid-123',
          pubDate: '2024-01-01T12:00:00Z',
          content: '<p>Test content</p>',
          contentSnippet: 'Test content',
        },
      ],
    }),
  }));
});

// Mock the services
jest.mock('@/lib/services/content-service');
jest.mock('@/lib/services/content-normalizer');

describe('RSS Fetcher with Storage', () => {
  let fetcher: RSSFetcher;
  let mockSupabase: any;
  let mockContentService: jest.Mocked<ContentService>;
  let mockNormalizer: jest.Mocked<ContentNormalizer>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = new MockSupabaseBuilder().build();

    // Setup mock implementations
    mockContentService = {
      storeMultipleContent: jest.fn().mockResolvedValue({
        success: true,
        created: 1,
        updated: 0,
        skipped: 0,
        errors: [],
      }),
    } as any;

    mockNormalizer = {
      normalizeMultiple: jest.fn().mockReturnValue([
        {
          creator_id: 'creator-123',
          platform: 'rss',
          platform_content_id: 'test-guid-123',
          url: 'https://example.com/article',
          title: 'Test Article',
          content_body: '<p>Test content</p>',
          word_count: 2,
          reading_time_minutes: 1,
          media_urls: [],
          engagement_metrics: {},
        },
      ]),
    } as any;

    (
      ContentService as jest.MockedClass<typeof ContentService>
    ).mockImplementation(() => mockContentService);
    (
      ContentNormalizer as jest.MockedClass<typeof ContentNormalizer>
    ).mockImplementation(() => mockNormalizer);
  });

  describe('Storage Disabled', () => {
    it('should fetch RSS without storing when storage is disabled', async () => {
      fetcher = new RSSFetcher();

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.feed).toBeDefined();
      expect(result.storedContent).toBeUndefined();
      expect(ContentService).not.toHaveBeenCalled();
    });
  });

  describe('Storage Enabled', () => {
    it('should fetch and store RSS content successfully', async () => {
      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.storedContent).toBeDefined();
      expect(result.storedContent?.created).toBe(1);
      expect(result.storedContent?.updated).toBe(0);
      expect(result.storedContent?.errors).toHaveLength(0);

      expect(ContentNormalizer).toHaveBeenCalled();
      expect(mockNormalizer.normalizeMultiple).toHaveBeenCalledWith(
        'creator-123',
        'rss',
        expect.any(Array),
        'https://example.com/feed.xml'
      );

      expect(ContentService).toHaveBeenCalledWith(mockSupabase);
      expect(mockContentService.storeMultipleContent).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      mockContentService.storeMultipleContent.mockRejectedValue(
        new Error('Database error')
      );

      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.feed).toBeDefined();
      expect(result.storedContent).toBeDefined();
      expect(result.storedContent?.created).toBe(0);
      expect(result.storedContent?.errors).toHaveLength(1);
      expect(result.storedContent?.errors[0].error).toBe('Database error');
    });

    it('should handle deduplication during storage', async () => {
      mockContentService.storeMultipleContent.mockResolvedValue({
        success: true,
        created: 2,
        updated: 3,
        skipped: 1,
        errors: [],
      });

      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.storedContent?.created).toBe(2);
      expect(result.storedContent?.updated).toBe(3);
      expect(result.storedContent?.skipped).toBe(1);
    });

    it('should respect maxItems limit when storing', async () => {
      // Mock parser to return multiple items
      const Parser = require('rss-parser');
      Parser.mockImplementation(() => ({
        parseURL: jest.fn().mockResolvedValue({
          title: 'Test Feed',
          items: Array(10)
            .fill(null)
            .map((_, i) => ({
              title: `Article ${i}`,
              guid: `guid-${i}`,
              link: `https://example.com/article-${i}`,
              content: `Content ${i}`,
            })),
        }),
      }));

      const options: RSSFetchOptions = {
        maxItems: 5,
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      await fetcher.parseURL('https://example.com/feed.xml');

      expect(mockNormalizer.normalizeMultiple).toHaveBeenCalledWith(
        'creator-123',
        'rss',
        expect.arrayContaining([expect.any(Object)]),
        'https://example.com/feed.xml'
      );

      // Check that only 5 items were normalized
      const normalizedItems = mockNormalizer.normalizeMultiple.mock.calls[0][2];
      expect(normalizedItems).toHaveLength(5);
    });

    it('should handle partial failures in batch storage', async () => {
      mockContentService.storeMultipleContent.mockResolvedValue({
        success: false,
        created: 3,
        updated: 1,
        skipped: 0,
        errors: [
          { platform_content_id: 'guid-4', error: 'Validation failed' },
          { platform_content_id: 'guid-5', error: 'Network error' },
        ],
      });

      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.storedContent?.created).toBe(3);
      expect(result.storedContent?.updated).toBe(1);
      expect(result.storedContent?.errors).toHaveLength(2);
    });
  });

  describe('Multiple Feed Parsing with Storage', () => {
    it('should store content from multiple feeds', async () => {
      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const urls = [
        'https://example.com/feed1.xml',
        'https://example.com/feed2.xml',
        'https://example.com/feed3.xml',
      ];

      const results = await fetcher.parseMultipleFeeds(urls);

      expect(results).toHaveLength(3);
      results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.storedContent).toBeDefined();
      });

      expect(mockContentService.storeMultipleContent).toHaveBeenCalledTimes(3);
    });
  });

  describe('Storage Options Validation', () => {
    it('should not store if creator_id is missing', async () => {
      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          supabaseClient: mockSupabase,
        } as any, // Missing creator_id
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.storedContent).toBeUndefined();
      expect(ContentService).not.toHaveBeenCalled();
    });

    it('should not store if supabaseClient is missing', async () => {
      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
        } as any, // Missing supabaseClient
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/feed.xml');

      expect(result.success).toBe(true);
      expect(result.storedContent).toBeUndefined();
      expect(ContentService).not.toHaveBeenCalled();
    });
  });

  describe('Feed Testing with Storage', () => {
    it('should test feed without storing content', async () => {
      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const isValid = await fetcher.testFeed('https://example.com/feed.xml');

      expect(isValid).toBe(true);
      // Test feed should not trigger storage
      expect(ContentService).not.toHaveBeenCalled();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle RSS parsing errors', async () => {
      const Parser = require('rss-parser');
      Parser.mockImplementation(() => ({
        parseURL: jest.fn().mockRejectedValue(new Error('Invalid XML')),
      }));

      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/invalid.xml');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect((result.error as any)?.code).toBe('PARSE_ERROR');
      expect(ContentService).not.toHaveBeenCalled();
    });

    it('should handle empty feed gracefully', async () => {
      const Parser = require('rss-parser');
      Parser.mockImplementation(() => ({
        parseURL: jest.fn().mockResolvedValue({
          title: 'Empty Feed',
          items: [],
        }),
      }));

      const options: RSSFetchOptions = {
        storage: {
          enabled: true,
          creator_id: 'creator-123',
          supabaseClient: mockSupabase,
        },
      };

      fetcher = new RSSFetcher(options);

      const result = await fetcher.parseURL('https://example.com/empty.xml');

      expect(result.success).toBe(true);
      expect(result.feed!.items).toHaveLength(0);
      expect(mockNormalizer.normalizeMultiple).toHaveBeenCalledWith(
        'creator-123',
        'rss',
        [],
        'https://example.com/empty.xml'
      );
    });
  });
});
