/**
 * Utility for creating standardized Edge Function responses and handling
 * common functionality across all Supabase Edge Functions.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from './cors.ts'

export interface EdgeFunctionContext {
  request: Request
  supabase: any
  url: URL
}

export interface EdgeFunctionOptions {
  requireAuth?: boolean
  allowedMethods?: string[]
  corsEnabled?: boolean
}

/**
 * Creates a standardized Edge Function wrapper with common functionality
 */
export function createEdgeFunction(
  handler: (context: EdgeFunctionContext) => Promise<Response>,
  options: EdgeFunctionOptions = {}
) {
  const {
    requireAuth = true,
    allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'],
    corsEnabled = true
  } = options

  return async (req: Request): Promise<Response> => {
    // Handle CORS preflight
    if (corsEnabled && req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // Check allowed methods
    if (!allowedMethods.includes(req.method)) {
      return new Response(
        JSON.stringify({ error: `Method ${req.method} not allowed` }),
        { 
          status: 405, 
          headers: corsEnabled ? { ...corsHeaders, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
        }
      )
    }

    try {
      const url = new URL(req.url)
      
      // Create Supabase client
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: {
            headers: { Authorization: req.headers.get('Authorization')! },
          },
        }
      )

      // Check authentication if required
      if (requireAuth) {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: 'Missing authorization header' }),
            { 
              status: 401, 
              headers: corsEnabled ? { ...corsHeaders, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
            }
          )
        }

        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) {
          return new Response(
            JSON.stringify({ error: 'Invalid or expired token' }),
            { 
              status: 401, 
              headers: corsEnabled ? { ...corsHeaders, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
            }
          )
        }
      }

      // Call the handler
      const context: EdgeFunctionContext = { request: req, supabase, url }
      const response = await handler(context)

      // Add CORS headers to response if enabled
      if (corsEnabled) {
        const headers = new Headers(response.headers)
        Object.entries(corsHeaders).forEach(([key, value]) => {
          headers.set(key, value)
        })
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        })
      }

      return response

    } catch (error) {
      console.error('Edge Function Error:', error)
      
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error)
        }),
        { 
          status: 500, 
          headers: corsEnabled ? { ...corsHeaders, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
        }
      )
    }
  }
}

/**
 * Creates a success response with standardized format
 */
export function createSuccessResponse(data: any, status = 200): Response {
  return new Response(
    JSON.stringify({ success: true, data }),
    { 
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Creates an error response with standardized format
 */
export function createErrorResponse(message: string, status = 400, details?: any): Response {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      ...(details && { details })
    }),
    { 
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

/**
 * Validates required environment variables
 */
export function validateEnvironment(requiredVars: string[]): string | null {
  for (const varName of requiredVars) {
    if (!Deno.env.get(varName)) {
      return `Missing required environment variable: ${varName}`
    }
  }
  return null
}

/**
 * Extracts and validates JSON body from request
 */
export async function getJsonBody(request: Request): Promise<any> {
  try {
    const text = await request.text()
    if (!text) {
      throw new Error('Empty request body')
    }
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`Invalid JSON in request body: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Extracts user ID from authenticated request
 */
export async function getUserId(supabase: any): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error('User not authenticated')
  }
  return user.id
}

/**
 * Logs function invocation with context
 */
export function logFunctionCall(functionName: string, method: string, url: string, userId?: string) {
  console.log(`[${functionName}] ${method} ${url}${userId ? ` (User: ${userId})` : ''}`)
}