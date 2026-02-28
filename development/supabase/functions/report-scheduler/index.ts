// ============================================================================
// REPORT SCHEDULER — Checks schedules and invokes due reports
// ============================================================================
// Called periodically (e.g. every 15 minutes via pg_cron or external trigger).
// Reads the report_schedules table, checks if any reports are due,
// and invokes the appropriate edge functions.
//
// Endpoints:
//   POST /report-scheduler            — Check & run due reports
//   POST /report-scheduler?dry=true   — Check without running (returns what would run)
//
// Environment:
//   SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const url = new URL(req.url)
    const isDryRun = url.searchParams.get('dry') === 'true'

    // Fetch all enabled schedules with a frequency set
    const { data: schedules, error: schedErr } = await supabase
      .from('report_schedules')
      .select('*')
      .eq('is_enabled', true)
      .neq('frequency', 'none')

    if (schedErr) throw schedErr
    if (!schedules || schedules.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active schedules', ran: [] }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const now = new Date()
    const nowUTC = {
      hour: now.getUTCHours(),
      minute: now.getUTCMinutes(),
      dayOfWeek: now.getUTCDay(),
      dayOfMonth: now.getUTCDate(),
    }

    const dueReports: string[] = []
    const results: Array<{ report: string; status: string; detail?: string }> =
      []

    for (const schedule of schedules) {
      // Parse scheduled time
      const [schedHour, schedMinute] = (schedule.time_utc || '12:00:00')
        .split(':')
        .map(Number)

      // Check if within the 15-minute window
      const minutesSinceMidnight = nowUTC.hour * 60 + nowUTC.minute
      const schedMinutesSinceMidnight = schedHour * 60 + schedMinute
      const diff = minutesSinceMidnight - schedMinutesSinceMidnight

      // Only run if within 0-14 minute window past the scheduled time
      if (diff < 0 || diff >= 15) continue

      // Check if already ran today (within last 23 hours to handle timezone edge cases)
      if (schedule.last_run_at) {
        const lastRun = new Date(schedule.last_run_at)
        const hoursSinceLastRun =
          (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60)
        if (hoursSinceLastRun < 23) continue
      }

      // Check frequency-specific conditions
      let shouldRun = false
      switch (schedule.frequency) {
        case 'daily':
          shouldRun = true
          break
        case 'weekly':
          shouldRun = nowUTC.dayOfWeek === (schedule.day_of_week ?? 1)
          break
        case 'monthly':
          shouldRun = nowUTC.dayOfMonth === (schedule.day_of_month ?? 1)
          break
      }

      if (shouldRun) {
        dueReports.push(schedule.report_type)

        if (!isDryRun) {
          // Log the run
          const { data: runRow } = await supabase
            .from('report_runs')
            .insert({
              report_type: schedule.report_type,
              status: 'running',
              triggered_by: 'scheduler',
            })
            .select('id')
            .single()

          const startTime = Date.now()

          try {
            // Invoke the report edge function
            const resp = await fetch(
              `${supabaseUrl}/functions/v1/${schedule.report_type}`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${serviceKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  recipients:
                    schedule.recipients?.length > 0
                      ? schedule.recipients
                      : undefined,
                }),
              }
            )

            const durationMs = Date.now() - startTime

            if (!resp.ok) {
              const errText = await resp.text()
              throw new Error(`HTTP ${resp.status}: ${errText}`)
            }

            // Update run log
            if (runRow?.id) {
              await supabase
                .from('report_runs')
                .update({ status: 'success', duration_ms: durationMs })
                .eq('id', runRow.id)
            }

            // Update schedule last_run_at
            await supabase
              .from('report_schedules')
              .update({ last_run_at: now.toISOString() })
              .eq('id', schedule.id)

            results.push({
              report: schedule.report_type,
              status: 'success',
              detail: `${durationMs}ms`,
            })
          } catch (err) {
            const durationMs = Date.now() - startTime
            const msg = err instanceof Error ? err.message : String(err)

            if (runRow?.id) {
              await supabase
                .from('report_runs')
                .update({
                  status: 'error',
                  duration_ms: durationMs,
                  error_message: msg,
                })
                .eq('id', runRow.id)
            }

            results.push({
              report: schedule.report_type,
              status: 'error',
              detail: msg,
            })
          }
        } else {
          results.push({
            report: schedule.report_type,
            status: 'would-run (dry)',
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        checked_at: now.toISOString(),
        schedules_checked: schedules.length,
        due: dueReports,
        results,
        dry_run: isDryRun,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
