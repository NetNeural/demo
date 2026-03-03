// ============================================================
// Edge Function: calculate-billing-split
// Story: #329 – Spread Payout Logic & Automated Billing Splits
//        #332 – NetNeural Floor Price Enforcement
//
// POST /calculate-billing-split
// Body: { org_id: string, subscription_price: number, record?: boolean }
//
// Returns the full payout chain from selling org → root, with
// floor enforcement applied if aggregate discounts exceed the limit.
// ============================================================

import { createServiceClient } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

interface PayoutLevel {
  org_id:          string
  org_name:        string
  depth:           number
  tier_name:       string
  discount_pct:    number
  spread_pct:      number
  payout_amount:   number
  floor_applied:   boolean
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()
    const { org_id, subscription_price, record = false } = await req.json()

    if (!org_id || !subscription_price) {
      return new Response(
        JSON.stringify({ error: 'org_id and subscription_price are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Load global floor setting
    const { data: settings } = await supabase
      .from('reseller_settings')
      .select('floor_price_pct')
      .single()

    const floorPct = settings?.floor_price_pct ?? 0.50  // default 50%
    const netNeural_min_pct = 1 - floorPct               // min NetNeural keeps

    // 2. Walk up the reseller chain from the selling org to root
    //    collecting (org_id, name, discount_pct) at each level
    const chain: Array<{ org_id: string; org_name: string; discount_pct: number }> = []

    let currentOrgId: string | null = org_id
    const visited = new Set<string>()

    while (currentOrgId) {
      if (visited.has(currentOrgId)) break   // circular reference guard
      visited.add(currentOrgId)

      // Get org + its sensor count/tier
      const { data: org } = await supabase
        .from('organizations')
        .select('id, name, parent_organization_id, is_reseller')
        .eq('id', currentOrgId)
        .single()

      if (!org) break

      // Get tier discount for this org
      const { data: sensorCache } = await supabase
        .from('reseller_sensor_counts')
        .select('current_tier_id')
        .eq('organization_id', currentOrgId)
        .single()

      let discountPct = 0
      if (sensorCache?.current_tier_id) {
        const { data: tier } = await supabase
          .from('reseller_tiers')
          .select('discount_pct')
          .eq('id', sensorCache.current_tier_id)
          .single()
        discountPct = tier?.discount_pct ?? 0
      }

      chain.push({
        org_id:      org.id,
        org_name:    org.name,
        discount_pct: discountPct,
      })

      // If we've reached a non-reseller or there's no parent, stop
      if (!org.is_reseller || !org.parent_organization_id) break
      currentOrgId = org.parent_organization_id
    }

    // 3. Calculate spreads bottom-up
    //    Each level earns: own_discount% - child_discount%
    //    (Selling org = index 0, root reseller = last index)
    const payouts: PayoutLevel[] = []
    let totalSpreadPct = 0

    for (let i = 0; i < chain.length; i++) {
      const level = chain[i]
      const childDiscountPct = i === 0 ? 0 : chain[i - 1].discount_pct
      const spreadPct = Math.max(0, level.discount_pct - childDiscountPct)
      totalSpreadPct += spreadPct

      payouts.push({
        org_id:       level.org_id,
        org_name:     level.org_name,
        depth:        i,
        tier_name:    '',               // populated below
        discount_pct: level.discount_pct,
        spread_pct:   spreadPct,
        payout_amount: spreadPct * subscription_price,
        floor_applied: false,
      })
    }

    // 4. Floor price enforcement: if NetNeural would get < floor%, scale down
    const netNeuralPct = 1 - totalSpreadPct
    const floorViolated = netNeuralPct < netNeural_min_pct

    if (floorViolated && totalSpreadPct > 0) {
      const maxTotalSpread = floorPct  // max resellers can get in aggregate
      const scaleFactor = maxTotalSpread / totalSpreadPct

      for (const p of payouts) {
        p.spread_pct    = p.spread_pct * scaleFactor
        p.payout_amount = p.spread_pct * subscription_price
        p.floor_applied = true
      }

      // Log the violation
      await supabase.from('reseller_floor_violations').insert({
        chain_root_org_id:   chain[chain.length - 1]?.org_id ?? org_id,
        aggregate_discount:  totalSpreadPct,
        floor_pct:           floorPct,
        adjusted:            true,
      })
    }

    const totalPayouts = payouts.reduce((sum, p) => sum + p.payout_amount, 0)
    const netNeuralAmount = subscription_price - totalPayouts

    // 5. Record payout ledger entries if requested
    if (record) {
      const calcId = crypto.randomUUID()
      await supabase.from('reseller_commission_log').insert(
        payouts.map((p, i) => ({
          calculation_id:    calcId,
          selling_org_id:    org_id,
          reseller_org_id:   p.org_id,
          depth_in_chain:    p.depth,
          parent_discount:   p.discount_pct,
          child_discount:    i === 0 ? 0 : chain[i - 1].discount_pct,
          spread_pct:        p.spread_pct,
          subscription_price,
          payout_amount:     p.payout_amount,
          floor_applied:     p.floor_applied,
        }))
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          subscription_price,
          payouts,
          total_reseller_payout: totalPayouts,
          netneural_amount:      netNeuralAmount,
          netneural_pct:         netNeuralAmount / subscription_price,
          floor_violated:        floorViolated,
          floor_pct:             floorPct,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('calculate-billing-split error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
