/**
 * API Error Handler Utility
 *
 * Provides consistent error handling for API calls throughout the application.
 * Gracefully handles authentication errors (401/403) without throwing exceptions.
 */

interface ApiErrorOptions {
  /**
   * Whether to throw errors for non-auth issues (4xx, 5xx)
   * Default: true
   */
  throwOnError?: boolean

  /**
   * Whether to log errors to console
   * Default: true
   */
  logErrors?: boolean

  /**
   * Custom error message prefix
   */
  errorPrefix?: string

  /**
   * Whether to silently handle auth errors (401/403)
   * Default: true
   */
  silentAuthErrors?: boolean
}

interface ApiErrorResult {
  isAuthError: boolean
  isError: boolean
  statusCode: number
  statusText: string
  shouldRetry: boolean
}

/**
 * Handles API response errors with smart auth error detection
 *
 * @param response - The fetch Response object
 * @param options - Configuration options for error handling
 * @returns ApiErrorResult with error details
 * @throws Error if response is not ok and throwOnError is true (excluding auth errors)
 *
 * @example
 * ```ts
 * const response = await fetch('/api/data');
 * const errorResult = handleApiError(response, {
 *   errorPrefix: 'Failed to fetch data'
 * });
 *
 * if (errorResult.isAuthError) {
 *   // User not authenticated, handle gracefully
 *   return null;
 * }
 * ```
 */
export function handleApiError(
  response: Response,
  options: ApiErrorOptions = {}
): ApiErrorResult {
  const {
    throwOnError = true,
    logErrors = true,
    errorPrefix = 'API request failed',
    silentAuthErrors = true,
  } = options

  const result: ApiErrorResult = {
    isAuthError: response.status === 401 || response.status === 403,
    isError: !response.ok,
    statusCode: response.status,
    statusText: response.statusText,
    shouldRetry: response.status >= 500 && response.status < 600,
  }

  // If response is ok, return early
  if (response.ok) {
    return result
  }

  // Handle authentication errors silently
  if (result.isAuthError && silentAuthErrors) {
    if (logErrors) {
      console.warn(
        `[Auth] ${errorPrefix}: ${response.status} ${response.statusText}`,
        '- User may not be authenticated or lacks permissions'
      )
    }
    return result
  }

  // Log all other errors
  if (logErrors) {
    console.error(
      `[API Error] ${errorPrefix}:`,
      `${response.status} ${response.statusText}`
    )
  }

  // Throw error for non-auth issues if configured
  if (throwOnError && !result.isAuthError) {
    throw new Error(`${errorPrefix}: ${response.statusText}`)
  }

  return result
}

/**
 * Checks if a response has authentication errors
 *
 * @param response - The fetch Response object
 * @returns true if response is 401 or 403
 */
export function isAuthError(response: Response): boolean {
  return response.status === 401 || response.status === 403
}

/**
 * Checks if a response has server errors (5xx)
 *
 * @param response - The fetch Response object
 * @returns true if response status is between 500-599
 */
export function isServerError(response: Response): boolean {
  return response.status >= 500 && response.status < 600
}

/**
 * Checks if a response has client errors (4xx) excluding auth errors
 *
 * @param response - The fetch Response object
 * @returns true if response status is between 400-499 (excluding 401, 403)
 */
export function isClientError(response: Response): boolean {
  return (
    response.status >= 400 &&
    response.status < 500 &&
    response.status !== 401 &&
    response.status !== 403
  )
}

/**
 * Wrapper for fetch calls that automatically handles errors
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param errorOptions - Error handling configuration
 * @returns Response object or null if auth error occurred
 *
 * @example
 * ```ts
 * const data = await safeFetch('/api/data', {
 *   method: 'GET',
 *   headers: { 'Authorization': 'Bearer token' }
 * }, {
 *   errorPrefix: 'Failed to load data'
 * });
 *
 * if (!data) {
 *   // Auth error occurred
 *   return;
 * }
 * ```
 */
/**
 * Checks if a status code represents a retryable error (5xx)
 *
 * @param statusCode - The HTTP status code
 * @returns true if the error is retryable (500-599)
 */
export function isRetryableError(statusCode: number): boolean {
  return statusCode >= 500 && statusCode < 600
}

/**
 * Formats an API error into a human-readable string
 *
 * @param statusCode - The HTTP status code
 * @param statusText - The HTTP status text
 * @param prefix - Optional error prefix
 * @returns Formatted error string
 */
export function formatApiError(
  statusCode: number,
  statusText: string,
  prefix?: string
): string {
  const isAuth = statusCode === 401 || statusCode === 403
  if (isAuth) {
    return prefix
      ? `[Auth] ${prefix}: ${statusCode} ${statusText}`
      : `[Auth] ${statusCode} ${statusText}`
  }
  return prefix
    ? `${prefix}: ${statusCode} ${statusText}`
    : `${statusCode} ${statusText}`
}

export async function safeFetch(
  url: string,
  options?: RequestInit,
  errorOptions?: ApiErrorOptions
): Promise<Response | null> {
  try {
    const response = await fetch(url, options)
    const errorResult = handleApiError(response, errorOptions)

    // Return null for auth errors instead of response
    if (errorResult.isAuthError) {
      return null
    }

    return response
  } catch (error) {
    console.error('[safeFetch] Network or fetch error:', error)
    throw error
  }
}
