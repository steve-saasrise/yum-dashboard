import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreatorListView } from '@/components/creators/creator-list-view';

// Mock the auth hook
jest.mock('@/hooks/use-auth', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = require('@/hooks/use-auth').useAuth as jest.MockedFunction<any>;

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock data
const mockCreators = [
  {
    id: '1',
    display_name: 'Tech Creator',
    description: 'Technology content creator',
    platform: 'youtube',
    platform_user_id: 'tech123',
    profile_url: 'https://youtube.com/tech123',
    metadata: {},
    topics: ['technology', 'coding'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    avatar_url: 'https://example.com/avatar1.jpg'
  },
  {
    id: '2',
    display_name: 'News Reporter',
    description: 'Daily news updates',
    platform: 'twitter',
    platform_user_id: 'news456',
    profile_url: 'https://twitter.com/news456',
    metadata: {},
    topics: ['news', 'politics'],
    is_active: false,
    created_at: '2024-01-02T00:00:00Z',
    avatar_url: 'https://example.com/avatar2.jpg'
  }
];

describe('CreatorListView', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      state: {
        user: { id: 'user123' },
        session: { access_token: 'token123' },
        profile: { id: 'profile123' },
        loading: false,
        error: null,
      },
      signOut: jest.fn(),
      signInWithMagicLink: jest.fn(),
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        creators: mockCreators,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      }),
    } as Response);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render creator list view component', async () => {
      render(<CreatorListView />);
      
      expect(screen.getByText('Creators')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search creators...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.getByText('Tech Creator')).toBeInTheDocument();
        expect(screen.getByText('News Reporter')).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      render(<CreatorListView />);
      
      expect(screen.getByTestId('creators-loading')).toBeInTheDocument();
    });

    it('should display empty state when no creators exist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: [],
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0
        }),
      } as Response);

      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('No creators found')).toBeInTheDocument();
        expect(screen.getByText('Add your first creator to get started')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter creators based on search input', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Creator')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search creators...');
      await user.type(searchInput, 'tech');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=tech'),
          expect.any(Object)
        );
      });
    });

    it('should debounce search input', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const searchInput = screen.getByPlaceholderText('Search creators...');
      
      // Type multiple characters quickly
      await user.type(searchInput, 'tech');
      
      // Should not make API calls for each character
      expect(mockFetch).toHaveBeenCalledTimes(1); // Initial load only
      
      // Wait for debounce
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('search=tech'),
          expect.any(Object)
        );
      }, { timeout: 1000 });
    });

    it('should clear search results when search input is empty', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const searchInput = screen.getByPlaceholderText('Search creators...');
      await user.type(searchInput, 'tech');
      await user.clear(searchInput);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.not.stringContaining('search='),
          expect.any(Object)
        );
      });
    });
  });

  describe('Filtering Functionality', () => {
    it('should filter creators by platform', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      // Open platform filter
      const platformFilter = screen.getByTestId('platform-filter');
      await user.click(platformFilter);
      
      // Select YouTube
      const youtubeOption = screen.getByText('YouTube');
      await user.click(youtubeOption);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('platform=youtube'),
          expect.any(Object)
        );
      });
    });

    it('should filter creators by topic', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const topicFilter = screen.getByTestId('topic-filter');
      await user.click(topicFilter);
      
      const technologyOption = screen.getByText('Technology');
      await user.click(technologyOption);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('topic=technology'),
          expect.any(Object)
        );
      });
    });

    it('should filter creators by active status', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const statusFilter = screen.getByTestId('status-filter');
      await user.click(statusFilter);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('status=active'),
          expect.any(Object)
        );
      });
    });

    it('should combine multiple filters', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      // Apply platform filter
      const platformFilter = screen.getByTestId('platform-filter');
      await user.click(platformFilter);
      await user.click(screen.getByText('YouTube'));
      
      // Apply topic filter
      const topicFilter = screen.getByTestId('topic-filter');
      await user.click(topicFilter);
      await user.click(screen.getByText('Technology'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('platform=youtube&topic=technology'),
          expect.any(Object)
        );
      });
    });

    it('should clear all filters when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      // Apply some filters first
      const platformFilter = screen.getByTestId('platform-filter');
      await user.click(platformFilter);
      await user.click(screen.getByText('YouTube'));
      
      // Clear filters
      const clearButton = screen.getByText('Clear Filters');
      await user.click(clearButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.not.stringContaining('platform='),
          expect.any(Object)
        );
      });
    });
  });

  describe('Sorting Functionality', () => {
    it('should sort creators by name', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const nameHeader = screen.getByTestId('sort-name');
      await user.click(nameHeader);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort=display_name&order=asc'),
          expect.any(Object)
        );
      });
    });

    it('should toggle sort order when clicking same column', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const nameHeader = screen.getByTestId('sort-name');
      await user.click(nameHeader); // First click - ascending
      await user.click(nameHeader); // Second click - descending

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort=display_name&order=desc'),
          expect.any(Object)
        );
      });
    });

    it('should sort creators by created date', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      const dateHeader = screen.getByTestId('sort-created');
      await user.click(dateHeader);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sort=created_at&order=asc'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Pagination', () => {
    it('should display pagination controls when there are multiple pages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: mockCreators,
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3
        }),
      } as Response);

      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
        expect(screen.getByText('Next')).toBeInTheDocument();
      });
    });

    it('should navigate to next page when next button is clicked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: mockCreators,
          total: 25,
          page: 1,
          limit: 10,
          totalPages: 3
        }),
      } as Response);

      const user = userEvent.setup();
      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Next')).toBeInTheDocument();
      });

      const nextButton = screen.getByText('Next');
      await user.click(nextButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('page=2'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render table view on desktop', () => {
      // Mock window.innerWidth for desktop
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });

      render(<CreatorListView />);
      
      expect(screen.getByTestId('creators-table')).toBeInTheDocument();
      expect(screen.queryByTestId('creators-cards')).not.toBeInTheDocument();
    });

    it('should render card view on mobile', () => {
      // Mock window.innerWidth for mobile
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 640,
      });

      render(<CreatorListView />);
      
      expect(screen.getByTestId('creators-cards')).toBeInTheDocument();
      expect(screen.queryByTestId('creators-table')).not.toBeInTheDocument();
    });
  });

  describe('Bulk Actions', () => {
    it('should allow selecting multiple creators', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Creator')).toBeInTheDocument();
      });

      const selectAllCheckbox = screen.getByTestId('select-all');
      await user.click(selectAllCheckbox);

      expect(screen.getByTestId('bulk-actions')).toBeInTheDocument();
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('should show bulk action buttons when creators are selected', async () => {
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Tech Creator')).toBeInTheDocument();
      });

      const checkbox = screen.getAllByTestId('creator-checkbox')[0];
      await user.click(checkbox);

      expect(screen.getByText('Delete Selected')).toBeInTheDocument();
      expect(screen.getByText('Toggle Status')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Failed to load creators')).toBeInTheDocument();
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });
    });

    it('should retry loading when retry button is clicked', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const user = userEvent.setup();
      render(<CreatorListView />);
      
      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Reset mock to succeed on retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          creators: mockCreators,
          total: 2,
          page: 1,
          limit: 10,
          totalPages: 1
        }),
      } as Response);

      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Tech Creator')).toBeInTheDocument();
      });
    });
  });
});