// ============================================================
// Edge Function: manage-reseller-tiers
// Platform Admin CRUD for reseller_tiers table
//
// GET    → list all tiers (sorted by sort_order)
// POST   → create new tier
// PATCH  → update existing tier
// DELETE → soft-delete (set is_active = false)
// ============================================================

import { createServiceClient } from '../_shared/auth.ts'
import { getUserContext } from '../_shared/auth.ts'
import { makeCorsHeaders } from '../_shared/cors.ts'

const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

let _corsHeaders: Record<string, string> = {}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ..._corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  const corsHeaders = makeCorsHeaders(req)
  _corsHeaders = corsHeaders
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authenticate — only super_admin or NetNeural org owner can manage tiers
    const userCtx = await getUserContext(req)
    const isNetNeuralOwner =
      userCtx.organizationId === NETNEURAL_ORG_ID &&
      (userCtx.role === 'org_owner' || userCtx.role === 'org_admin')

    if (!userCtx.isSuperAdmin && !isNetNeuralOwner) {
      return jsonResponse({ error: 'Forbidden — platform admin access required' }, 403)
    }

    const supabase = createServiceClient()

    // ─── GET: list all tiers ───────────────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('reseller_tiers')
        .select('*')
        .order('sort_order', { ascending: true })

      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true, tiers: data })
    }

    const body = await req.json()

    // ─── POST: create tier ─────────────────────────────────────────────
    if (req.method === 'POST') {
      const { name, min_sensors, max_sensors, discount_pct, sort_order } = body

      if (!name || min_sensors == null || discount_pct == null) {
        return jsonResponse({ error: 'name, min_sensors, and discount_pct are required' }, 400)
      }

      const { data, error } = await supabase
        .from('reseller_tiers')
        .insert({
          name,
          min_sensors,
          max_sensors: max_sensors ?? null,
          discount_pct,
          sort_order: sort_order ?? 99,
          is_active: true,
        })
        .select()
        .single()

      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true, tier: data }, 201)
    }

    // ─── PATCH: update tier ────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const { id, ...updates } = body
      if (!id) return jsonResponse({ error: 'id is required' }, 400)

      // Only allow safe fields
      const allowedFields = ['name', 'min_sensors', 'max_sensors', 'discount_pct', 'sort_order', 'is_active']
      const safeUpdates: Record<string, unknown> = {}
      for (const key of allowedFields) {
        if (key in updates) safeUpdates[key] = updates[key]
      }
      safeUpdates.updated_at = new Date().toISOString()

      const { data, error } = await supabase
        .from('reseller_tiers')
        .update(safeUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true, tier: data })
    }

    // ─── DELETE: deactivate tier ───────────────────────────────────────
    if (req.method === 'DELETE') {
      const { id } = body
      if (!id) return jsonResponse({ error: 'id is required' }, 400)

      const { data, error } = await supabase
        .from('reseller_tiers')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()

      if (error) return jsonResponse({ error: error.message }, 500)
      return jsonResponse({ success: true, tier: data })
    }

    return jsonResponse({ error: 'Method not allowed' }, 405)
  } catch (err) {
    console.error('manage-reseller-tiers error:', err)
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('Unauthorized') || message.includes('Forbidden')) {
      return jsonResponse({ error: message }, 401)
    }
    return jsonResponse({ error: 'Internal server error', detail: message }, 500)
  }
})
