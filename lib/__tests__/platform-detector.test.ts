import {
  Platform,
  PlatformDetector,
  PlatformDetectionError,
} from '../platform-detector';

describe('PlatformDetector', () => {
  describe('YouTube URL detection', () => {
    it('should detect YouTube channel URLs', () => {
      const testCases = [
        'https://www.youtube.com/channel/UC1234567890123456789012',
        'https://youtube.com/channel/UC1234567890123456789012',
        'http://www.youtube.com/channel/UC1234567890123456789012',
      ];

      testCases.forEach((url) => {
        const result = PlatformDetector.detect(url);
        expect(result.platform).toBe(Platform.YOUTUBE);
        expect(result.platformUserId).toBe('UC1234567890123456789012');
        expect(result.metadata.channelId).toBe('UC1234567890123456789012');
        expect(result.metadata.username).toBeUndefined();
      });
    });

    it('should detect YouTube @ handle URLs', () => {
      const url = 'https://www.youtube.com/@testchannel';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.YOUTUBE);
      expect(result.platformUserId).toBe('testchannel');
      expect(result.metadata.username).toBe('testchannel');
      expect(result.metadata.channelId).toBeUndefined();
    });

    it('should detect YouTube /c/ URLs', () => {
      const url = 'https://www.youtube.com/c/TestChannel';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.YOUTUBE);
      expect(result.platformUserId).toBe('TestChannel');
      expect(result.metadata.username).toBe('TestChannel');
    });

    it('should detect YouTube /user/ URLs', () => {
      const url = 'https://www.youtube.com/user/TestUser';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.YOUTUBE);
      expect(result.platformUserId).toBe('TestUser');
      expect(result.metadata.username).toBe('TestUser');
    });
  });

  describe('Twitter/X URL detection', () => {
    it('should detect Twitter URLs', () => {
      const testCases = [
        'https://twitter.com/testuser',
        'https://www.twitter.com/testuser',
        'http://twitter.com/testuser',
      ];

      testCases.forEach((url) => {
        const result = PlatformDetector.detect(url);
        expect(result.platform).toBe(Platform.TWITTER);
        expect(result.platformUserId).toBe('testuser');
        expect(result.metadata.username).toBe('testuser');
      });
    });

    it('should detect X.com URLs', () => {
      const url = 'https://x.com/testuser';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.TWITTER);
      expect(result.platformUserId).toBe('testuser');
      expect(result.metadata.username).toBe('testuser');
    });

    it('should handle usernames with underscores', () => {
      const url = 'https://twitter.com/test_user';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.TWITTER);
      expect(result.platformUserId).toBe('test_user');
    });
  });

  describe('LinkedIn URL detection', () => {
    it('should detect LinkedIn profile URLs', () => {
      const url = 'https://www.linkedin.com/in/testuser';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.LINKEDIN);
      expect(result.platformUserId).toBe('testuser');
      expect(result.metadata.username).toBe('testuser');
      expect(result.metadata.companyId).toBeUndefined();
    });

    it('should detect LinkedIn company URLs', () => {
      const url = 'https://www.linkedin.com/company/test-company';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.LINKEDIN);
      expect(result.platformUserId).toBe('test-company');
      expect(result.metadata.companyId).toBe('test-company');
      expect(result.metadata.username).toBeUndefined();
    });

    it('should handle hyphens in LinkedIn URLs', () => {
      const url = 'https://linkedin.com/in/test-user-name';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.LINKEDIN);
      expect(result.platformUserId).toBe('test-user-name');
    });
  });

  describe('Threads URL detection', () => {
    it('should detect Threads URLs', () => {
      const testCases = [
        'https://www.threads.net/@testuser',
        'https://threads.net/@testuser',
        'http://threads.net/@testuser',
      ];

      testCases.forEach((url) => {
        const result = PlatformDetector.detect(url);
        expect(result.platform).toBe(Platform.THREADS);
        expect(result.platformUserId).toBe('testuser');
        expect(result.metadata.username).toBe('testuser');
      });
    });

    it('should handle usernames with dots and underscores', () => {
      const url = 'https://threads.net/@test.user_name';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.THREADS);
      expect(result.platformUserId).toBe('test.user_name');
    });
  });

  describe('RSS URL detection', () => {
    it('should detect RSS file URLs', () => {
      const testCases = [
        { url: 'https://example.com/feed.rss', type: 'rss' as const },
        { url: 'https://example.com/feed.xml', type: 'rss' as const },
        { url: 'https://example.com/feed.atom', type: 'atom' as const },
      ];

      testCases.forEach(({ url, type }) => {
        const result = PlatformDetector.detect(url);
        expect(result.platform).toBe(Platform.RSS);
        expect(result.platformUserId).toBe('example.com');
        expect(result.metadata.feedUrl).toBe(url);
        expect(result.metadata.feedType).toBe(type);
      });
    });

    it('should detect RSS path URLs', () => {
      const testCases = [
        'https://example.com/feed/',
        'https://example.com/feed',
        'https://example.com/rss/',
        'https://example.com/rss',
        'https://example.com/atom/',
        'https://example.com/atom',
      ];

      testCases.forEach((url) => {
        const result = PlatformDetector.detect(url);
        expect(result.platform).toBe(Platform.RSS);
        expect(result.platformUserId).toBe('example.com');
        expect(result.metadata.feedUrl).toBe(url);
      });
    });

    it('should handle RSS URLs with query parameters', () => {
      const url = 'https://example.com/feed.xml?format=rss';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.RSS);
      expect(result.metadata.feedUrl).toBe(url);
    });

    it('should extract domain correctly for RSS feeds', () => {
      const testCases = [
        { url: 'https://www.example.com/feed.rss', domain: 'example.com' },
        { url: 'https://blog.example.com/rss', domain: 'blog.example.com' },
        { url: 'https://example.org/atom.xml', domain: 'example.org' },
      ];

      testCases.forEach(({ url, domain }) => {
        const result = PlatformDetector.detect(url);
        expect(result.platformUserId).toBe(domain);
      });
    });
  });

  describe('Error handling', () => {
    it('should throw error for invalid URLs', () => {
      const invalidUrls = ['not-a-url', '', 'just-text'];

      invalidUrls.forEach((url) => {
        expect(() => PlatformDetector.detect(url)).toThrow(
          PlatformDetectionError
        );
        expect(() => PlatformDetector.detect(url)).toThrow(
          'Invalid URL format'
        );
      });
    });

    it('should throw error for valid URLs with unsupported protocols', () => {
      const validButUnsupportedUrls = ['invalid://url', 'ftp://example.com'];

      validButUnsupportedUrls.forEach((url) => {
        expect(() => PlatformDetector.detect(url)).toThrow(
          PlatformDetectionError
        );
        expect(() => PlatformDetector.detect(url)).toThrow(
          'does not match any supported platform'
        );
      });
    });

    it('should throw error for unsupported platforms', () => {
      const unsupportedUrls = [
        'https://instagram.com/user',
        'https://tiktok.com/@user',
        'https://facebook.com/user',
        'https://reddit.com/r/subreddit',
        'https://example.com/random-path',
      ];

      unsupportedUrls.forEach((url) => {
        expect(() => PlatformDetector.detect(url)).toThrow(
          PlatformDetectionError
        );
        expect(() => PlatformDetector.detect(url)).toThrow(
          'does not match any supported platform'
        );
      });
    });

    it('should include the URL in error messages', () => {
      const invalidUrl = 'not-a-url';

      try {
        PlatformDetector.detect(invalidUrl);
      } catch (error) {
        expect(error).toBeInstanceOf(PlatformDetectionError);
        expect((error as PlatformDetectionError).url).toBe(invalidUrl);
        expect((error as PlatformDetectionError).code).toBe('INVALID_URL');
      }
    });
  });

  describe('Case sensitivity and normalization', () => {
    it('should handle URLs with different cases', () => {
      const testCases = [
        'HTTPS://WWW.YOUTUBE.COM/CHANNEL/UC1234567890123456789012',
        'https://Twitter.com/TestUser',
        'https://LinkedIn.com/in/TestUser',
      ];

      testCases.forEach((url) => {
        expect(() => PlatformDetector.detect(url)).not.toThrow();
      });
    });

    it('should preserve original URL in the result', () => {
      const originalUrl = 'HTTPS://WWW.YOUTUBE.COM/@TestChannel';
      const result = PlatformDetector.detect(originalUrl);

      expect(result.profileUrl).toBe(originalUrl);
    });

    it('should handle URLs with extra whitespace', () => {
      const url = '  https://www.youtube.com/@testchannel  ';
      const result = PlatformDetector.detect(url);

      expect(result.platform).toBe(Platform.YOUTUBE);
      expect(result.platformUserId).toBe('testchannel');
    });
  });

  describe('Edge cases', () => {
    it('should handle YouTube channel IDs correctly', () => {
      const channelUrl = 'https://youtube.com/channel/UC1234567890123456789012';
      const result = PlatformDetector.detect(channelUrl);

      expect(result.metadata.channelId).toBe('UC1234567890123456789012');
      expect(result.metadata.username).toBeUndefined();
    });

    it('should handle YouTube non-channel IDs correctly', () => {
      const handleUrl = 'https://youtube.com/@testchannel';
      const result = PlatformDetector.detect(handleUrl);

      expect(result.metadata.username).toBe('testchannel');
      expect(result.metadata.channelId).toBeUndefined();
    });

    it('should determine feed type correctly', () => {
      const atomUrl = 'https://example.com/atom.xml';
      const rssUrl = 'https://example.com/feed.rss';

      const atomResult = PlatformDetector.detect(atomUrl);
      const rssResult = PlatformDetector.detect(rssUrl);

      expect(atomResult.metadata.feedType).toBe('atom');
      expect(rssResult.metadata.feedType).toBe('rss');
    });
  });
});
