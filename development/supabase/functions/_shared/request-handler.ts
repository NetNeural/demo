// ===========================================================================
// Edge Function Request Handler - Centralized
// ===========================================================================
// Higher-order function for consistent edge function patterns
// Features: CORS, auth, validation, error handling, logging
// ===========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  getUserContext, 
  createAuthenticatedClient, 
  corsHeaders,
  type UserContext 
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

  return serve(async (req: Request) => {
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
        return createErrorResponse(
          `Method ${method} not allowed`,
          405,
          { allowedMethods }
        )
      }

      const ctx: RequestContext = { 
        req, 
        method, 
        url,
        headers: req.headers 
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
          return createErrorResponse(
            authError instanceof Error ? authError.message : 'Authentication failed',
            401
          )
        }
      }

      // Call handler
      const response = await handler(ctx)

      // Log activity with metrics
      const duration = Date.now() - startTime
      if (logActivity && ctx.userContext) {
        console.log(`[${method}] ${url.pathname} - ${ctx.userContext.email} - ${duration}ms`)
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
      console.error(`[Error] ${req.method} ${new URL(req.url).pathname} - ${duration}ms`, error)
      return handleEdgeFunctionError(error)
    }
  })
}

/**
 * Standardized error handler for all edge functions
 */
export function handleEdgeFunctionError(error: unknown): Response {
  console.error('[Edge Function Error]:', error)

  // Handle IntegrationError (from providers)
  if (error instanceof IntegrationError) {
    return createErrorResponse(error.message, error.status || 500, {
      code: error.code,
      details: error.details,
    })
  }

  // Handle standard errors
  if (error instanceof Error) {
    // Authentication errors
    if (error.message.includes('Unauthorized') || error.message.includes('expired token')) {
      return createErrorResponse(error.message, 401)
    }

    // Validation errors
    if (error.message.includes('required') || error.message.includes('Invalid')) {
      return createErrorResponse(error.message, 400)
    }

    // Permission errors
    if (error.message.includes('permission') || error.message.includes('Forbidden')) {
      return createErrorResponse(error.message, 403)
    }

    // Not found errors
    if (error.message.includes('not found')) {
      return createErrorResponse(error.message, 404)
    }

    // Generic error
    return createErrorResponse(error.message, 500)
  }

  // Unknown error
  return createErrorResponse('Internal server error', 500)
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
 * Always returns JSON with consistent structure
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: Record<string, unknown>
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        message,
        status,
        ...details,
      },
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Database error helper
 */
export class DatabaseError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message)
    this.name = 'DatabaseError'
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
