import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SmartUrlInput } from '../smart-url-input';
import { Platform } from '@/lib/platform-detector';

// Mock the platform detector
jest.mock('@/lib/platform-detector', () => ({
  PlatformDetector: {
    detect: jest.fn(),
  },
  Platform: {
    YOUTUBE: 'youtube',
    TWITTER: 'twitter',
    LINKEDIN: 'linkedin',
    THREADS: 'threads',
    RSS: 'rss',
  },
  PlatformDetectionError: class PlatformDetectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'PlatformDetectionError';
    }
  },
}));

const mockPlatformDetector = require('@/lib/platform-detector').PlatformDetector;

describe('SmartUrlInput', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('renders input field with placeholder', () => {
      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('placeholder', 'Enter creator URL (YouTube, Twitter, LinkedIn, Threads, RSS)');
    });

    it('accepts and displays user input', async () => {
      const user = userEvent.setup();
      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      expect(input).toHaveValue('https://youtube.com/@test');
    });

    it('calls onChange callback when value changes', async () => {
      const user = userEvent.setup();
      const mockOnChange = jest.fn();
      render(<SmartUrlInput onChange={mockOnChange} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'test');
      
      expect(mockOnChange).toHaveBeenCalledWith('test');
    });
  });

  describe('Platform detection', () => {
    it('detects YouTube platform and shows indicator', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.YOUTUBE,
        platformUserId: 'UC123',
        profileUrl: 'https://youtube.com/@test',
        metadata: { channelId: 'UC123' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toHaveTextContent('YouTube');
      });
    });

    it('detects Twitter platform and shows indicator', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.TWITTER,
        platformUserId: 'test',
        profileUrl: 'https://twitter.com/test',
        metadata: { username: 'test' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://twitter.com/test');
      
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toHaveTextContent('Twitter');
      });
    });

    it('detects LinkedIn platform and shows indicator', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.LINKEDIN,
        platformUserId: 'test-company',
        profileUrl: 'https://linkedin.com/company/test-company',
        metadata: { companyId: 'test-company' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://linkedin.com/company/test-company');
      
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toHaveTextContent('LinkedIn');
      });
    });

    it('detects Threads platform and shows indicator', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.THREADS,
        platformUserId: 'test',
        profileUrl: 'https://threads.net/@test',
        metadata: { username: 'test' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://threads.net/@test');
      
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toHaveTextContent('Threads');
      });
    });

    it('detects RSS platform and shows indicator', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.RSS,
        platformUserId: 'feed',
        profileUrl: 'https://example.com/feed.xml',
        metadata: { feedUrl: 'https://example.com/feed.xml' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://example.com/feed.xml');
      
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toHaveTextContent('RSS');
      });
    });
  });

  describe('Error handling', () => {
    it('shows error state for invalid URL', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockImplementation(() => {
        throw new Error('Invalid URL format');
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'invalid-url');
      
      await waitFor(() => {
        expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
        expect(input).toHaveClass('border-destructive');
      });
    });

    it('shows error message for unsupported platform', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockImplementation(() => {
        throw new Error('Unsupported platform');
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://unsupported.com/user');
      
      await waitFor(() => {
        expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
        expect(screen.getByText('Unsupported platform')).toBeInTheDocument();
      });
    });

    it('clears error state when valid URL is entered', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect
        .mockImplementationOnce(() => {
          throw new Error('Invalid URL');
        })
        .mockReturnValueOnce({
          platform: Platform.YOUTUBE,
          platformUserId: 'UC123',
          profileUrl: 'https://youtube.com/@test',
          metadata: { channelId: 'UC123' },
        });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'invalid');
      
      await waitFor(() => {
        expect(screen.getByTestId('error-indicator')).toBeInTheDocument();
      });

      await user.clear(input);
      await user.type(input, 'https://youtube.com/@test');
      
      await waitFor(() => {
        expect(screen.queryByTestId('error-indicator')).not.toBeInTheDocument();
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Real-time detection', () => {
    it('debounces platform detection to avoid excessive API calls', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.YOUTUBE,
        platformUserId: 'UC123',
        profileUrl: 'https://youtube.com/@test',
        metadata: { channelId: 'UC123' },
      });

      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      // Should only call detect once after debounce delay
      expect(mockPlatformDetector.detect).toHaveBeenCalledTimes(0);
      
      await waitFor(() => {
        expect(mockPlatformDetector.detect).toHaveBeenCalledTimes(1);
      });
    });

    it('shows loading state during detection', async () => {
      const user = userEvent.setup();
      
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.YOUTUBE,
        platformUserId: 'UC123',
        profileUrl: 'https://youtube.com/@test',
        metadata: { channelId: 'UC123' },
      });

      render(<SmartUrlInput debounceMs={50} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      // After debounce, platform should be detected
      await waitFor(() => {
        expect(screen.getByTestId('platform-indicator')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<SmartUrlInput />);
      
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Creator URL input with platform detection');
    });

    it('announces platform detection to screen readers', async () => {
      const user = userEvent.setup();
      mockPlatformDetector.detect.mockReturnValue({
        platform: Platform.YOUTUBE,
        platformUserId: 'UC123',
        profileUrl: 'https://youtube.com/@test',
        metadata: { channelId: 'UC123' },
      });

      render(<SmartUrlInput debounceMs={50} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      await waitFor(() => {
        const indicator = screen.getByTestId('platform-indicator');
        expect(indicator).toHaveAttribute('aria-live', 'polite');
      });
    });
  });

  describe('Callback functions', () => {
    it('calls onPlatformDetected callback with platform info', async () => {
      const user = userEvent.setup();
      const mockOnPlatformDetected = jest.fn();
      const platformInfo = {
        platform: Platform.YOUTUBE,
        platformUserId: 'UC123',
        profileUrl: 'https://youtube.com/@test',
        metadata: { channelId: 'UC123' },
      };
      
      mockPlatformDetector.detect.mockReturnValue(platformInfo);

      render(<SmartUrlInput onPlatformDetected={mockOnPlatformDetected} debounceMs={50} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'https://youtube.com/@test');
      
      await waitFor(() => {
        expect(mockOnPlatformDetected).toHaveBeenCalledWith(platformInfo);
      });
    });

    it('calls onError callback when detection fails', async () => {
      const user = userEvent.setup();
      const mockOnError = jest.fn();
      const error = new Error('Invalid URL');
      
      mockPlatformDetector.detect.mockImplementation(() => {
        throw error;
      });

      render(<SmartUrlInput onError={mockOnError} debounceMs={50} />);
      
      const input = screen.getByRole('textbox');
      await user.type(input, 'invalid-url');
      
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(error);
      });
    });
  });
});