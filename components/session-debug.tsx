'use client';

import React from 'react';
import { useSessionInfo, useSessionTimeout } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, Shield, User } from 'lucide-react';

interface SessionDebugProps {
  show?: boolean;
}

export function SessionDebug({
  show = process.env.NODE_ENV === 'development',
}: SessionDebugProps) {
  const sessionInfo = useSessionInfo();
  const timeoutInfo = useSessionTimeout();

  // Only show in development or when explicitly enabled
  if (!show) return null;

  const formatTime = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 bg-background/95 backdrop-blur-sm border-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4" />
          Session Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs">
        {/* Authentication Status */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            Status:
          </span>
          <Badge
            variant={sessionInfo.isAuthenticated ? 'default' : 'destructive'}
          >
            {sessionInfo.isAuthenticated
              ? 'Authenticated'
              : 'Not Authenticated'}
          </Badge>
        </div>

        {sessionInfo.isAuthenticated && (
          <>
            {/* Session Expiry */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Expires in:
              </span>
              <div className="text-right">
                <div
                  className={sessionInfo.isNearExpiry ? 'text-orange-500' : ''}
                >
                  {formatTime(sessionInfo.timeUntilExpiry)}
                </div>
                {sessionInfo.isNearExpiry && (
                  <Badge
                    variant="outline"
                    className="text-orange-500 border-orange-500"
                  >
                    Near Expiry
                  </Badge>
                )}
              </div>
            </div>

            {/* Last Activity */}
            <div className="flex items-center justify-between">
              <span>Last Activity:</span>
              <span>{formatTimestamp(sessionInfo.lastActivity || 0)}</span>
            </div>

            {/* Inactivity Timeout */}
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Timeout in:
              </span>
              <div className="text-right">
                <div
                  className={
                    timeoutInfo.timeRemaining < 5 * 60 * 1000
                      ? 'text-red-500'
                      : ''
                  }
                >
                  {formatTime(timeoutInfo.timeRemaining)}
                </div>
                {timeoutInfo.hasTimedOut && (
                  <Badge variant="destructive">Timed Out</Badge>
                )}
              </div>
            </div>

            {/* Session Warnings */}
            {(sessionInfo.isNearExpiry ||
              timeoutInfo.timeRemaining < 5 * 60 * 1000) && (
              <div className="pt-2 border-t">
                <div className="flex items-center gap-1 text-orange-600">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="font-medium">Session Warnings:</span>
                </div>
                <ul className="mt-1 space-y-1 text-orange-600">
                  {sessionInfo.isNearExpiry && (
                    <li>• Session will expire soon</li>
                  )}
                  {timeoutInfo.timeRemaining < 5 * 60 * 1000 && (
                    <li>• Inactivity timeout approaching</li>
                  )}
                </ul>
              </div>
            )}
          </>
        )}

        {/* Development Info */}
        <div className="pt-2 border-t text-muted-foreground">
          <div>Mode: Development</div>
          <div>Updated: {formatTimestamp(Date.now())}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SessionDebug;
