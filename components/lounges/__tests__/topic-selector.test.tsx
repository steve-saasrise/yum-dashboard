import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoungeSelector } from '../lounge-selector';
import { toast } from 'sonner';

// Mock ResizeObserver (required for cmdk Command component)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

// Mock fetch
global.fetch = jest.fn();

const mockTopics = [
  {
    id: '1',
    name: 'Technology',
    description: 'Tech news and updates',
    is_system_topic: true,
    user_id: null,
    parent_topic_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    usage_count: 5,
    creator_count: 10,
    content_count: 20,
  },
  {
    id: '2',
    name: 'Business',
    description: 'Business and finance',
    is_system_topic: false,
    user_id: 'user-123',
    parent_topic_id: null,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    usage_count: 3,
    creator_count: 5,
    content_count: 15,
  },
];

describe.skip('LoungeSelector', () => {
  const mockOnChange = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem('supabase.auth.token', 'mock-token');

    // Mock successful API response
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          topics: mockTopics,
          pagination: {
            page: 1,
            limit: 50,
            total: 2,
            totalPages: 1,
          },
        },
      }),
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('renders with placeholder text', () => {
    render(
      <LoungeSelector
        selectedLounges={[]}
        onChange={mockOnChange}
        placeholder="Choose topics"
      />
    );

    expect(screen.getByText('Choose topics')).toBeInTheDocument();
  });

  it('fetches and displays topics when opened', async () => {
    render(<LoungeSelector selectedLounges={[]} onChange={mockOnChange} />);

    // Open the dropdown
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Wait for topics to load
    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Business')).toBeInTheDocument();
    });
  });

  it('displays selected topics as badges', async () => {
    const { container } = render(
      <LoungeSelector selectedLounges={['1']} onChange={mockOnChange} />
    );

    // Wait for topics to load (happens automatically for selected topics)
    await waitFor(() => {
      const badge = container.querySelector(
        '.inline-flex.items-center.rounded-full'
      );
      expect(badge).toHaveTextContent('Technology');
    });
  });

  it('allows selecting topics', async () => {
    render(<LoungeSelector selectedLounges={[]} onChange={mockOnChange} />);

    // Open dropdown
    await user.click(screen.getByRole('combobox'));

    // Wait for topics to load
    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    // Select a topic by clicking on the item's text
    const techItem = screen.getByText('Technology').closest('[role="option"]');
    if (techItem) {
      await user.click(techItem);
    }

    expect(mockOnChange).toHaveBeenCalledWith(['1']);
  });

  it('enforces max selections limit', async () => {
    render(
      <LoungeSelector
        selectedLounges={['1']}
        onChange={mockOnChange}
        maxSelections={1}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('combobox'));

    // Wait for topics to load
    await waitFor(() => {
      expect(screen.getByText('Business')).toBeInTheDocument();
    });

    // Try to select another topic
    const businessItem = screen
      .getByText('Business')
      .closest('[role="option"]');
    if (businessItem) {
      await user.click(businessItem);
    }

    expect(mockOnChange).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Maximum 1 topics allowed');
  });

  it('shows create option for new topics', async () => {
    render(
      <LoungeSelector
        selectedLounges={[]}
        onChange={mockOnChange}
        allowCreate={true}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('combobox'));

    // Type a new topic name
    const searchInput = screen.getByPlaceholderText(
      'Search or create lounges...'
    );
    await user.type(searchInput, 'New Topic');

    // Should show create option
    await waitFor(() => {
      expect(screen.getByText('Create "New Topic"')).toBeInTheDocument();
    });
  });

  it('creates a new topic when create option is selected', async () => {
    const newTopic = {
      id: '3',
      name: 'New Topic',
      is_system_topic: false,
      user_id: 'user-123',
      parent_topic_id: null,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
      usage_count: 0,
      creator_count: 0,
      content_count: 0,
    };

    // Mock successful creation
    (global.fetch as jest.Mock).mockImplementation((url, options) => {
      if (options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: newTopic,
          }),
        });
      }
      // Default GET response
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: {
            topics: mockTopics,
            pagination: {
              page: 1,
              limit: 50,
              total: 2,
              totalPages: 1,
            },
          },
        }),
      });
    });

    render(
      <LoungeSelector
        selectedLounges={[]}
        onChange={mockOnChange}
        allowCreate={true}
      />
    );

    // Open dropdown
    await user.click(screen.getByRole('combobox'));

    // Type a new topic name
    const searchInput = screen.getByPlaceholderText(
      'Search or create lounges...'
    );
    await user.type(searchInput, 'New Topic');

    // Click create option
    await waitFor(() => {
      expect(screen.getByText('Create "New Topic"')).toBeInTheDocument();
    });

    const createItem = screen
      .getByText('Create "New Topic"')
      .closest('[role="option"]');
    if (createItem) {
      await user.click(createItem);
    }

    // Check onChange was called with new topic
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith(['3']);
    });

    // Check success toast
    expect(toast.success).toHaveBeenCalledWith('Topic "New Topic" created');
  });

  it('handles API errors gracefully', async () => {
    // Mock API error
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Failed to fetch topics' }),
    });

    render(<LoungeSelector selectedLounges={[]} onChange={mockOnChange} />);

    // Open dropdown
    await user.click(screen.getByRole('combobox'));

    // Should show error toast
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load topics');
    });
  });

  it('disables interaction when disabled prop is true', () => {
    render(
      <LoungeSelector
        selectedLounges={[]}
        onChange={mockOnChange}
        disabled={true}
      />
    );

    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });
});
