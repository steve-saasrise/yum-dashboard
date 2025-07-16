/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
};

jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => []),
  })),
}));

jest.mock('@/lib/platform-detector', () => ({
  PlatformDetector: {
    detect: jest.fn(),
  },
  Platform: {
    YOUTUBE: 'youtube',
    TWITTER: 'twitter',
    RSS: 'rss',
  },
}));

describe.skip('POST /api/creators/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should import creators from CSV format', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { PlatformDetector } = require('@/lib/platform-detector');
    (PlatformDetector.detect as jest.Mock)
      .mockReturnValueOnce({
        platform: 'youtube',
        platformUserId: 'creator1',
        profileUrl: 'https://youtube.com/@creator1',
        metadata: { username: 'creator1' },
      })
      .mockReturnValueOnce({
        platform: 'twitter',
        platformUserId: 'creator2',
        profileUrl: 'https://twitter.com/creator2',
        metadata: { username: 'creator2' },
      });

    // Mock database operations
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockInsert = jest.fn().mockReturnThis();
    const mockInsertSelect = jest.fn().mockReturnThis();
    const mockInsertSingle = jest
      .fn()
      .mockResolvedValueOnce({
        data: { id: 'creator-1', display_name: 'Creator One' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'creator-2', display_name: 'Creator Two' },
        error: null,
      });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: mockInsert,
    });

    mockInsert.mockReturnValue({
      select: mockInsertSelect,
    });

    mockInsertSelect.mockReturnValue({
      single: mockInsertSingle,
    });

    const csvData = `name,url,topics
Creator One,https://youtube.com/@creator1,"tech,programming"
Creator Two,https://twitter.com/creator2,"design,ui"`;

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'csv',
          data: csvData,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.imported).toBe(2);
    expect(data.data.failed).toBe(0);
    expect(data.data.creators).toHaveLength(2);
  });

  it('should import creators from OPML format', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { PlatformDetector } = require('@/lib/platform-detector');
    (PlatformDetector.detect as jest.Mock).mockReturnValue({
      platform: 'rss',
      platformUserId: 'example.com',
      profileUrl: 'https://example.com/feed.xml',
      metadata: { feedUrl: 'https://example.com/feed.xml', feedType: 'rss' },
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockInsert = jest.fn().mockResolvedValue({
      data: [{ id: 'creator-1', display_name: 'Example Blog' }],
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
      insert: mockInsert,
    });

    const opmlData = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>RSS Feeds</title>
  </head>
  <body>
    <outline text="Example Blog" title="Example Blog" type="rss" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>`;

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'opml',
          data: opmlData,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.imported).toBe(1);
    expect(data.data.failed).toBe(0);
  });

  it('should handle duplicate creators during import', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const { PlatformDetector } = require('@/lib/platform-detector');
    (PlatformDetector.detect as jest.Mock).mockReturnValue({
      platform: 'youtube',
      platformUserId: 'existing',
      profileUrl: 'https://youtube.com/@existing',
      metadata: { username: 'existing' },
    });

    // Mock existing creator found
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: { id: 'existing-creator' },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });

    const csvData = `name,url
Existing Creator,https://youtube.com/@existing`;

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'csv',
          data: csvData,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.imported).toBe(0);
    expect(data.data.failed).toBe(1);
    expect(data.data.errors).toHaveLength(1);
    expect(data.data.errors[0].error).toBe('Creator already exists');
  });

  it('should reject unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'csv',
          data: 'name,url\nTest,https://example.com',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should reject invalid format', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'invalid',
          data: 'some data',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
  });

  it('should handle malformed CSV data', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'csv',
          data: 'invalid csv data with no headers',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid CSV format: Missing required headers');
  });

  it('should handle malformed OPML data', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/import',
      {
        method: 'POST',
        body: JSON.stringify({
          format: 'opml',
          data: 'invalid xml data',
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid OPML format');
  });
});
