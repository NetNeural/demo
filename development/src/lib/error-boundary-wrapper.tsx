'use client'

import { Component, ReactNode } from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

/**
 * Reusable Error Boundary component that automatically reports to Sentry.
 * Use this to wrap any component tree that needs error handling.
 *
 * @example
 * ```tsx
 * <ErrorBoundaryWrapper>
 *   <YourComponent />
 * </ErrorBoundaryWrapper>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundaryWrapper fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundaryWrapper>
 * ```
 */
export class ErrorBoundaryWrapper extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Report to Sentry
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    })

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

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo)
  }

  override render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center p-6">
          <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6">
            <div className="flex flex-col items-center text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg
                  className="h-6 w-6 text-red-600"
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

              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Something went wrong
              </h3>

              <p className="mb-4 text-sm text-gray-600">
                We&apos;ve been notified and are working to fix the issue.
              </p>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mb-4 w-full">
                  <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                    Error details
                  </summary>
                  <pre className="mt-2 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-left text-xs">
                    {this.state.error.message}
                  </pre>
                </details>
              )}

              <Button
                onClick={() => this.setState({ hasError: false })}
                variant="outline"
                size="sm"
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
