// Shared database utilities for Edge Functions
import { createClient } from '@supabase/supabase-js'

export interface Database {
  public: {
    Tables: {
      devices: {
        Row: {
          id: string
          name: string
          golioth_id: string | null
          status: 'active' | 'inactive' | 'maintenance'
          organization_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          golioth_id?: string | null
          status?: 'active' | 'inactive' | 'maintenance'
          organization_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          golioth_id?: string | null
          status?: 'active' | 'inactive' | 'maintenance'
          organization_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      device_telemetry: {
        Row: {
          id: string
          device_id: string
          timestamp: string
          data: Record<string, any>
          created_at: string
        }
        Insert: {
          id?: string
          device_id: string
          timestamp?: string
          data: Record<string, any>
          created_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          timestamp?: string
          data?: Record<string, any>
          created_at?: string
        }
      }
    }
  }
}

/**
 * Create a Supabase client for Edge Functions
 * Uses service role key for full database access
 */
export function createServiceClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  
  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create a Supabase client with user context
 * Uses the JWT token from the request headers
 */
export function createClientWithAuth(authToken: string) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Extract and validate JWT token from request headers
 */
export function extractAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

/**
 * Validate required environment variables
 */
export function validateEnvironment() {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
  ]
  
  for (const env of required) {
    if (!Deno.env.get(env)) {
      throw new Error(`Missing required environment variable: ${env}`)
    }
  }
}

/**
 * Standard error response for Edge Functions
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  code?: string
) {
  return new Response(
    JSON.stringify({
      error: message,
      code,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * Standard success response for Edge Functions
 */
export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}