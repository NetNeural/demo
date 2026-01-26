'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Capture the error in Sentry
    const eventId = Sentry.captureException(error);
    
    // Show user feedback dialog
    Sentry.showReportDialog({
      eventId,
      title: 'It looks like we\'re having issues',
      subtitle: 'Our team has been notified.',
      subtitle2: 'If you\'d like to help, tell us what happened below.',
      labelName: 'Name',
      labelEmail: 'Email',
      labelComments: 'What happened?',
      labelClose: 'Close',
      labelSubmit: 'Submit',
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong!
              </h1>
              <p className="text-gray-600">
                We apologize for the inconvenience. Our team has been automatically notified and is working on a fix.
              </p>
            </div>

            {error.digest && (
              <div className="mb-6 p-3 bg-gray-100 rounded text-xs text-gray-600">
                <span className="font-semibold">Error ID:</span> {error.digest}
              </div>
            )}

            <div className="space-y-3">
              <Button
                onClick={reset}
                className="w-full"
              >
                Try again
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                variant="outline"
                className="w-full"
              >
                Go to homepage
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

