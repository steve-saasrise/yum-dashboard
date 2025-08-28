'use client';

import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulletPoint {
  text: string;
  sourceUrl?: string;
}

interface AISummaryDisplayProps {
  bullets: BulletPoint[];
  className?: string;
  showLinks?: boolean;
  compact?: boolean;
}

export function AISummaryDisplay({
  bullets,
  className,
  showLinks = true,
  compact = false,
}: AISummaryDisplayProps) {
  if (!bullets || bullets.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
        <Sparkles className="h-3 w-3" />
        <span>AI Summary</span>
      </div>
      <ul className={cn('space-y-1.5', compact ? 'text-xs' : 'text-sm')}>
        {bullets.map((bullet, index) => (
          <li key={index} className="flex items-start gap-1.5">
            <span className="text-muted-foreground mt-0.5">•</span>
            <span className="flex-1 leading-relaxed">
              {bullet.text}
              {showLinks && bullet.sourceUrl && (
                <a
                  href={bullet.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 ml-1 text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
