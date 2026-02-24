import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { corsHeaders } from '../_shared/cors.ts'
import { getUserContext, createAuthenticatedClient, createServiceClient } from '../_shared/auth.ts'

interface AcknowledgeAlertRequest {
  alert_id: string
  acknowledgement_type?:
    | 'acknowledged'
    | 'dismissed'
    | 'resolved'
    | 'false_positive'
  notes?: string
}

interface RecordActionRequest {
  action_type: string
  action_category:
    | 'device_management'
    | 'integration_management'
    | 'alert_management'
    | 'sync_operation'
    | 'configuration'
    | 'authentication'
    | 'analytics_view'
    | 'other'
  description?: string
  device_id?: string
  integration_id?: string
  alert_id?: string
  alert_rule_id?: string
  metadata?: Record<string, unknown>
  success?: boolean
  error_message?: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authenticated user context
    const userContext = await getUserContext(req)

    // Create authenticated Supabase client
    const supabaseClient = createAuthenticatedClient(req)

    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    // Route based on action
    if (action === 'acknowledge_alert') {
      return await handleAcknowledgeAlert(
        req,
        supabaseClient,
        userContext.userId
      )
    } else if (action === 'record_action') {
      return await handleRecordAction(req, supabaseClient, userContext.userId)
    } else if (action === 'get_alert_acknowledgements') {
      return await handleGetAlertAcknowledgements(req, supabaseClient)
    } else if (action === 'get_user_actions') {
      return await handleGetUserActions(req, supabaseClient)
    } else {
      throw new Error('Invalid action parameter')
    }
  } catch (error) {
    console.error('[User Actions] Error:', error)
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

async function handleAcknowledgeAlert(
  req: Request,
  supabase: SupabaseClient,
  userId: string
) {
  const body: AcknowledgeAlertRequest = await req.json()

  if (!body.alert_id) {
    throw new Error('Missing alert_id')
  }

  // Call database function to acknowledge alert
  const { data, error } = await supabase.rpc('acknowledge_alert', {
    p_alert_id: body.alert_id,
    p_user_id: userId,
    p_acknowledgement_type: body.acknowledgement_type || 'acknowledged',
    p_notes: body.notes || null,
  })

  if (error) {
    console.error('[Acknowledge Alert] Database error:', error)
    throw new Error(`Failed to acknowledge alert: ${error.message}`)
  }

  // Belt-and-suspenders: also directly mark alert as resolved
  // This ensures is_resolved is set even if the DB function is outdated
  try {
    const serviceClient = createServiceClient()
    await serviceClient
      .from('alerts')
      .update({
        is_resolved: true,
        resolved_by: userId,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', body.alert_id)
  } catch (resolveErr) {
    console.warn('[Acknowledge Alert] Fallback resolve failed:', resolveErr)
    // Non-fatal: the RPC function should have handled this
  }

  return new Response(
    JSON.stringify({
      success: true,
      acknowledgement_id: data,
      message: 'Alert acknowledged successfully',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function handleRecordAction(
  req: Request,
  supabase: SupabaseClient,
  userId: string
) {
  const body: RecordActionRequest = await req.json()

  if (!body.action_type || !body.action_category) {
    throw new Error('Missing required fields: action_type, action_category')
  }

  // Check if user is super_admin (can act without org membership)
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()
  const isSuperAdmin = userProfile?.role === 'super_admin'

  // Get user's organization
  const { data: orgMember, error: orgError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (!isSuperAdmin && (orgError || !orgMember)) {
    throw new Error('User not associated with organization')
  }

  // Call database function to record action
  const { data, error } = await supabase.rpc('record_user_action', {
    p_user_id: userId,
    p_organization_id: orgMember?.organization_id || null,
    p_action_type: body.action_type,
    p_action_category: body.action_category,
    p_description: body.description || null,
    p_device_id: body.device_id || null,
    p_integration_id: body.integration_id || null,
    p_alert_id: body.alert_id || null,
    p_alert_rule_id: body.alert_rule_id || null,
    p_metadata: body.metadata || {},
    p_success: body.success !== false,
    p_error_message: body.error_message || null,
  })

  if (error) {
    console.error('[Record Action] Database error:', error)
    throw new Error(`Failed to record action: ${error.message}`)
  }

  return new Response(
    JSON.stringify({
      success: true,
      action_id: data,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

async function handleGetAlertAcknowledgements(
  req: Request,
  supabase: SupabaseClient
) {
  const url = new URL(req.url)
  const alertId = url.searchParams.get('alert_id')
  const organizationId = url.searchParams.get('organization_id')

  let query = supabase
    .from('alert_acknowledgements')
    .select(
      `
      *,
      user:user_id (
        id,
        email
      ),
      alert:alert_id (
        id,
        title,
        severity
      )
    `
    )
    .order('acknowledged_at', { ascending: false })

  if (alertId) {
    query = query.eq('alert_id', alertId)
  }

  if (organizationId) {
    query = query.eq('organization_id', organizationId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Get Acknowledgements] Database error:', error)
    throw new Error(`Failed to fetch acknowledgements: ${error.message}`)
  }

  return new Response(JSON.stringify({ acknowledgements: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleGetUserActions(req: Request, supabase: SupabaseClient) {
  const url = new URL(req.url)
  const deviceId = url.searchParams.get('device_id')
  const userId = url.searchParams.get('user_id')
  const actionCategory = url.searchParams.get('action_category')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  let query = supabase
    .from('user_actions')
    .select(
      `
      *,
      user:user_id (
        id,
        email
      )
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (deviceId) {
    query = query.eq('device_id', deviceId)
  }

  if (userId) {
    query = query.eq('user_id', userId)
  }

  if (actionCategory) {
    query = query.eq('action_category', actionCategory)
  }

  const { data, error } = await query

  if (error) {
    console.error('[Get User Actions] Database error:', error)
    throw new Error(`Failed to fetch user actions: ${error.message}`)
  }

  return new Response(JSON.stringify({ actions: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
