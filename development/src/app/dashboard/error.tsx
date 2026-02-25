'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error)

    // Show feedback dialog in production
    if (process.env.NODE_ENV === 'production') {
      const eventId = Sentry.lastEventId()
      if (eventId) {
        Sentry.showReportDialog({
          eventId,
          title: 'Something went wrong',
          subtitle: 'Our team has been notified.',
          subtitle2: 'If you would like to help, tell us what happened below.',
        })
      }
    }
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900">
            Something went wrong
          </h2>

          <p className="mb-6 text-gray-600">
            We&apos;ve been notified and are working to fix the issue.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <details className="mb-6 w-full">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Error details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 text-left text-xs">
                {error.message}
              </pre>
            </details>
          )}

          <div className="flex gap-3">
            <Button onClick={reset} variant="default">
              Try Again
            </Button>
            <Button
              onClick={() => (window.location.href = '/dashboard')}
              variant="outline"
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
