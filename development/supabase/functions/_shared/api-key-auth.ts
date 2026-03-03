/**
 * API Key Authentication Middleware
 * Validates `Authorization: Bearer nn_live_...` tokens for the Customer Export API (#383)
 *
 * Flow:
 *  1. Extract raw key from Authorization header
 *  2. SHA-256 hash it
 *  3. Look up organization_api_keys by key_hash
 *  4. Validate: active, not revoked, not expired, scope check
 *  5. Enforce rate limit via sliding 60-second window (api_usage_log) (#389)
 *  6. Log request to api_usage_log (fire-and-forget)
 *  7. Update last_used_at (best-effort, non-blocking)
 *  8. Return org context for downstream handlers
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

export interface ApiKeyContext {
  organizationId: string
  scopes: string[]
  rateLimitPerMinute: number
  keyId: string
  remaining: number
  resetEpochSec: number
}

/**
 * Build X-RateLimit-* response headers from a validated key context.
 */
export function rateLimitHeaders(ctx: ApiKeyContext): Record<string, string> {
  return {
    'X-RateLimit-Limit':     String(ctx.rateLimitPerMinute),
    'X-RateLimit-Remaining': String(Math.max(0, ctx.remaining)),
    'X-RateLimit-Reset':     String(ctx.resetEpochSec),
    'X-RateLimit-Window':    '60',
  }
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

  // ── Rate limiting (#389) — sliding 60-second window ──────────────────────
  const limitPerMinute: number = keyRecord.rate_limit_per_minute || 60
  const windowStart = new Date(Date.now() - 60_000).toISOString()
  const resetEpochSec = Math.ceil((Date.now() + 60_000) / 1000)

  const { count: usedThisWindow } = await supabase
    .from('api_usage_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyRecord.id)
    .gte('created_at', windowStart)

  const used     = usedThisWindow ?? 0
  const remaining = limitPerMinute - used

  if (remaining <= 0) {
    throw new ApiKeyAuthError(
      `Rate limit exceeded. Limit: ${limitPerMinute} requests/minute. Retry after ${resetEpochSec}.`,
      429
    )
  }

  // Log usage fire-and-forget (non-blocking)
  const path = new URL(req.url).pathname
  const endpoint = path.split('/').filter(Boolean).pop() || 'unknown'
  supabase.from('api_usage_log').insert({
    api_key_id:      keyRecord.id,
    organization_id: keyRecord.organization_id,
    endpoint,
    status_code:     200,
  }).then(() => {})

  // Update last_used_at (fire and forget — don't block the response)
  supabase
    .from('organization_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {})

  return {
    organizationId:      keyRecord.organization_id,
    scopes:              keyRecord.scopes,
    rateLimitPerMinute:  limitPerMinute,
    keyId:               keyRecord.id,
    remaining,
    resetEpochSec,
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
