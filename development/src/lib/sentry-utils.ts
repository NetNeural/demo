import * as Sentry from '@sentry/nextjs'

interface ApiErrorOptions {
  endpoint: string
  method?: string
  status?: number
  errorData?: unknown
  context?: Record<string, unknown>
  showFeedbackDialog?: boolean // Optional: override default behavior
  skipUserNotification?: boolean // Optional: skip showing the feedback dialog entirely
}

/**
 * Handles API errors and automatically sends them to Sentry
 * Automatically shows user feedback dialog in production for critical errors
 * Use this in catch blocks for API calls
 * @returns Sentry event ID
 */
export function handleApiError(
  error: unknown,
  options: ApiErrorOptions
): string {
  console.error(`[API Error] ${options.endpoint}:`, error)

  const errorMessage = error instanceof Error ? error.message : String(error)
  const sentryError = error instanceof Error ? error : new Error(errorMessage)

  const eventId = Sentry.captureException(sentryError, {
    extra: {
      endpoint: options.endpoint,
      method: options.method || 'GET',
      status: options.status,
      errorData: options.errorData,
      ...options.context,
    },
    tags: {
      error_type: 'api_error',
      api_endpoint: options.endpoint,
      ...(options.status && { http_status: options.status.toString() }),
    },
  })

  // Show feedback dialog in production for critical errors
  // Skip if explicitly requested via skipUserNotification
  const shouldShowDialog =
    !options.skipUserNotification &&
    options.showFeedbackDialog !== false &&
    process.env.NODE_ENV === 'production' &&
    options.status &&
    options.status >= 400 &&
    options.status < 600 // All 4xx and 5xx errors

  if (shouldShowDialog) {
    // Determine dialog message based on error type
    let title = 'Something went wrong'
    let subtitle = "We've been notified and are looking into it."

    if (options.status === 401 || options.status === 403) {
      title = 'Access Denied'
      subtitle = "You don't have permission to perform this action."
    } else if (options.status === 404) {
      title = 'Not Found'
      subtitle = "The resource you're looking for doesn't exist."
    } else if (options.status && options.status >= 500) {
      title = 'Server Error'
      subtitle = 'Our servers encountered an issue.'
    } else if (options.status === 400) {
      title = 'Invalid Request'
      subtitle = "The request couldn't be processed."
    }

    Sentry.showReportDialog({
      eventId,
      title,
      subtitle,
      subtitle2:
        "If you'd like to help us fix this, please tell us what happened.",
      labelName: 'Name',
      labelEmail: 'Email',
      labelComments: 'What were you trying to do?',
      labelClose: 'Close',
      labelSubmit: 'Submit',
    })
  }

  return eventId
}

/**
 * Wraps an async function and automatically sends errors to Sentry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withSentryErrorHandler<
  T extends (...args: any[]) => Promise<any>,
>(fn: T, context?: Record<string, unknown>): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      console.error('[Error in wrapped function]:', error)

      Sentry.captureException(error, {
        extra: {
          function_name: fn.name,
          arguments: args,
          ...context,
        },
        tags: {
          error_type: 'wrapped_function',
        },
      })

      throw error
    }
  }) as T
}

/**
 * Sends a custom error to Sentry with optional context
 */
export function reportError(
  error: Error | string,
  context?: {
    component?: string
    action?: string
    extra?: Record<string, unknown>
    tags?: Record<string, string>
  }
): string {
  const sentryError = typeof error === 'string' ? new Error(error) : error

  const eventId = Sentry.captureException(sentryError, {
    extra: {
      component: context?.component,
      action: context?.action,
      ...context?.extra,
    },
    tags: {
      error_type: 'manual_report',
      ...context?.tags,
    },
  })

  return eventId
}
