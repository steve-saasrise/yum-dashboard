import { render, screen } from '@testing-library/react';
import { CreatorListView } from '@/components/creators/creator-list-view';

// Mock the auth hook
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = require('@/hooks/use-auth').useAuth as jest.MockedFunction<any>;

// Mock fetch for API calls
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      creators: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0
    }),
  })
) as jest.Mock;

describe('Creator List View Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: 'user123' },
        session: { access_token: 'token123' },
        profile: { id: 'profile123' },
        loading: false,
        error: null,
      },
      signOut: jest.fn(),
    });
  });

  it('should render without crashing and show all components after loading', async () => {
    render(<CreatorListView />);
    
    // Should show loading state first
    expect(screen.getByTestId('creators-loading')).toBeInTheDocument();
    
    // Wait for loading to complete and show main UI
    expect(await screen.findByText('Creators')).toBeInTheDocument();
    expect(screen.getByText('No creators found')).toBeInTheDocument();
    expect(screen.getByText('Add your first creator to get started')).toBeInTheDocument();
  });

  it('should render all interactive components after loading', async () => {
    render(<CreatorListView />);
    
    // Wait for loading to complete
    await screen.findByText('Creators');
    
    // Check for search input
    expect(screen.getByPlaceholderText('Search creators...')).toBeInTheDocument();
    
    // Check for filter components
    expect(screen.getByTestId('platform-filter')).toBeInTheDocument();
    expect(screen.getByTestId('topic-filter')).toBeInTheDocument();
    expect(screen.getByTestId('status-filter')).toBeInTheDocument();
  });
});