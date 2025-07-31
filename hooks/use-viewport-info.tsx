'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

interface ViewportInfo {
  width: number;
  height: number;
  columns: number;
  batchSize: number;
}

export function useViewportInfo(): ViewportInfo {
  const [dimensions, setDimensions] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  });

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleResize = () => {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer with 250ms delay
      debounceTimerRef.current = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 250);
    };

    // Initial calculation
    setDimensions({
      width: window.innerWidth,
      height: window.innerHeight,
    });

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Memoize the calculated values to prevent unnecessary recalculations
  const viewportInfo = useMemo(() => {
    const { width, height } = dimensions;

    // Determine columns based on breakpoints
    let columns = 1;
    if (width >= 1280) {
      // xl breakpoint
      columns = 3;
    } else if (width >= 1024) {
      // lg breakpoint
      columns = 2;
    }

    // Calculate batch size to fill ~2 screens
    // Assuming each row is ~400px tall in grid view
    const rowHeight = 400;
    const rowsPerScreen = Math.ceil(height / rowHeight);
    const rowsForTwoScreens = rowsPerScreen * 2;

    // Round to nearest multiple of columns
    const batchSize = Math.ceil(rowsForTwoScreens * columns);

    return {
      width,
      height,
      columns,
      batchSize,
    };
  }, [dimensions]);

  return viewportInfo;
}
