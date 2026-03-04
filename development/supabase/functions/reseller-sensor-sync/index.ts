// ============================================================
// Edge Function: reseller-sensor-sync
// Stories: #330 – Daily Sensor Sync & Heartbeat Validation
//          #331 – Tier Lock Grace Period
//
// Runs daily via Supabase cron at 02:00 UTC.
// Also called manually via POST /reseller-sensor-sync { action: 'manual' }
//
// Algorithm:
//   1. Find all reseller orgs
//   2. For each, calculate effective sensor count (recursive roll-up)
//   3. Determine tier based on count
//   4. If tier DROP detected → apply 30-day grace period lock
//   5. If grace expired → downgrade tier
//   6. If tier UPGRADE → apply immediately
//   7. Update reseller_sensor_counts cache
//   8. Log results to sensor_sync_log
// ============================================================

import { createServiceClient } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabase = createServiceClient()
  const runId = crypto.randomUUID()
  const startTime = Date.now()

  // Create initial sync log entry
  const { data: logEntry } = await supabase
    .from('sensor_sync_log')
    .insert({
      run_id:       runId,
      triggered_by: req.method === 'POST' ? 'manual' : 'cron',
      status:       'running',
    })
    .select('id')
    .single()

  const logId = logEntry?.id

  try {
    // 1. Load global settings
    const { data: settings } = await supabase
      .from('reseller_settings')
      .select('grace_period_days, heartbeat_window_hours')
      .single()

    const gracePeriodDays = settings?.grace_period_days ?? 30
    const heartbeatHours  = settings?.heartbeat_window_hours ?? 48

    // 2. Get all active reseller orgs
    const { data: resellers, error: resErr } = await supabase
      .from('organizations')
      .select('id, name, tier_locked_until, tier_lock_reason')
      .eq('is_reseller', true)
      .eq('is_active', true)

    if (resErr || !resellers) throw new Error(`Failed to fetch resellers: ${resErr?.message}`)

    // 3. Load all tiers
    const { data: tiers } = await supabase
      .from('reseller_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_sensors', { ascending: true })

    if (!tiers || tiers.length === 0) throw new Error('No active tiers configured')

    const tierForCount = (count: number) => {
      for (const t of tiers) {
        if (count >= t.min_sensors && (t.max_sensors === null || count <= t.max_sensors)) {
          return t
        }
      }
      // Default to lowest tier (Starter) when count is below all min_sensors
      return tiers[0]
    }

    const nextTierForCount = (count: number) => {
      const current = tierForCount(count)
      return tiers.find(t => t.min_sensors > (current.max_sensors ?? count)) ?? null
    }

    let orgsProcessed = 0
    let tierChanges   = 0

    for (const reseller of resellers) {
      try {
        // 4. Calculate effective sensor count
        const { data: counts } = await supabase
          .rpc('calculate_effective_sensor_count', { org_id: reseller.id })

        const sensorRow        = counts?.[0]
        const effectiveTotal   = sensorRow?.effective_total    ?? 0
        const directSensors    = sensorRow?.direct_sensors     ?? 0
        const downstreamSensors = sensorRow?.downstream_sensors ?? 0

        // 5. Determine new tier
        const newTier = tierForCount(effectiveTotal)
        const nextTier = tiers.find(t => t.min_sensors > effectiveTotal) ?? null

        // 6. Get existing cached tier
        const { data: existing } = await supabase
          .from('reseller_sensor_counts')
          .select('current_tier_id, effective_total')
          .eq('organization_id', reseller.id)
          .single()

        // 7. Handle tier transitions
        const now = new Date()
        const graceActive = reseller.tier_locked_until
          ? new Date(reseller.tier_locked_until) > now
          : false

        if (existing?.current_tier_id && existing.current_tier_id !== newTier.id) {
          // Get old tier details
          const { data: oldTier } = await supabase
            .from('reseller_tiers')
            .select('name, min_sensors, discount_pct')
            .eq('id', existing.current_tier_id)
            .single()

          const isTierDrop = oldTier && newTier.min_sensors < (oldTier.min_sensors ?? 0)

          if (isTierDrop) {
            if (!graceActive) {
              // Start grace period — keep current (old) tier, schedule downgrade
              const graceUntil = new Date(now.getTime() + gracePeriodDays * 24 * 60 * 60 * 1000)

              await supabase.from('organizations')
                .update({
                  tier_locked_until: graceUntil.toISOString(),
                  tier_lock_reason:  'sensor_count_drop',
                })
                .eq('id', reseller.id)

              // Notify reseller: grace started
              await supabase.from('reseller_grace_notifications').insert({
                organization_id:  reseller.id,
                notification_type: 'grace_started',
                tier_locked_until: graceUntil.toISOString(),
                old_tier:          oldTier?.name ?? null,
                new_tier:          newTier.name,
              })

              tierChanges++
            } else {
              // Grace still active — check if we should send 7-day or 1-day warning
              const daysLeft = Math.ceil(
                (new Date(reseller.tier_locked_until!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
              )

              if (daysLeft <= 1) {
                await supabase.from('reseller_grace_notifications').insert({
                  organization_id:   reseller.id,
                  notification_type: '1_day_remaining',
                  tier_locked_until: reseller.tier_locked_until,
                })
              } else if (daysLeft <= 7) {
                // Only insert once per day check (check if already sent this week)
                const { count } = await supabase
                  .from('reseller_grace_notifications')
                  .select('*', { count: 'exact', head: true })
                  .eq('organization_id', reseller.id)
                  .eq('notification_type', '7_days_remaining')
                  .gte('sent_at', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString())

                if (!count || count === 0) {
                  await supabase.from('reseller_grace_notifications').insert({
                    organization_id:   reseller.id,
                    notification_type: '7_days_remaining',
                    tier_locked_until: reseller.tier_locked_until,
                  })
                }
              }
            }
          } else if (!isTierDrop) {
            // Tier UPGRADE — apply immediately, clear any grace period
            await supabase.from('organizations')
              .update({ tier_locked_until: null, tier_lock_reason: null })
              .eq('id', reseller.id)

            await supabase.from('reseller_tier_history').insert({
              organization_id:  reseller.id,
              old_tier_id:      existing.current_tier_id,
              new_tier_id:      newTier.id,
              old_sensor_count: existing.effective_total,
              new_sensor_count: effectiveTotal,
              change_reason:    'daily_sync_upgrade',
            })

            tierChanges++
          }
        } else if (graceActive) {
          // Grace period: check if it's expired → downgrade now
          if (new Date(reseller.tier_locked_until!) <= now) {
            const newDowngradeTier = tierForCount(effectiveTotal)

            await supabase.from('organizations')
              .update({ tier_locked_until: null, tier_lock_reason: null })
              .eq('id', reseller.id)

            await supabase.from('reseller_tier_history').insert({
              organization_id:  reseller.id,
              old_tier_id:      existing?.current_tier_id ?? null,
              new_tier_id:      newDowngradeTier.id,
              old_sensor_count: existing?.effective_total ?? 0,
              new_sensor_count: effectiveTotal,
              change_reason:    'grace_expired',
            })

            await supabase.from('reseller_grace_notifications').insert({
              organization_id:   reseller.id,
              notification_type: 'tier_downgraded',
              new_tier:          newDowngradeTier.name,
            })

            tierChanges++
          }
        }

        // 8. Upsert sensor count cache
        await supabase.from('reseller_sensor_counts').upsert({
          organization_id:     reseller.id,
          direct_sensors:      directSensors,
          downstream_sensors:  downstreamSensors,
          effective_total:     effectiveTotal,
          current_tier_id:     newTier.id,
          next_tier_id:        nextTier?.id ?? null,
          sensors_to_next_tier: nextTier ? Math.max(0, nextTier.min_sensors - effectiveTotal) : 0,
          last_calculated_at:  now.toISOString(),
        }, { onConflict: 'organization_id' })

        orgsProcessed++
      } catch (orgErr) {
        console.error(`Error processing reseller ${reseller.id}:`, orgErr)
      }
    }

    const durationMs = Date.now() - startTime

    // 9. Update sync log
    await supabase.from('sensor_sync_log')
      .update({
        orgs_processed: orgsProcessed,
        tier_changes:   tierChanges,
        duration_ms:    durationMs,
        status:         'completed',
        completed_at:   new Date().toISOString(),
      })
      .eq('id', logId)

    return new Response(
      JSON.stringify({
        success:         true,
        run_id:          runId,
        orgs_processed:  orgsProcessed,
        tier_changes:    tierChanges,
        duration_ms:     durationMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('reseller-sensor-sync error:', err)

    await supabase.from('sensor_sync_log')
      .update({ status: 'failed', error_message: String(err), completed_at: new Date().toISOString() })
      .eq('id', logId)

    return new Response(
      JSON.stringify({ error: 'Sync failed', detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
