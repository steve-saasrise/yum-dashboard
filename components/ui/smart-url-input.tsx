'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Input } from './input';
import { cn } from '@/lib/utils';
import { PlatformDetector, Platform, type PlatformInfo } from '@/lib/platform-detector';
import { Loader2, XCircle, Youtube, Twitter, Linkedin, Rss } from 'lucide-react';

interface SmartUrlInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'onError'> {
  onChange?: (value: string) => void;
  onPlatformDetected?: (platformInfo: PlatformInfo) => void;
  onError?: (error: Error) => void;
  debounceMs?: number;
}

const platformIcons = {
  [Platform.YOUTUBE]: Youtube,
  [Platform.TWITTER]: Twitter,
  [Platform.LINKEDIN]: Linkedin,
  [Platform.THREADS]: Twitter, // Using Twitter icon for Threads as placeholder
  [Platform.RSS]: Rss,
  [Platform.UNKNOWN]: XCircle,
} as const;

const platformLabels = {
  [Platform.YOUTUBE]: 'YouTube',
  [Platform.TWITTER]: 'Twitter',
  [Platform.LINKEDIN]: 'LinkedIn',
  [Platform.THREADS]: 'Threads',
  [Platform.RSS]: 'RSS',
  [Platform.UNKNOWN]: 'Unknown',
} as const;

export const SmartUrlInput = React.forwardRef<HTMLInputElement, SmartUrlInputProps>(
  ({ 
    className, 
    onChange, 
    onPlatformDetected, 
    onError, 
    debounceMs = 500,
    placeholder = 'Enter creator URL (YouTube, Twitter, LinkedIn, Threads, RSS)',
    ...props 
  }, ref) => {
    const [value, setValue] = useState('');
    const [isDetecting, setIsDetecting] = useState(false);
    const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

    const detectPlatform = useCallback((url: string) => {
      if (!url.trim()) {
        setPlatformInfo(null);
        setError(null);
        return;
      }

      setIsDetecting(true);
      setError(null);

      try {
        const detection = PlatformDetector.detect(url);
        setPlatformInfo(detection);
        onPlatformDetected?.(detection);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Platform detection failed');
        setError(error.message);
        setPlatformInfo(null);
        onError?.(error);
      } finally {
        setIsDetecting(false);
      }
    }, [onPlatformDetected, onError]);

    const debouncedDetectPlatform = useCallback((url: string) => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      const timer = setTimeout(() => {
        detectPlatform(url);
      }, debounceMs);

      setDebounceTimer(timer);
    }, [detectPlatform, debounceMs, debounceTimer]);

    useEffect(() => {
      return () => {
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
      };
    }, [debounceTimer]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      onChange?.(newValue);
      debouncedDetectPlatform(newValue);
    };

    const getInputClassName = () => {
      const baseClasses = 'pr-12';
      if (error) return cn(baseClasses, 'border-destructive focus:border-destructive', className);
      if (platformInfo) return cn(baseClasses, 'border-green-500 focus:border-green-500', className);
      return cn(baseClasses, className);
    };

    const renderStatusIndicator = () => {
      if (isDetecting) {
        return (
          <div 
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            data-testid="loading-indicator"
          >
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        );
      }

      if (error) {
        return (
          <div 
            className="absolute right-3 top-1/2 transform -translate-y-1/2"
            data-testid="error-indicator"
            title={error}
          >
            <XCircle className="h-4 w-4 text-destructive" />
          </div>
        );
      }

      if (platformInfo) {
        const Icon = platformIcons[platformInfo.platform];
        const label = platformLabels[platformInfo.platform];
        
        return (
          <div 
            className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center gap-1"
            data-testid="platform-indicator"
            aria-live="polite"
          >
            <Icon className="h-4 w-4 text-green-600" />
            <span className="text-xs text-green-600 font-medium">{label}</span>
          </div>
        );
      }

      return null;
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          value={value}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={getInputClassName()}
          aria-label="Creator URL input with platform detection"
          {...props}
        />
        {renderStatusIndicator()}
        {error && (
          <p className="mt-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

SmartUrlInput.displayName = 'SmartUrlInput';