import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AlertRule {
  id: string
  organization_id: string
  name: string
  description?: string
  rule_type: 'telemetry' | 'offline'
  condition: any
  device_scope: any
  actions: any[]
  enabled: boolean
  cooldown_minutes: number
  last_triggered_at?: string
}

interface Device {
  id: string
  name: string
  status: string
  last_seen_at?: string
  metadata?: any
  groups?: string[]
  tags?: string[]
}

interface TelemetryData {
  device_id: string
  metric: string
  value: number
  timestamp: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    console.log('[alert-rules-evaluator] Starting rule evaluation...')

    // Get all enabled rules
    const { data: rules, error: rulesError } = await supabaseClient
      .from('alert_rules')
      .select('*')
      .eq('enabled', true)

    if (rulesError) {
      console.error('[alert-rules-evaluator] Error fetching rules:', rulesError)
      return new Response(JSON.stringify({ error: rulesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[alert-rules-evaluator] Found ${rules?.length || 0} enabled rules`)

    const results = {
      evaluated: 0,
      triggered: 0,
      skipped: 0,
      errors: 0,
    }

    for (const rule of rules || []) {
      try {
        console.log(`[alert-rules-evaluator] Evaluating rule: ${rule.name} (${rule.rule_type})`)

        // Check cooldown period
        if (rule.last_triggered_at) {
          const lastTriggered = new Date(rule.last_triggered_at)
          const cooldownEnd = new Date(lastTriggered.getTime() + rule.cooldown_minutes * 60000)
          if (new Date() < cooldownEnd) {
            console.log(`[alert-rules-evaluator] Rule ${rule.name} in cooldown, skipping`)
            results.skipped++
            continue
          }
        }

        // Get devices in scope
        const devices = await getDevicesInScope(supabaseClient, rule)
        console.log(`[alert-rules-evaluator] Rule ${rule.name} applies to ${devices.length} devices`)

        if (devices.length === 0) {
          results.skipped++
          continue
        }

        // Evaluate rule based on type
        let triggeredDevices: Device[] = []

        if (rule.rule_type === 'telemetry') {
          triggeredDevices = await evaluateTelemetryRule(supabaseClient, rule, devices)
        } else if (rule.rule_type === 'offline') {
          triggeredDevices = await evaluateOfflineRule(supabaseClient, rule, devices)
        }

        console.log(`[alert-rules-evaluator] Rule ${rule.name} triggered for ${triggeredDevices.length} devices`)

        if (triggeredDevices.length > 0) {
          // Create alerts
          await createAlertsFromRule(supabaseClient, rule, triggeredDevices)

          // Execute actions
          await executeRuleActions(supabaseClient, rule, triggeredDevices)

          // Update last_triggered_at
          await supabaseClient
            .from('alert_rules')
            .update({ last_triggered_at: new Date().toISOString() })
            .eq('id', rule.id)

          results.triggered++
        }

        results.evaluated++
      } catch (error) {
        console.error(`[alert-rules-evaluator] Error evaluating rule ${rule.name}:`, error)
        results.errors++
      }
    }

    console.log('[alert-rules-evaluator] Evaluation complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[alert-rules-evaluator] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function getDevicesInScope(supabaseClient: any, rule: AlertRule): Promise<Device[]> {
  const { device_scope } = rule

  let query = supabaseClient
    .from('devices')
    .select('*')
    .eq('organization_id', rule.organization_id)

  if (device_scope.type === 'all') {
    // No additional filtering
  } else if (device_scope.type === 'groups') {
    query = query.contains('groups', device_scope.values)
  } else if (device_scope.type === 'tags') {
    query = query.contains('tags', device_scope.values)
  } else if (device_scope.type === 'specific') {
    query = query.in('id', device_scope.values)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getDevicesInScope] Error:', error)
    return []
  }

  return data || []
}

async function evaluateTelemetryRule(
  supabaseClient: any,
  rule: AlertRule,
  devices: Device[]
): Promise<Device[]> {
  const { condition } = rule
  const { metric, operator, value, duration_minutes } = condition

  const triggered: Device[] = []

  // Get recent telemetry for each device
  const timeWindow = new Date(Date.now() - (duration_minutes || 5) * 60000).toISOString()

  for (const device of devices) {
    const { data: telemetry, error } = await supabaseClient
      .from('device_telemetry')
      .select('*')
      .eq('device_id', device.id)
      .eq('metric', metric)
      .gte('timestamp', timeWindow)
      .order('timestamp', { ascending: false })

    if (error || !telemetry || telemetry.length === 0) {
      continue
    }

    // Check if condition is met
    const latestValue = telemetry[0].value
    let conditionMet = false

    switch (operator) {
      case '>':
        conditionMet = latestValue > value
        break
      case '>=':
        conditionMet = latestValue >= value
        break
      case '<':
        conditionMet = latestValue < value
        break
      case '<=':
        conditionMet = latestValue <= value
        break
      case '==':
        conditionMet = latestValue === value
        break
      case '!=':
        conditionMet = latestValue !== value
        break
    }

    if (conditionMet) {
      triggered.push(device)
    }
  }

  return triggered
}

async function evaluateOfflineRule(
  supabaseClient: any,
  rule: AlertRule,
  devices: Device[]
): Promise<Device[]> {
  const { condition } = rule
  const { offline_minutes, grace_period_hours } = condition

  const triggered: Device[] = []
  const offlineThreshold = new Date(Date.now() - offline_minutes * 60000)
  const gracePeriodEnd = grace_period_hours
    ? new Date(Date.now() - grace_period_hours * 3600000)
    : null

  for (const device of devices) {
    // Skip devices within grace period (newly added)
    if (gracePeriodEnd && device.created_at) {
      const createdAt = new Date(device.created_at)
      // Skip devices created AFTER gracePeriodEnd (still within grace period)
      // Example: gracePeriodEnd = 2 hours ago, device created 1 hour ago → skip
      if (createdAt > gracePeriodEnd) {
        continue
      }
    }

    // Check if device is offline
    if (device.last_seen_at) {
      const lastSeen = new Date(device.last_seen_at)
      if (lastSeen < offlineThreshold) {
        triggered.push(device)
      }
    } else if (device.status === 'offline') {
      triggered.push(device)
    }
  }

  return triggered
}

async function createAlertsFromRule(
  supabaseClient: any,
  rule: AlertRule,
  devices: Device[]
): Promise<void> {
  const alerts = devices.map((device) => {
    let title = ''
    let description = ''
    let category = 'system'

    if (rule.rule_type === 'telemetry') {
      const { metric, operator, value } = rule.condition
      title = `${rule.name}: ${device.name}`
      description = `${metric} ${operator} ${value} condition met`
      category = 'environmental'
    } else if (rule.rule_type === 'offline') {
      title = `Device Offline: ${device.name}`
      description = `Device has been offline for ${rule.condition.offline_minutes} minutes`
      category = 'connectivity'
    }

    return {
      organization_id: rule.organization_id,
      device_id: device.id,
      title,
      description,
      severity: rule.condition.value > 80 ? 'critical' : 'high',
      category,
      alert_type: rule.rule_type,
      source: 'rule',
      metadata: {
        rule_id: rule.id,
        rule_name: rule.name,
      },
    }
  })

  const { error } = await supabaseClient.from('alerts').insert(alerts)

  if (error) {
    console.error('[createAlertsFromRule] Error:', error)
  }
}

async function executeRuleActions(
  supabaseClient: any,
  rule: AlertRule,
  devices: Device[]
): Promise<void> {
  for (const action of rule.actions) {
    try {
      if (action.type === 'email') {
        console.log(`[executeRuleActions] Sending email to ${action.recipients?.join(', ')}`)
        // TODO: Integrate with email service
      } else if (action.type === 'sms') {
        console.log(`[executeRuleActions] Sending SMS to ${action.recipients?.join(', ')}`)
        // TODO: Integrate with SMS service
      } else if (action.type === 'webhook') {
        console.log(`[executeRuleActions] Calling webhook: ${action.webhook_url}`)
        
        const payload = {
          rule_id: rule.id,
          rule_name: rule.name,
          triggered_devices: devices.map((d) => ({
            id: d.id,
            name: d.name,
          })),
          timestamp: new Date().toISOString(),
        }

        await fetch(action.webhook_url!, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }
    } catch (error) {
      console.error(`[executeRuleActions] Error executing ${action.type} action:`, error)
    }
  }
}
