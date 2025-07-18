import { POST, GET } from '@/app/api/content/store/route';
import { NextRequest } from 'next/server';
import {
  createMockContentInput,
  createMockContent,
  createMockRSSItem,
  MockSupabaseBuilder,
} from '../../utils/test-helpers';

// Mock the cookies module
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => ({
    getAll: jest.fn(() => []),
    set: jest.fn(),
  })),
}));

// Mock createServerClient
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn(() => {
    return new MockSupabaseBuilder().build();
  }),
}));

describe('Content Storage API', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = new MockSupabaseBuilder().build();

    // Update the mock to return our mockSupabase
    const { createServerClient } = require('@supabase/ssr');
    createServerClient.mockReturnValue(mockSupabase);
  });

  describe('POST /api/content/store', () => {
    describe('Authentication', () => {
      it('should return 401 for unauthenticated requests', async () => {
        mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
          data: { user: null },
          error: new Error('Not authenticated'),
        });

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(createMockContentInput()),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe('Authentication required');
      });
    });

    describe('Single Content Storage', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });
      });

      it('should store single content successfully', async () => {
        const input = createMockContentInput();
        const mockContent = createMockContent(input);

        // Mock creator ownership check
        mockSupabase.from = jest.fn((table) => {
          if (table === 'creators') {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: input.creator_id },
                error: null,
              }),
            };
          }
          const builder = new MockSupabaseBuilder()
            .withData('content', mockContent)
            .build();
          return builder.from!(table);
        });

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(input),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.success).toBe(true);
        expect(data.content).toBeDefined();
      });

      it('should return 404 for non-existent creator', async () => {
        mockSupabase.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { code: 'PGRST116' },
          }),
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(createMockContentInput()),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe('Creator not found or access denied');
      });

      it('should return 409 for duplicate content', async () => {
        // Mock ContentService to throw duplicate error
        jest.mock('@/lib/services/content-service', () => ({
          ContentService: jest.fn().mockImplementation(() => ({
            storeContent: jest.fn().mockRejectedValue({
              code: 'DUPLICATE_CONTENT',
              message: 'Content already exists',
            }),
          })),
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(createMockContentInput()),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(409);
      });

      it('should validate input data', async () => {
        const invalidInput = {
          creator_id: 'invalid-uuid',
          platform: 'invalid-platform',
        };

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(invalidInput),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid input');
        expect(data.details).toBeDefined();
      });
    });

    describe('Batch Content Storage', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });
      });

      it('should store multiple contents successfully', async () => {
        const contents = [
          createMockContentInput({ platform_content_id: 'item-1' }),
          createMockContentInput({ platform_content_id: 'item-2' }),
        ];

        // Mock creators check
        mockSupabase.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({
            data: [{ id: contents[0].creator_id }],
            error: null,
          }),
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify({ contents }),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBeDefined();
        expect(data.batch_result).toBeDefined();
      });

      it('should return 207 for partial success', async () => {
        const contents = [
          createMockContentInput({ platform_content_id: 'item-1' }),
          createMockContentInput({ platform_content_id: 'item-2' }),
        ];

        // Mock batch result with errors
        jest.mock('@/lib/services/content-service', () => ({
          ContentService: jest.fn().mockImplementation(() => ({
            storeMultipleContent: jest.fn().mockResolvedValue({
              success: false,
              created: 1,
              updated: 0,
              skipped: 0,
              errors: [{ platform_content_id: 'item-2', error: 'Failed' }],
            }),
          })),
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify({ contents }),
          }
        );

        const response = await POST(request);

        expect(response.status).toBe(207);
      });

      it('should validate batch size', async () => {
        const contents = Array(101)
          .fill(null)
          .map((_, i) =>
            createMockContentInput({ platform_content_id: `item-${i}` })
          );

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify({ contents }),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('Invalid batch input');
      });
    });

    describe('Normalization Request', () => {
      beforeEach(() => {
        mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
          data: { user: { id: 'user-123', email: 'test@example.com' } },
          error: null,
        });
      });

      it('should normalize and store platform data', async () => {
        const rssItem = createMockRSSItem();
        const normalizeRequest = {
          creator_id: '123e4567-e89b-12d3-a456-426614174000',
          platform: 'rss',
          platform_data: rssItem,
          source_url: 'https://example.com/feed.xml',
        };

        // Mock creator check
        mockSupabase.from = jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: normalizeRequest.creator_id },
            error: null,
          }),
        }));

        const request = new NextRequest(
          'http://localhost:3000/api/content/store',
          {
            method: 'POST',
            body: JSON.stringify(normalizeRequest),
          }
        );

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.normalized_from).toBe('platform_data');
      });
    });
  });

  describe('GET /api/content/store', () => {
    beforeEach(() => {
      mockSupabase.auth.getUser = jest.fn().mockResolvedValue({
        data: { user: { id: 'user-123', email: 'test@example.com' } },
        error: null,
      });
    });

    it('should retrieve content with filters', async () => {
      const mockContents = [
        createMockContent({ creator_id: 'creator-123' }),
        createMockContent({ creator_id: 'creator-123' }),
      ];

      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: mockContents,
          error: null,
        }),
      }));

      const request = new NextRequest(
        'http://localhost:3000/api/content/store?creator_id=creator-123&platform=rss'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toBeDefined();
      expect(data.total).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it('should verify creator ownership', async () => {
      mockSupabase.from = jest.fn((table) => {
        if (table === 'creators') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          };
        }
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          then: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const request = new NextRequest(
        'http://localhost:3000/api/content/store?creator_id=other-creator'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Creator not found or access denied');
    });

    it('should return empty array when user has no creators', async () => {
      mockSupabase.from = jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }));

      const request = new NextRequest(
        'http://localhost:3000/api/content/store'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.content).toEqual([]);
      expect(data.total).toBe(0);
    });

    it('should handle pagination parameters', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/store?limit=5&offset=10'
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.limit).toBe(5);
      expect(data.pagination.offset).toBe(10);
    });

    it('should filter by platform and processing status', async () => {
      const request = new NextRequest(
        'http://localhost:3000/api/content/store?platform=rss&processing_status=processed'
      );

      const response = await GET(request);

      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      mockSupabase.auth.getUser = jest
        .fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest(
        'http://localhost:3000/api/content/store',
        {
          method: 'POST',
          body: JSON.stringify(createMockContentInput()),
        }
      );

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to store content');
      expect(data.details).toBe('Database connection failed');
    });
  });
});
