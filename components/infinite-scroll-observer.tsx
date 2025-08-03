'use client';

import { useEffect, useRef } from 'react';

interface InfiniteScrollObserverProps {
  onIntersect: () => void;
  rootMargin?: string;
  threshold?: number;
}

export function InfiniteScrollObserver({
  onIntersect,
  rootMargin = '100px',
  threshold = 0.1,
}: InfiniteScrollObserverProps) {
  const targetRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onIntersect);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onIntersect;
  });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callbackRef.current();
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [rootMargin, threshold]);

  return <div ref={targetRef} className="h-1" aria-hidden="true" />;
}
