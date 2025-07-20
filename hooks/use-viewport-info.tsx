'use client';

import { useState, useEffect } from 'react';

interface ViewportInfo {
  width: number;
  height: number;
  columns: number;
  batchSize: number;
}

export function useViewportInfo(): ViewportInfo {
  const [viewportInfo, setViewportInfo] = useState<ViewportInfo>({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    columns: 3,
    batchSize: 21,
  });

  useEffect(() => {
    const calculateInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

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

      setViewportInfo({
        width,
        height,
        columns,
        batchSize,
      });
    };

    calculateInfo();

    const handleResize = () => {
      calculateInfo();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return viewportInfo;
}
