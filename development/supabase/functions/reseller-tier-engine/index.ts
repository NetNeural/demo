// ============================================================
// Edge Function: reseller-tier-engine
// Story: #328 – Global Tier Table & Dynamic Margin Engine
//
// GET  /reseller-tier-engine?org_id=xxx
//   → { current_tier, discount_pct, sensors_to_next_tier, next_tier_name,
//       effective_total, direct_sensors, downstream_sensors, grace_active,
//       tier_locked_until }
//
// POST /reseller-tier-engine { action: 'recalculate', org_id }
//   → recalculates + updates reseller_sensor_counts
// ============================================================

import { createServiceClient } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()
    const url = new URL(req.url)

    const orgId = req.method === 'GET'
      ? url.searchParams.get('org_id')
      : (await req.json()).org_id

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'org_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch org meta (grace period columns)
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .select('id, name, slug, is_reseller, tier_locked_until, tier_lock_reason, subscription_tier')
      .eq('id', orgId)
      .single()

    if (orgErr || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get effective sensor count via DB function
    const { data: counts, error: countErr } = await supabase
      .rpc('calculate_effective_sensor_count', { org_id: orgId })

    if (countErr) {
      console.error('Sensor count error:', countErr)
    }

    const sensorRow = counts?.[0]
    const effectiveTotal   = sensorRow?.effective_total    ?? 0
    const directSensors    = sensorRow?.direct_sensors     ?? 0
    const downstreamSensors = sensorRow?.downstream_sensors ?? 0

    // 3. Load all active tiers sorted by min_sensors asc
    const { data: tiers } = await supabase
      .from('reseller_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_sensors', { ascending: true })

    if (!tiers || tiers.length === 0) {
      return new Response(JSON.stringify({ error: 'No tiers configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Determine current tier by effective sensor count
    let currentTier = tiers[0]
    let nextTier: typeof tiers[0] | null = tiers[1] ?? null
    let matched = false

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i]
      const inRange = effectiveTotal >= t.min_sensors && (t.max_sensors === null || effectiveTotal <= t.max_sensors)
      if (inRange) {
        currentTier = t
        nextTier = tiers[i + 1] ?? null
        matched = true
        break
      }
    }

    // If no tier matched (e.g. 0 sensors below Starter min), default to Starter
    if (!matched) {
      currentTier = tiers[0]
      nextTier = tiers[1] ?? null
    }

    // 5. Grace period check — if tier_locked_until is in future, use the locked tier
    const graceActive = org.tier_locked_until
      ? new Date(org.tier_locked_until) > new Date()
      : false

    const sensorsToNext = nextTier
      ? Math.max(0, nextTier.min_sensors - effectiveTotal)
      : 0

    // 6. Update cached sensor counts table
    await supabase
      .from('reseller_sensor_counts')
      .upsert({
        organization_id:    orgId,
        direct_sensors:     directSensors,
        downstream_sensors: downstreamSensors,
        effective_total:    effectiveTotal,
        current_tier_id:    currentTier.id,
        next_tier_id:       nextTier?.id ?? null,
        sensors_to_next_tier: sensorsToNext,
        last_calculated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id' })

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          org_id:              orgId,
          org_name:            org.name,
          current_tier:        currentTier.name,
          current_tier_id:     currentTier.id,
          discount_pct:        currentTier.discount_pct,
          effective_total:     effectiveTotal,
          direct_sensors:      directSensors,
          downstream_sensors:  downstreamSensors,
          sensors_to_next_tier: sensorsToNext,
          next_tier_name:      nextTier?.name ?? null,
          next_tier_discount:  nextTier?.discount_pct ?? null,
          grace_active:        graceActive,
          tier_locked_until:   org.tier_locked_until ?? null,
          tier_lock_reason:    org.tier_lock_reason ?? null,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('reseller-tier-engine error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error', detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
