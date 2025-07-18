import { ContentNormalizer } from '@/lib/services/content-normalizer';
import { RSSItem } from '@/types/rss';
import { NormalizeContentInput } from '@/types/content';
import { createMockRSSItem } from '../../utils/test-helpers';

describe('ContentNormalizer', () => {
  let normalizer: ContentNormalizer;

  beforeEach(() => {
    normalizer = new ContentNormalizer();
  });

  describe('normalize', () => {
    it('should normalize RSS content correctly', () => {
      const rssItem = createMockRSSItem({
        title: 'Test RSS Article',
        link: 'https://example.com/article',
        guid: 'unique-guid-123',
        pubDate: new Date('2024-01-01T12:00:00Z'),
        content: '<p>This is test content with <strong>HTML</strong>.</p>',
        contentSnippet: 'This is test content with HTML.',
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
        sourceUrl: 'https://example.com/feed.xml',
      };

      const result = normalizer.normalize(input);

      expect(result.creator_id).toBe('creator-123');
      expect(result.platform).toBe('rss');
      expect(result.platform_content_id).toBe('unique-guid-123');
      expect(result.url).toBe('https://example.com/article');
      expect(result.title).toBe('Test RSS Article');
      expect(result.content_body).toContain('This is test content');
      expect(result.word_count).toBe(7); // "This is test content with HTML."
      expect(result.reading_time_minutes).toBe(1);
    });

    it('should handle RSS items without guid', () => {
      const rssItem = createMockRSSItem({
        guid: undefined,
        link: 'https://example.com/article',
        pubDate: new Date('2024-01-01T12:00:00Z'),
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
        sourceUrl: 'https://example.com/feed.xml',
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('https://example.com/article');
    });

    it('should extract media URLs from RSS enclosures', () => {
      const rssItem = createMockRSSItem({
        enclosure: {
          url: 'https://example.com/podcast.mp3',
          type: 'audio/mpeg',
          length: 1234567,
        },
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
      };

      const result = normalizer.normalize(input);

      expect(result.media_urls).toHaveLength(1);
      expect(result.media_urls![0]).toEqual({
        url: 'https://example.com/podcast.mp3',
        type: 'audio',
        size: 1234567,
      });
    });

    it('should extract images from HTML content', () => {
      const rssItem = createMockRSSItem({
        content:
          '<p>Text with <img src="https://example.com/image.jpg" alt="test"> image</p>',
        enclosure: undefined, // No enclosure for this test
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
      };

      const result = normalizer.normalize(input);

      // Should only have the image from HTML, not the default enclosure
      const imageUrls = result.media_urls!.filter((m) => m.type === 'image');
      expect(imageUrls).toHaveLength(1);
      expect(imageUrls[0]).toEqual({
        url: 'https://example.com/image.jpg',
        type: 'image',
      });
    });

    it('should handle different media types in enclosures', () => {
      const testCases = [
        { type: 'image/jpeg', expected: 'image' },
        { type: 'video/mp4', expected: 'video' },
        { type: 'audio/mpeg', expected: 'audio' },
        { type: 'application/pdf', expected: 'document' },
      ];

      testCases.forEach(({ type, expected }) => {
        const rssItem = createMockRSSItem({
          enclosure: { url: 'https://example.com/file', type, length: 100 },
        });

        const input: NormalizeContentInput = {
          creator_id: 'creator-123',
          platform: 'rss',
          platformData: rssItem,
        };

        const result = normalizer.normalize(input);
        expect(result.media_urls![0].type).toBe(expected);
      });
    });

    it('should handle missing content gracefully', () => {
      const rssItem = createMockRSSItem({
        content: undefined,
        contentSnippet: undefined,
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
      };

      const result = normalizer.normalize(input);

      expect(result.content_body).toBe('');
      expect(result.word_count).toBe(0);
      expect(result.reading_time_minutes).toBe(0);
    });

    it('should use current date if pubDate is missing', () => {
      const rssItem = createMockRSSItem({
        pubDate: undefined,
      });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
      };

      const beforeDate = new Date();
      const result = normalizer.normalize(input);
      const afterDate = new Date();

      const publishedDate = new Date(result.published_at || '');
      expect(publishedDate.getTime()).toBeGreaterThanOrEqual(
        beforeDate.getTime()
      );
      expect(publishedDate.getTime()).toBeLessThanOrEqual(afterDate.getTime());
    });

    it('should throw error for unsupported platform', () => {
      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'unsupported' as any,
        platformData: {},
      };

      expect(() => normalizer.normalize(input)).toThrow('Unsupported platform');
    });
  });

  describe('normalizeMultiple', () => {
    it('should normalize multiple RSS items', () => {
      const items = [
        createMockRSSItem({ guid: 'item-1', title: 'Article 1' }),
        createMockRSSItem({ guid: 'item-2', title: 'Article 2' }),
        createMockRSSItem({ guid: 'item-3', title: 'Article 3' }),
      ];

      const results = normalizer.normalizeMultiple(
        'creator-123',
        'rss',
        items,
        'https://example.com/feed.xml'
      );

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Article 1');
      expect(results[1].title).toBe('Article 2');
      expect(results[2].title).toBe('Article 3');
      results.forEach((result) => {
        expect(result.creator_id).toBe('creator-123');
        expect(result.platform).toBe('rss');
      });
    });
  });

  describe('platform-specific normalizers (stubs)', () => {
    it('should normalize YouTube content', () => {
      const youtubeData = {
        id: { videoId: 'abc123' },
        snippet: {
          title: 'YouTube Video',
          description: 'Video description',
          publishedAt: '2024-01-01T12:00:00Z',
          thumbnails: {
            high: { url: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg' },
          },
        },
        statistics: {
          viewCount: '1000',
          likeCount: '100',
          commentCount: '50',
        },
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'youtube',
        platformData: youtubeData,
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('abc123');
      expect(result.url).toBe('https://www.youtube.com/watch?v=abc123');
      expect(result.title).toBe('YouTube Video');
      expect(result.engagement_metrics?.views).toBe(1000);
      expect(result.engagement_metrics?.likes).toBe(100);
      expect(result.engagement_metrics?.comments).toBe(50);
    });

    it('should normalize Twitter content', () => {
      const twitterData = {
        id: 'tweet123',
        text: 'This is a tweet',
        created_at: '2024-01-01T12:00:00Z',
        public_metrics: {
          like_count: 100,
          retweet_count: 50,
          reply_count: 25,
          bookmark_count: 10,
        },
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'twitter',
        platformData: twitterData,
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('tweet123');
      expect(result.url).toBe('https://twitter.com/i/status/tweet123');
      expect(result.content_body).toBe('This is a tweet');
      expect(result.engagement_metrics?.likes).toBe(100);
      expect(result.engagement_metrics?.retweets).toBe(50);
      expect(result.engagement_metrics?.comments).toBe(25);
      expect(result.engagement_metrics?.bookmarks).toBe(10);
    });

    it('should extract Twitter media', () => {
      const twitterData = {
        id: 'tweet123',
        text: 'Tweet with media',
        attachments: {
          media_keys: ['media1'],
        },
        includes: {
          media: [
            {
              media_key: 'media1',
              type: 'photo',
              url: 'https://pbs.twimg.com/media/123.jpg',
              width: 1200,
              height: 800,
            },
          ],
        },
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'twitter',
        platformData: twitterData,
      };

      const result = normalizer.normalize(input);

      expect(result.media_urls).toHaveLength(1);
      expect(result.media_urls![0]).toEqual({
        url: 'https://pbs.twimg.com/media/123.jpg',
        type: 'image',
        width: 1200,
        height: 800,
      });
    });

    it('should normalize LinkedIn content', () => {
      const linkedinData = {
        id: 'post123',
        text: 'LinkedIn post content',
        publishedAt: '2024-01-01T12:00:00Z',
        numLikes: 50,
        numComments: 10,
        numShares: 5,
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'linkedin',
        platformData: linkedinData,
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('post123');
      expect(result.content_body).toBe('LinkedIn post content');
      expect(result.engagement_metrics?.likes).toBe(50);
      expect(result.engagement_metrics?.comments).toBe(10);
      expect(result.engagement_metrics?.shares).toBe(5);
    });

    it('should normalize Threads content', () => {
      const threadsData = {
        id: 'thread123',
        text: 'Threads post',
        timestamp: '2024-01-01T12:00:00Z',
        likeCount: 30,
        replyCount: 15,
        shareCount: 8,
        media: [{ url: 'https://threads.net/image.jpg', type: 'image' }],
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'threads',
        platformData: threadsData,
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('thread123');
      expect(result.content_body).toBe('Threads post');
      expect(result.media_urls).toHaveLength(1);
      expect(result.engagement_metrics?.likes).toBe(30);
      expect(result.engagement_metrics?.comments).toBe(15);
      expect(result.engagement_metrics?.shares).toBe(8);
    });

    it('should normalize generic website content', () => {
      const websiteData = {
        url: 'https://example.com/article',
        title: 'Website Article',
        description: 'Article description',
        content: 'Full article content here...',
        publishDate: '2024-01-01T12:00:00Z',
        images: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      };

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'website',
        platformData: websiteData,
        sourceUrl: 'https://example.com',
      };

      const result = normalizer.normalize(input);

      expect(result.platform_content_id).toBe('https://example.com/article');
      expect(result.url).toBe('https://example.com/article');
      expect(result.title).toBe('Website Article');
      expect(result.media_urls).toHaveLength(2);
    });
  });

  describe('helper methods', () => {
    it('should calculate correct word count', () => {
      const testCases = [
        { content: 'Simple text', expected: 2 },
        { content: '<p>HTML content with tags</p>', expected: 4 },
        { content: '   Multiple   spaces   between   words   ', expected: 4 },
        { content: '', expected: 0 }, // Empty content should have 0 words
        { content: '<p></p>', expected: 0 }, // Extracts to empty string
        { content: '  <p>   </p>  ', expected: 0 }, // Trims to empty
      ];

      testCases.forEach(({ content, expected }) => {
        const rssItem = createMockRSSItem({
          content,
          contentSnippet: undefined, // Override default contentSnippet
        });
        const input: NormalizeContentInput = {
          creator_id: 'creator-123',
          platform: 'rss',
          platformData: rssItem,
        };

        const result = normalizer.normalize(input);
        expect(result.word_count).toBe(expected);
      });
    });

    it('should calculate reading time correctly', () => {
      // Average reading speed is 200 words per minute
      const longContent = 'word '.repeat(400); // 400 words
      const rssItem = createMockRSSItem({ content: longContent });

      const input: NormalizeContentInput = {
        creator_id: 'creator-123',
        platform: 'rss',
        platformData: rssItem,
      };

      const result = normalizer.normalize(input);
      expect(result.reading_time_minutes).toBe(2);
    });
  });
});
