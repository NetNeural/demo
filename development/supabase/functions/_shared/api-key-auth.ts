/**
 * API Key Authentication Middleware
 * Validates `Authorization: Bearer nn_live_...` tokens for the Customer Export API (#383)
 *
 * Flow:
 *  1. Extract raw key from Authorization header
 *  2. SHA-256 hash it
 *  3. Look up organization_api_keys by key_hash
 *  4. Validate: active, not revoked, not expired, scope check
 *  5. Update last_used_at (best-effort, non-blocking)
 *  6. Return org context for downstream handlers
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

export interface ApiKeyContext {
  organizationId: string
  scopes: string[]
  rateLimitPerMinute: number
  keyId: string
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function validateApiKey(
  req: Request,
  requiredScope?: string
): Promise<ApiKeyContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiKeyAuthError('Missing or invalid Authorization header. Use: Authorization: Bearer nn_live_...', 401)
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey.startsWith('nn_live_')) {
    throw new ApiKeyAuthError('Invalid API key format. Keys must start with nn_live_', 401)
  }

  const keyHash = await sha256(rawKey)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { data: keyRecord, error } = await supabase
    .from('organization_api_keys')
    .select('id, organization_id, scopes, rate_limit_per_minute, expires_at, revoked_at, is_active')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !keyRecord) {
    throw new ApiKeyAuthError('Invalid or revoked API key', 401)
  }

  // Check expiry
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new ApiKeyAuthError('API key has expired', 401)
  }

  // Check scope
  if (requiredScope && !keyRecord.scopes.includes(requiredScope) && !keyRecord.scopes.includes('admin')) {
    throw new ApiKeyAuthError(`API key does not have required scope: ${requiredScope}`, 403)
  }

  // Update last_used_at (fire and forget — don't block the response)
  supabase
    .from('organization_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {})

  return {
    organizationId: keyRecord.organization_id,
    scopes: keyRecord.scopes,
    rateLimitPerMinute: keyRecord.rate_limit_per_minute,
    keyId: keyRecord.id,
  }
}

export class ApiKeyAuthError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message)
    this.name = 'ApiKeyAuthError'
  }
}

export const apiKeyCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}
