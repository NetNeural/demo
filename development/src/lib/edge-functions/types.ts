/**
 * Shared types for Edge Function Client
 */

/**
 * Standard edge function response format
 */
export interface EdgeFunctionResponse<T> {
  success: boolean
  data?: T
  error?: {
    message: string
    status: number
    [key: string]: unknown
  }
  message?: string
  meta?: Record<string, unknown>
  timestamp: string
}

/**
 * Edge function call options
 */
export interface EdgeFunctionOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string>
}
