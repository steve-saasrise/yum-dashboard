import { NextRequest } from 'next/server';
import { PUT, DELETE } from '../route';

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

describe('PUT /api/creators/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update creator with valid data', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockUpdate = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: {
        id: 'creator-123',
        display_name: 'Updated Creator',
        description: 'Updated description',
      },
      error: null,
    });

    mockSupabaseClient.from.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      {
        method: 'PUT',
        body: JSON.stringify({
          display_name: 'Updated Creator',
          description: 'Updated description',
        }),
      }
    );

    const response = await PUT(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.display_name).toBe('Updated Creator');
    expect(mockUpdate).toHaveBeenCalledWith({
      display_name: 'Updated Creator',
      description: 'Updated description',
      updated_at: expect.any(String),
    });
  });

  it('should reject unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'Updated' }),
      }
    );

    const response = await PUT(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should reject invalid input data', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      {
        method: 'PUT',
        body: JSON.stringify({
          display_name: '', // Invalid empty name
        }),
      }
    );

    const response = await PUT(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid input');
  });

  it('should handle creator not found', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockUpdate = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST116' }, // Not found error
    });

    mockSupabaseClient.from.mockReturnValue({
      update: mockUpdate,
      eq: mockEq,
      select: mockSelect,
      single: mockSingle,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/nonexistent',
      {
        method: 'PUT',
        body: JSON.stringify({ display_name: 'Updated' }),
      }
    );

    const response = await PUT(request, { params: Promise.resolve({ id: 'nonexistent' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Creator not found');
  });
});

describe('DELETE /api/creators/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete creator successfully', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockDelete = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockEqFinal = jest.fn().mockResolvedValue({
      data: null,
      error: null,
    });

    // Chain the mock correctly for .delete().eq().eq()
    mockEq.mockReturnValue({ eq: mockEqFinal });

    mockSupabaseClient.from.mockReturnValue({
      delete: mockDelete,
    });

    mockDelete.mockReturnValue({
      eq: mockEq,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Creator deleted successfully');
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith('id', 'creator-123');
    expect(mockEqFinal).toHaveBeenCalledWith('user_id', 'user-123');
  });

  it('should reject unauthenticated requests', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error('Not authenticated'),
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Authentication required');
  });

  it('should handle database errors', async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });

    const mockDelete = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockEqFinal = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    // Chain the mock correctly for .delete().eq().eq()
    mockEq.mockReturnValue({ eq: mockEqFinal });

    mockSupabaseClient.from.mockReturnValue({
      delete: mockDelete,
    });

    mockDelete.mockReturnValue({
      eq: mockEq,
    });

    const request = new NextRequest(
      'http://localhost:3000/api/creators/creator-123',
      { method: 'DELETE' }
    );

    const response = await DELETE(request, { params: Promise.resolve({ id: 'creator-123' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to delete creator');
  });
});
