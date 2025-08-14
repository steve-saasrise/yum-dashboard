'use client';

import { useSessionTracking } from '@/hooks/use-session-tracking';

export function SessionTrackingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useSessionTracking();
  return <>{children}</>;
}
