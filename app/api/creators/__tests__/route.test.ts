/* eslint-disable @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

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
    LINKEDIN: 'linkedin',
  },
}));

const { PlatformDetector } = require('@/lib/platform-detector');

describe.skip('POST /api/creators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a creator with valid URL', async () => {
    // Mock authenticated user
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    // Mock platform detection
    (PlatformDetector.detect as jest.Mock).mockReturnValue({
      platform: 'youtube',
      platformUserId: 'testchannel',
      profileUrl: 'https://youtube.com/@testchannel',
      metadata: { username: 'testchannel' },
    });

    // Mock Supabase query chain
    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockInsert = jest.fn().mockReturnThis();
    const mockInsertSingle = jest.fn().mockResolvedValue({
      data: { id: 'creator-123', display_name: 'Test Channel' },
      error: null,
    });

    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'creators') {
        return {
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
          insert: mockInsert,
        };
      }
      return { select: mockSelect, eq: mockEq, single: mockSingle };
    });

    mockSelect.mockImplementation(() => ({
      eq: mockEq,
      single: mockSingle,
    }));

    mockInsert.mockImplementation(() => ({
      select: () => ({
        single: mockInsertSingle,
      }),
    }));

    const request = new NextRequest('http://localhost:3000/api/creators', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://youtube.com/@testchannel',
        display_name: 'Test Channel',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.id).toBe('creator-123');
  });

  it('should reject unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest('http://localhost:3000/api/creators', {
      method: 'POST',
      body: JSON.stringify({ url: 'https://youtube.com/@test' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should reject invalid URL format', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/creators', {
      method: 'POST',
      body: JSON.stringify({ url: 'not-a-url' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
  });

  it('should prevent duplicate creators', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    (PlatformDetector.detect as jest.Mock).mockReturnValue({
      platform: 'youtube',
      platformUserId: 'testchannel',
      profileUrl: 'https://youtube.com/@testchannel',
      metadata: { username: 'testchannel' },
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

    const request = new NextRequest('http://localhost:3000/api/creators', {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://youtube.com/@testchannel',
        display_name: 'Test Channel',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Creator already exists');
  });
});

describe.skip('GET /api/creators', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return user creators with default pagination', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockCreators = [
      {
        id: 'creator-1',
        display_name: 'Creator One',
        platform: 'youtube',
        platform_user_id: 'creator1',
        profile_url: 'https://youtube.com/@creator1',
      },
    ];

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockRange = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({
      data: mockCreators,
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      range: mockRange,
      order: mockOrder,
    });

    const request = new NextRequest('http://localhost:3000/api/creators');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.creators).toEqual(mockCreators);
    expect(data.data.pagination.page).toBe(1);
  });

  it('should filter creators by platform', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockRange = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      range: mockRange,
      order: mockOrder,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators?platform=youtube'
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith('platform', 'youtube');
  });

  it('should reject unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest('http://localhost:3000/api/creators');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });
});
