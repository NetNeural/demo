// API Keys Edge Function - Organization API Key Management (#321)
// Enterprise-tier feature: CRUD for org-scoped API keys
import {
  createEdgeFunction,
  createSuccessResponse,
} from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getUserContext } from '../_shared/auth.ts'

// Generate a secure random API key with prefix
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let key = 'nn_live_'
  const array = new Uint8Array(40)
  crypto.getRandomValues(array)
  for (let i = 0; i < 40; i++) {
    key += chars[array[i] % chars.length]
  }
  return key
}

// Hash an API key using SHA-256
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export default createEdgeFunction(
  async ({ req }) => {
    const userContext = await getUserContext(req)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const organizationId = url.searchParams.get('organization_id')
    const method = req.method

    if (!organizationId) {
      throw new Error('organization_id parameter is required')
    }

    // Check if user is super_admin
    const isSuperAdmin = userContext.role === 'super_admin'
    let userRole = 'viewer'

    if (isSuperAdmin) {
      userRole = 'owner'
    } else {
      const { data: membership } = await supabaseAdmin
        .from('organization_members')
        .select('role')
        .eq('organization_id', organizationId)
        .eq('user_id', userContext.userId)
        .maybeSingle()

      if (!membership || !['owner', 'admin'].includes(membership.role)) {
        return new Response(
          JSON.stringify({ error: 'Admin or owner access required' }),
          { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      }
      userRole = membership.role
    }

    // --- Tier check: Verify org has api_access feature ---
    const { data: org } = await supabaseAdmin
      .from('organizations')
      .select('billing_plan_id')
      .eq('id', organizationId)
      .single()

    if (org?.billing_plan_id) {
      const { data: plan } = await supabaseAdmin
        .from('billing_plans')
        .select('features, slug')
        .eq('id', org.billing_plan_id)
        .single()

      if (plan && !plan.features?.api_access) {
        return new Response(
          JSON.stringify({
            error: 'API key management requires Professional or Enterprise plan',
            upgrade_required: true,
          }),
          { status: 403, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
        )
      }
    }

    console.log('🔑 API Keys endpoint:', { method, organizationId, userId: userContext.userId })

    // --- GET: List API keys ---
    if (method === 'GET') {
      const { data: keys, error } = await supabaseAdmin
        .from('organization_api_keys')
        .select('id, name, key_prefix, scopes, rate_limit_per_minute, is_active, last_used_at, expires_at, created_at, revoked_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (error) throw new Error(`Failed to fetch API keys: ${error.message}`)
      return createSuccessResponse(keys)
    }

    // --- POST: Create new API key ---
    if (method === 'POST') {
      const body = await req.json()
      const { name, scopes = ['read'], expires_in_days } = body

      if (!name || name.trim().length === 0) {
        throw new Error('API key name is required')
      }

      // Count existing active keys (limit to 10 per org)
      const { count } = await supabaseAdmin
        .from('organization_api_keys')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .is('revoked_at', null)

      if ((count ?? 0) >= 10) {
        throw new Error('Maximum of 10 active API keys per organization')
      }

      // Generate key
      const rawKey = generateApiKey()
      const keyPrefix = rawKey.substring(0, 12) // "nn_live_XXXX"
      const keyHash = await hashApiKey(rawKey)

      // Determine rate limit based on tier
      let rateLimit = 60 // Professional default
      if (org?.billing_plan_id) {
        const { data: plan } = await supabaseAdmin
          .from('billing_plans')
          .select('slug')
          .eq('id', org.billing_plan_id)
          .single()
        if (plan?.slug === 'enterprise') {
          rateLimit = -1 // Unlimited for Enterprise
        }
      }

      const expiresAt = expires_in_days
        ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
        : null

      const { data: newKey, error } = await supabaseAdmin
        .from('organization_api_keys')
        .insert({
          organization_id: organizationId,
          name: name.trim(),
          key_prefix: keyPrefix,
          key_hash: keyHash,
          scopes,
          rate_limit_per_minute: rateLimit,
          expires_at: expiresAt,
          created_by: userContext.userId,
        })
        .select('id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at')
        .single()

      if (error) throw new Error(`Failed to create API key: ${error.message}`)

      console.log(`✅ Created API key "${name}" for org ${organizationId}`)

      // Return the full key ONCE (never stored in plaintext)
      return createSuccessResponse({
        ...newKey,
        key: rawKey, // Only returned on creation
        warning: 'Store this key securely. It will not be shown again.',
      })
    }

    // --- DELETE: Revoke an API key ---
    if (method === 'DELETE') {
      const keyId = url.searchParams.get('key_id')
      if (!keyId) throw new Error('key_id parameter is required')

      const { error } = await supabaseAdmin
        .from('organization_api_keys')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
        })
        .eq('id', keyId)
        .eq('organization_id', organizationId)

      if (error) throw new Error(`Failed to revoke API key: ${error.message}`)

      console.log(`🗑️ Revoked API key ${keyId} for org ${organizationId}`)
      return createSuccessResponse({ revoked: true })
    }

    throw new Error(`Method ${method} not supported`)
  }
)
