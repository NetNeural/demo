import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SensorThreshold {
  id: string
  device_id: string
  sensor_type: string
  min_value?: number
  max_value?: number
  critical_min?: number
  critical_max?: number
  alert_enabled: boolean
  notify_on_breach: boolean
  notify_user_ids?: string[]
  notify_emails?: string[]
  notification_channels?: string[]
  last_notification_at?: string
}

interface Device {
  id: string
  name: string
  organization_id: string
}

interface TelemetryReading {
  device_id: string
  telemetry: {
    type: number
    value: number
    units?: number
  }
  device_timestamp: string
  received_at: string
}

// Sensor type to name mapping
const SENSOR_TYPE_NAMES: Record<number, string> = {
  1: 'Temperature',
  2: 'Humidity',
  3: 'Pressure',
  4: 'Battery',
  7: 'CO2',
  8: 'TVOC',
  9: 'Light',
  10: 'Motion',
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

    console.log('[sensor-threshold-evaluator] Starting threshold evaluation...')

    // Get all enabled sensor thresholds
    const { data: thresholds, error: thresholdsError } = await supabaseClient
      .from('sensor_thresholds')
      .select(`
        *,
        devices!sensor_thresholds_device_id_fkey (
          id,
          name,
          organization_id
        )
      `)
      .eq('alert_enabled', true)
      .eq('notify_on_breach', true)

    if (thresholdsError) {
      console.error('[sensor-threshold-evaluator] Error fetching thresholds:', thresholdsError)
      return new Response(JSON.stringify({ error: thresholdsError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`[sensor-threshold-evaluator] Found ${thresholds?.length || 0} enabled thresholds`)

    const results = {
      evaluated: 0,
      triggered: 0,
      skipped: 0,
      errors: 0,
    }

    // Process each threshold
    for (const threshold of thresholds || []) {
      try {
        const device = (threshold.devices as unknown) as Device

        console.log(`[sensor-threshold-evaluator] Evaluating threshold for device: ${device.name}, sensor: ${threshold.sensor_type}`)

        // Get most recent telemetry reading for this device and sensor type
        const { data: readings, error: readingsError } = await supabaseClient
          .from('telemetry_data')
          .select('*')
          .eq('device_id', threshold.device_id)
          .eq('telemetry->>type', threshold.sensor_type)
          .order('received_at', { ascending: false })
          .limit(1)

        if (readingsError) {
          console.error(`[sensor-threshold-evaluator] Error fetching readings:`, readingsError)
          results.errors++
          continue
        }

        if (!readings || readings.length === 0) {
          console.log(`[sensor-threshold-evaluator] No recent readings for device ${device.name}`)
          results.skipped++
          continue
        }

        const reading = readings[0] as TelemetryReading
        const value = reading.telemetry.value

        // Check if value breaches thresholds
        let breachType: 'critical_max' | 'critical_min' | 'max' | 'min' | null = null
        let breachMessage = ''

        // Check critical thresholds first
        if (threshold.critical_max != null && value >= threshold.critical_max) {
          breachType = 'critical_max'
          breachMessage = `Critical maximum threshold exceeded: ${value} >= ${threshold.critical_max}`
        } else if (threshold.critical_min != null && value <= threshold.critical_min) {
          breachType = 'critical_min'
          breachMessage = `Critical minimum threshold breached: ${value} <= ${threshold.critical_min}`
        } else if (threshold.max_value != null && value > threshold.max_value) {
          breachType = 'max'
          breachMessage = `Maximum threshold exceeded: ${value} > ${threshold.max_value}`
        } else if (threshold.min_value != null && value < threshold.min_value) {
          breachType = 'min'
          breachMessage = `Minimum threshold breached: ${value} < ${threshold.min_value}`
        }

        if (breachType) {
          console.log(`[sensor-threshold-evaluator] BREACH DETECTED: ${breachMessage}`)

          // Create alert
          const sensorName = SENSOR_TYPE_NAMES[parseInt(threshold.sensor_type)] || `Sensor ${threshold.sensor_type}`
          const severity = (breachType === 'critical_max' || breachType === 'critical_min') ? 'critical' : 'high'
          
          const { error: alertError } = await supabaseClient
            .from('alerts')
            .insert({
              organization_id: device.organization_id,
              device_id: device.id,
              title: `${sensorName} ${severity === 'critical' ? 'Critical' : 'Threshold'} Alert`,
              message: `${device.name}: ${breachMessage}`,
              severity: severity,
              category: sensorName.toLowerCase(),
              is_resolved: false,
              metadata: {
                sensor_type: threshold.sensor_type,
                sensor_name: sensorName,
                current_value: value,
                threshold_id: threshold.id,
                breach_type: breachType,
                min_value: threshold.min_value,
                max_value: threshold.max_value,
                critical_min: threshold.critical_min,
                critical_max: threshold.critical_max,
              }
            })

          if (alertError) {
            console.error(`[sensor-threshold-evaluator] Error creating alert:`, alertError)
            results.errors++
            continue
          }

          // Send notifications (email, SMS, etc.)
          if (threshold.notify_user_ids && threshold.notify_user_ids.length > 0) {
            console.log(`[sensor-threshold-evaluator] Would notify ${threshold.notify_user_ids.length} users`)
            // TODO: Implement email sending via Resend
            // TODO: Implement SMS sending
          }

          if (threshold.notify_emails && threshold.notify_emails.length > 0) {
            console.log(`[sensor-threshold-evaluator] Would notify ${threshold.notify_emails.length} email addresses`)
            // TODO: Implement email sending via Resend
          }

          // Update last_notification_at
          await supabaseClient
            .from('sensor_thresholds')
            .update({ last_notification_at: new Date().toISOString() })
            .eq('id', threshold.id)

          results.triggered++
        }

        results.evaluated++
      } catch (error) {
        console.error(`[sensor-threshold-evaluator] Error evaluating threshold:`, error)
        results.errors++
      }
    }

    console.log('[sensor-threshold-evaluator] Evaluation complete:', results)

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[sensor-threshold-evaluator] Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
