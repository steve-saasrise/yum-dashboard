'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Something went wrong!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          An error occurred while loading this page.
        </p>
        <Button onClick={reset}>Try Again</Button>
      </div>
    </div>
  );
}
