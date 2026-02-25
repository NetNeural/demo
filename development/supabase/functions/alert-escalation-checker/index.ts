import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

/**
 * Alert Escalation Checker
 * 
 * Runs on pg_cron (every 5 minutes). Checks for unacknowledged alerts
 * that have exceeded their escalation window and sends escalation
 * notifications to designated recipients.
 * 
 * Flow:
 * 1. Fetch all enabled escalation rules
 * 2. For each rule, find unacknowledged alerts matching severity
 *    that have been open longer than escalation_delay_minutes
 * 3. Check if escalation was already sent (via alert_events)
 * 4. Send escalation notification
 * 5. Record 'escalated' event in timeline
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('[alert-escalation-checker] Starting escalation check...')

    // Fetch all enabled escalation rules with their org info
    const { data: rules, error: rulesError } = await supabase
      .from('alert_escalation_rules')
      .select('*, organizations!organization_id(name)')
      .eq('enabled', true)

    if (rulesError) {
      console.error('[alert-escalation-checker] Error fetching rules:', rulesError)
      return new Response(JSON.stringify({ error: rulesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!rules || rules.length === 0) {
      console.log('[alert-escalation-checker] No enabled escalation rules found')
      return new Response(JSON.stringify({ success: true, escalated: 0, message: 'No rules' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[alert-escalation-checker] Found ${rules.length} enabled rules`)

    const results = {
      checked: 0,
      escalated: 0,
      skipped: 0,
      errors: 0,
    }

    for (const rule of rules) {
      try {
        results.checked++

        // Calculate the cutoff time: alerts created before this time need escalation
        const cutoffTime = new Date(
          Date.now() - rule.escalation_delay_minutes * 60 * 1000
        ).toISOString()

        // Find unacknowledged alerts matching this rule's severity and org
        // that were created before the cutoff AND are not snoozed
        const { data: alerts, error: alertsError } = await supabase
          .from('alerts')
          .select('id, title, message, severity, device_id, created_at, alert_number, devices!device_id(name)')
          .eq('organization_id', rule.organization_id)
          .eq('severity', rule.severity)
          .eq('is_resolved', false)
          .lt('created_at', cutoffTime)
          .or('snoozed_until.is.null,snoozed_until.lt.' + new Date().toISOString())

        if (alertsError) {
          console.error(`[alert-escalation-checker] Error fetching alerts for rule ${rule.id}:`, alertsError)
          results.errors++
          continue
        }

        if (!alerts || alerts.length === 0) {
          results.skipped++
          continue
        }

        // For each alert, check if escalation was already sent
        for (const alert of alerts) {
          // Check if an 'escalated' event already exists for this alert
          const { data: existingEscalation } = await supabase
            .from('alert_events')
            .select('id')
            .eq('alert_id', alert.id)
            .eq('event_type', 'escalated')
            .limit(1)

          if (existingEscalation && existingEscalation.length > 0) {
            // Already escalated, skip
            continue
          }

          // Determine escalation recipients
          let recipientUserIds = rule.escalate_to_user_ids || []
          let recipientEmails = rule.escalate_to_emails || []

          // If no specific escalation targets, fall back to org admins/owners
          if (recipientUserIds.length === 0 && recipientEmails.length === 0) {
            const { data: admins } = await supabase
              .from('organization_members')
              .select('user_id')
              .eq('organization_id', rule.organization_id)
              .in('role', ['owner', 'admin'])

            recipientUserIds = admins?.map((m: { user_id: string }) => m.user_id) || []
          }

          if (recipientUserIds.length === 0 && recipientEmails.length === 0) {
            console.log(`[alert-escalation-checker] No escalation recipients for rule ${rule.id}`)
            continue
          }

          const alertNum = alert.alert_number ? `ALT-${alert.alert_number}` : alert.id.slice(0, 8)
          const device = (alert as any).devices as { name: string } | null
          const deviceName = device?.name || 'Unknown Device'
          const minutesOpen = Math.round((Date.now() - new Date(alert.created_at).getTime()) / 60000)

          console.log(
            `[alert-escalation-checker] ESCALATING ${alertNum} — ${alert.severity} alert open ${minutesOpen}min (threshold: ${rule.escalation_delay_minutes}min)`
          )

          // Temporarily update alert for escalation notification
          const originalTitle = alert.title
          const originalMessage = alert.message
          const originalSeverity = alert.severity

          await supabase
            .from('alerts')
            .update({
              title: `🔺 ESCALATION: ${alertNum} — ${originalTitle}`,
              message: `⏰ This ${originalSeverity.toUpperCase()} alert has been unacknowledged for ${minutesOpen} minutes (escalation threshold: ${rule.escalation_delay_minutes}min).\n\nDevice: ${deviceName}\nOriginal: ${originalMessage}`,
            })
            .eq('id', alert.id)

          // Send escalation notification
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

          try {
            await fetch(`${supabaseUrl}/functions/v1/send-alert-notifications`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                alert_id: alert.id,
                channels: rule.notification_channels || ['email'],
                recipient_user_ids: recipientUserIds,
                recipient_emails: recipientEmails,
              }),
            })
          } catch (notifErr) {
            console.error(`[alert-escalation-checker] Notification send failed:`, notifErr)
          }

          // Restore original alert fields
          await supabase
            .from('alerts')
            .update({
              title: originalTitle,
              message: originalMessage,
            })
            .eq('id', alert.id)

          // Record 'escalated' event in timeline
          await supabase
            .from('alert_events')
            .insert({
              alert_id: alert.id,
              event_type: 'escalated',
              metadata: {
                escalation_rule_id: rule.id,
                delay_minutes: rule.escalation_delay_minutes,
                minutes_open: minutesOpen,
                recipient_count: recipientUserIds.length + recipientEmails.length,
              },
            })

          results.escalated++
        }
      } catch (ruleError) {
        console.error(`[alert-escalation-checker] Error processing rule ${rule.id}:`, ruleError)
        results.errors++
      }
    }

    console.log('[alert-escalation-checker] Complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[alert-escalation-checker] Unexpected error:', error)
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
