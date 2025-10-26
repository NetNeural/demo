'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="flex justify-center">
          <AlertTriangle className="h-16 w-16 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Something went wrong!</h1>
          <p className="text-muted-foreground">
            We&apos;ve been notified and are looking into the issue.
          </p>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <details className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-left">
            <summary className="cursor-pointer font-semibold text-destructive">
              Error Details (Development Only)
            </summary>
            <div className="mt-4 space-y-2">
              <p className="text-sm font-mono break-all">{error.message}</p>
              {error.digest && (
                <p className="text-xs text-muted-foreground">Digest: {error.digest}</p>
              )}
              {error.stack && (
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {error.stack}
                </pre>
              )}
            </div>
          </details>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button onClick={() => (window.location.href = '/dashboard')} variant="outline">
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
