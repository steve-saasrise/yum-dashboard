'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';

function AuthErrorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const description = searchParams.get('description');
  const [isRetrying, setIsRetrying] = useState(false);

  // Determine error type and appropriate actions
  const getErrorInfo = () => {
    const errorMessage = description || error || 'An unknown error occurred';

    if (
      errorMessage.includes('expired') ||
      errorMessage.includes('invalid_grant')
    ) {
      return {
        title: 'Magic Link Expired',
        message:
          'This magic link has expired. Magic links are only valid for 1 hour for security reasons.',
        action: 'Request New Magic Link',
        actionHref: '/auth/login',
        canRetry: true,
        suggestion: 'Please request a new magic link to continue signing in.',
      };
    }

    if (errorMessage.includes('Email link is invalid')) {
      return {
        title: 'Invalid Magic Link',
        message: 'This magic link is invalid or has already been used.',
        action: 'Request New Magic Link',
        actionHref: '/auth/login',
        canRetry: true,
        suggestion: 'Please request a new magic link to continue signing in.',
      };
    }

    if (
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    ) {
      return {
        title: 'Rate Limit Exceeded',
        message:
          'Too many authentication attempts. Please wait before trying again.',
        action: 'Try Again Later',
        actionHref: '/auth/login',
        canRetry: false,
        suggestion:
          'Please wait a few minutes before requesting a new magic link.',
      };
    }

    if (errorMessage.includes('access_denied')) {
      return {
        title: 'Access Denied',
        message: 'Authentication was cancelled or denied.',
        action: 'Try Again',
        actionHref: '/auth/login',
        canRetry: true,
        suggestion: 'Please try signing in again.',
      };
    }

    return {
      title: 'Authentication Error',
      message: errorMessage,
      action: 'Try Again',
      actionHref: '/auth/login',
      canRetry: true,
      suggestion: 'Please try signing in again.',
    };
  };

  const errorInfo = getErrorInfo();

  const handleRetry = async () => {
    setIsRetrying(true);

    // Add a small delay to show the loading state
    await new Promise((resolve) => setTimeout(resolve, 1000));

    router.push(errorInfo.actionHref);
    setIsRetrying(false);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-destructive/10 rounded-full">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">
            {errorInfo.title}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {errorInfo.suggestion}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {errorInfo.message}
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <Button
              onClick={handleRetry}
              disabled={isRetrying || !errorInfo.canRetry}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {errorInfo.action}
                </>
              )}
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>

          {errorInfo.canRetry && (
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Need help?{' '}
                <Link href="/support" className="underline hover:text-primary">
                  Contact Support
                </Link>
              </p>
            </div>
          )}

          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            <p>
              For security reasons, magic links expire after 1 hour.
              <br />
              If you continue to experience issues, please contact support.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-background">
          <Card className="w-full max-w-md">
            <CardContent className="p-8">
              <div className="flex items-center justify-center">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <AuthErrorContent />
    </Suspense>
  );
}
