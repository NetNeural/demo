'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

export default function AuthError({
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
          title: 'Authentication Error',
          subtitle: 'We encountered an issue with authentication.',
          subtitle2: 'If you would like to help, tell us what happened below.',
        })
      }
    }
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
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
              <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <h2 className="mb-2 text-2xl font-semibold text-gray-900">
            Authentication Error
          </h2>

          <p className="mb-6 text-gray-600">
            There was a problem with authentication. Please try again.
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
              onClick={() => (window.location.href = '/auth/login')}
              variant="outline"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
