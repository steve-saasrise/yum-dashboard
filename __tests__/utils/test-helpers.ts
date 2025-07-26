import { Content, CreateContentInput, Platform } from '@/types/content';
import { RSSFeed, RSSItem } from '@/types/rss';
import { Creator } from '@/types/creator';
import { SupabaseClient } from '@supabase/supabase-js';

// Mock data factories
export const createMockCreator = (overrides?: Partial<Creator>): Creator => ({
  id: '123e4567-e89b-12d3-a456-426614174000',
  user_id: 'user-123',
  display_name: 'Test Creator',
  bio: 'Test creator bio',
  avatar_url: undefined,
  lounges: [],
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockContent = (overrides?: Partial<Content>): Content => ({
  id: '456e7890-e89b-12d3-a456-426614174000',
  creator_id: '123e4567-e89b-12d3-a456-426614174000',
  platform: 'rss' as Platform,
  platform_content_id: 'test-content-123',
  url: 'https://example.com/article/123',
  title: 'Test Article Title',
  description: 'Test article description',
  thumbnail_url: 'https://example.com/thumb.jpg',
  published_at: new Date().toISOString(),
  content_body: '<p>Test content body</p>',
  word_count: 100,
  reading_time_minutes: 1,
  media_urls: [],
  engagement_metrics: {},
  processing_status: 'pending',
  ai_summary: undefined,
  error_message: undefined,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

export const createMockContentInput = (
  overrides?: Partial<CreateContentInput>
): CreateContentInput => ({
  creator_id: '123e4567-e89b-12d3-a456-426614174000',
  platform: 'rss' as Platform,
  platform_content_id: 'test-content-123',
  url: 'https://example.com/article/123',
  title: 'Test Article Title',
  description: 'Test article description',
  thumbnail_url: 'https://example.com/thumb.jpg',
  published_at: new Date().toISOString(),
  content_body: '<p>Test content body</p>',
  word_count: 100,
  reading_time_minutes: 1,
  media_urls: [],
  engagement_metrics: {},
  ...overrides,
});

export const createMockRSSItem = (overrides?: Partial<RSSItem>): RSSItem => ({
  title: 'Test RSS Item',
  link: 'https://example.com/rss-item',
  pubDate: new Date(),
  creator: 'Test Author',
  content: '<p>Test RSS content</p>',
  contentSnippet: 'Test RSS content',
  guid: 'test-guid-123',
  categories: ['Technology', 'News'],
  enclosure: {
    url: 'https://example.com/podcast.mp3',
    type: 'audio/mpeg',
    length: 1234567,
  },
  ...overrides,
});

export const createMockRSSFeed = (overrides?: Partial<RSSFeed>): RSSFeed => ({
  feedUrl: 'https://example.com/feed.xml',
  title: 'Test RSS Feed',
  description: 'Test RSS feed description',
  link: 'https://example.com',
  language: 'en',
  lastBuildDate: new Date(),
  items: [createMockRSSItem()],
  ...overrides,
});

// Enhanced Supabase mock builder
export class MockSupabaseBuilder {
  private mockData: any = {};
  private mockErrors: any = {};

  withData(table: string, data: any) {
    this.mockData[table] = data;
    return this;
  }

  withError(table: string, error: any) {
    this.mockErrors[table] = error;
    return this;
  }

  build(): Partial<SupabaseClient> {
    const builder = this;

    return {
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(() => {
          if (builder.mockErrors[table]) {
            return Promise.resolve({
              data: null,
              error: builder.mockErrors[table],
            });
          }
          const data = builder.mockData[table];
          return Promise.resolve({
            data: Array.isArray(data) ? data[0] : data,
            error: null,
          });
        }),
        then: jest.fn().mockImplementation((callback) => {
          if (builder.mockErrors[table]) {
            return callback({
              data: null,
              error: builder.mockErrors[table],
              count: null,
            });
          }
          const data = builder.mockData[table] || [];
          return callback({
            data,
            error: null,
            count: Array.isArray(data) ? data.length : 1,
          });
        }),
      })),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: {
            user: {
              id: 'user-123',
              email: 'test@example.com',
            },
          },
          error: null,
        }),
      },
    } as any;
  }
}

// Test data builders
export class ContentTestDataBuilder {
  private contents: Content[] = [];

  addContent(overrides?: Partial<Content>) {
    this.contents.push(createMockContent(overrides));
    return this;
  }

  addMultiple(
    count: number,
    overridesFn?: (index: number) => Partial<Content>
  ) {
    for (let i = 0; i < count; i++) {
      const overrides = overridesFn ? overridesFn(i) : {};
      this.contents.push(
        createMockContent({
          id: `content-${i}`,
          platform_content_id: `platform-${i}`,
          title: `Test Article ${i}`,
          ...overrides,
        })
      );
    }
    return this;
  }

  build() {
    return this.contents;
  }
}

// Assertion helpers
export const expectContentToMatch = (
  actual: Content,
  expected: Partial<Content>
) => {
  Object.entries(expected).forEach(([key, value]) => {
    expect(actual[key as keyof Content]).toEqual(value);
  });
};

// Mock RSS feed data for testing
export const mockRSSFeeds = {
  techCrunch: createMockRSSFeed({
    feedUrl: 'https://techcrunch.com/feed/',
    title: 'TechCrunch',
    items: [
      createMockRSSItem({
        title: 'Latest Tech News',
        link: 'https://techcrunch.com/2024/01/01/latest-tech-news',
        guid: 'tc-123',
        pubDate: new Date('2024-01-01T12:00:00Z'),
      }),
    ],
  }),
  bbcNews: createMockRSSFeed({
    feedUrl: 'https://feeds.bbci.co.uk/news/rss.xml',
    title: 'BBC News',
    items: [
      createMockRSSItem({
        title: 'Breaking News',
        link: 'https://bbc.co.uk/news/123',
        guid: 'bbc-123',
        pubDate: new Date('2024-01-01T10:00:00Z'),
      }),
    ],
  }),
};

// Helper to wait for async operations
export const waitFor = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Mock fetch for RSS parser
export const mockFetch = (responseData: any, status = 200) => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: jest
      .fn()
      .mockResolvedValue(
        typeof responseData === 'string'
          ? responseData
          : JSON.stringify(responseData)
      ),
    headers: new Headers({
      'content-type': 'application/rss+xml',
    }),
  } as any);
};
