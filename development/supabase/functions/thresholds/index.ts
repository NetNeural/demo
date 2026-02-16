import { createEdgeFunction, createSuccessResponse, DatabaseError } from '../_shared/request-handler.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { getUserContext } from '../_shared/auth.ts'

export default createEdgeFunction(async ({ req }) => {
  const userContext = await getUserContext(req)
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  const url = new URL(req.url)
  const deviceId = url.searchParams.get('device_id')
  const thresholdId = url.searchParams.get('threshold_id')
  const method = req.method

  console.log('🎯 Thresholds API called:', {
    method,
    device_id: deviceId,
    threshold_id: thresholdId,
    userId: userContext.userId,
  })

  // GET - List thresholds for a device
  if (method === 'GET' && deviceId) {
    const { data: thresholds, error } = await supabaseAdmin
      .from('sensor_thresholds')
      .select('*')
      .eq('device_id', deviceId)
      .order('sensor_type', { ascending: true })

    if (error) {
      throw new DatabaseError(`Failed to fetch thresholds: ${error.message}`)
    }

    return createSuccessResponse({ thresholds })
  }

  // POST - Create new threshold
  if (method === 'POST') {
    const body = await req.json()
    const {
      device_id,
      sensor_type,
      min_value,
      max_value,
      critical_min,
      critical_max,
      temperature_unit = 'celsius',
      alert_enabled = true,
      alert_severity = 'medium',
      alert_message,
      notify_on_breach = true,
      notification_cooldown_minutes = 15,
      notify_user_ids = [],
      notify_emails = [],
      notification_channels = [],
    } = body

    if (!device_id || !sensor_type) {
      throw new Error('device_id and sensor_type are required')
    }

    // Check if threshold already exists for this device+sensor_type
    const { data: existing } = await supabaseAdmin
      .from('sensor_thresholds')
      .select('id')
      .eq('device_id', device_id)
      .eq('sensor_type', sensor_type)
      .maybeSingle()

    if (existing) {
      throw new Error(`Threshold for ${sensor_type} already exists on this device`)
    }

    const { data: threshold, error } = await supabaseAdmin
      .from('sensor_thresholds')
      .insert({
        device_id,
        sensor_type,
        min_value,
        max_value,
        critical_min,
        critical_max,
        temperature_unit,
        alert_enabled,
        alert_severity,
        alert_message,
        notify_on_breach,
        notification_cooldown_minutes,
        notify_user_ids,
        notify_emails,
        notification_channels,
        created_by: userContext.userId,
        updated_by: userContext.userId,
      })
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Failed to create threshold: ${error.message}`)
    }

    return createSuccessResponse({ threshold })
  }

  // PATCH - Update existing threshold
  if (method === 'PATCH' && thresholdId) {
    const body = await req.json()
    const {
      min_value,
      max_value,
      critical_min,
      critical_max,
      temperature_unit,
      alert_enabled,
      alert_severity,
      alert_message,
      notify_on_breach,
      notification_cooldown_minutes,
      notify_user_ids,
      notify_emails,
      notification_channels,
    } = body

    const { data: threshold, error } = await supabaseAdmin
      .from('sensor_thresholds')
      .update({
        min_value,
        max_value,
        critical_min,
        critical_max,
        temperature_unit,
        alert_enabled,
        alert_severity,
        alert_message,
        notify_on_breach,
        notification_cooldown_minutes,
        notify_user_ids,
        notify_emails,
        notification_channels,
        updated_by: userContext.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', thresholdId)
      .select()
      .single()

    if (error) {
      throw new DatabaseError(`Failed to update threshold: ${error.message}`)
    }

    return createSuccessResponse({ threshold })
  }

  // DELETE - Remove threshold
  if (method === 'DELETE' && thresholdId) {
    const { error } = await supabaseAdmin
      .from('sensor_thresholds')
      .delete()
      .eq('id', thresholdId)

    if (error) {
      throw new DatabaseError(`Failed to delete threshold: ${error.message}`)
    }

    return createSuccessResponse({ message: 'Threshold deleted successfully' })
  }

  throw new Error('Invalid request parameters')
})
