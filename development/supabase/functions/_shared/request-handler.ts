// ===========================================================================
// Edge Function Request Handler - Centralized
// ===========================================================================
// Higher-order function for consistent edge function patterns
// Features: CORS, auth, validation, error handling, logging
// ===========================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  getUserContext,
  createAuthenticatedClient,
  corsHeaders,
  type UserContext,
} from './auth.ts'
import { IntegrationError } from './base-integration-client.ts'

export interface EdgeFunctionOptions {
  requireAuth?: boolean
  allowedMethods?: string[]
  allowSuperAdminOnly?: boolean
  logActivity?: boolean
}

export interface RequestContext {
  req: Request
  userContext?: UserContext
  supabase?: ReturnType<typeof createClient>
  method: string
  url: URL
  headers: Headers
}

/**
 * Higher-order function for edge functions
 * Handles: CORS, auth, method validation, error handling
 *
 * @example
 * ```typescript
 * export default createEdgeFunction(async ({ req, userContext, supabase, url }) => {
 *   if (req.method === 'GET') {
 *     const data = await supabase.from('table').select('*')
 *     return createSuccessResponse(data)
 *   }
 * })
 * ```
 */
export function createEdgeFunction(
  handler: (ctx: RequestContext) => Promise<Response>,
  options: EdgeFunctionOptions = {}
) {
  const {
    requireAuth = true,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowSuperAdminOnly = false,
    logActivity = false,
  } = options

  return Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    const startTime = Date.now()

    try {
      const url = new URL(req.url)
      const method = req.method

      // Method validation
      if (!allowedMethods.includes(method)) {
        return createErrorResponse(`Method ${method} not allowed`, 405, {
          allowedMethods,
        })
      }

      const ctx: RequestContext = {
        req,
        method,
        url,
        headers: req.headers,
      }

      // Authentication
      if (requireAuth) {
        try {
          ctx.userContext = await getUserContext(req)
          ctx.supabase = createAuthenticatedClient(req)

          if (allowSuperAdminOnly && !ctx.userContext.isSuperAdmin) {
            return createErrorResponse('Super admin access required', 403)
          }
        } catch (authError) {
          console.error('Authentication error:', authError)
          // Return 401 with detailed error message for debugging
          return createErrorResponse(
            authError instanceof Error
              ? authError.message
              : 'Authentication failed',
            401,
            {
              error:
                authError instanceof Error
                  ? authError.message
                  : String(authError),
              hint: 'Check JWT configuration in Supabase dashboard',
            }
          )
        }
      }

      // Call handler
      const response = await handler(ctx)

      // Log activity with metrics
      const duration = Date.now() - startTime
      if (logActivity && ctx.userContext) {
        console.log(
          `[${method}] ${url.pathname} - ${ctx.userContext.email} - ${duration}ms`
        )
      } else {
        console.log(`[${method}] ${url.pathname} - ${duration}ms`)
      }

      // Add performance headers for debugging
      const headersWithMetrics = new Headers(response.headers)
      headersWithMetrics.set('X-Response-Time', `${duration}ms`)
      headersWithMetrics.set('X-Request-ID', crypto.randomUUID())

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headersWithMetrics,
      })
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(
        `[Error] ${req.method} ${new URL(req.url).pathname} - ${duration}ms`,
        error
      )
      return handleEdgeFunctionError(error)
    }
  })
}

/**
 * Standardized error handler for all edge functions
 */
export function handleEdgeFunctionError(error: unknown): Response {
  console.error('[Edge Function Error]:', error)

  // Handle DatabaseError with status code
  if (error instanceof DatabaseError) {
    return createErrorResponse(error.message, error.status, {
      error: getErrorType(error.status),
      ...(error.details && { details: error.details }),
    })
  }

  // Handle IntegrationError (from providers)
  if (error instanceof IntegrationError) {
    return createErrorResponse(error.message, error.status || 500, {
      error: error.code || getErrorType(error.status || 500),
      details: error.details,
    })
  }

  // Handle standard errors
  if (error instanceof Error) {
    // Authentication errors
    if (
      error.message.includes('Unauthorized') ||
      error.message.includes('expired token')
    ) {
      return createErrorResponse(error.message, 401, { error: 'Unauthorized' })
    }

    // Validation errors
    if (
      error.message.includes('required') ||
      error.message.includes('Invalid')
    ) {
      return createErrorResponse(error.message, 400, { error: 'Bad Request' })
    }

    // Permission errors
    if (
      error.message.includes('permission') ||
      error.message.includes('Forbidden')
    ) {
      return createErrorResponse(error.message, 403, { error: 'Forbidden' })
    }

    // Not found errors
    if (error.message.includes('not found')) {
      return createErrorResponse(error.message, 404, { error: 'Not Found' })
    }

    // Generic error
    return createErrorResponse(error.message, 500, {
      error: 'Internal server error',
    })
  }

  // Unknown error
  return createErrorResponse('Internal server error', 500, {
    error: 'Internal server error',
  })
}

/**
 * Get error type string from status code
 */
function getErrorType(status: number): string {
  switch (status) {
    case 400:
      return 'Bad Request'
    case 401:
      return 'Unauthorized'
    case 403:
      return 'Forbidden'
    case 404:
      return 'Not Found'
    case 405:
      return 'Method Not Allowed'
    case 500:
      return 'Internal Server Error'
    default:
      return 'Error'
  }
}

/**
 * Standardized success response
 * Always returns JSON with consistent structure
 */
export function createSuccessResponse<T>(
  data: T,
  options: {
    status?: number
    message?: string
    meta?: Record<string, unknown>
  } = {}
): Response {
  const { status = 200, message, meta } = options

  return new Response(
    JSON.stringify({
      success: true,
      data,
      ...(message && { message }),
      ...(meta && { meta }),
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Standardized error response
 * Returns format matching OpenAPI spec: { error: string, message: string }
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  const errorType = details?.error || getErrorType(status)

  return new Response(
    JSON.stringify({
      success: false,
      error: errorType,
      message,
      ...(details &&
        Object.keys(details).length > 1 && {
          details: Object.fromEntries(
            Object.entries(details).filter(([key]) => key !== 'error')
          ),
        }),
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Database error helper with status code
 */
export class DatabaseError extends Error {
  public status: number

  constructor(
    message: string,
    status: number = 500,
    public details?: unknown
  ) {
    super(message)
    this.name = 'DatabaseError'
    this.status = status
  }
}

/**
 * Extract and validate request body
 */
export async function getRequestBody<T>(req: Request): Promise<T> {
  try {
    const body = await req.json()
    return body as T
  } catch {
    throw new Error('Invalid JSON in request body')
  }
}

/**
 * Extract query parameters
 */
export function getQueryParams(url: URL): Record<string, string> {
  return Object.fromEntries(url.searchParams)
}
