import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface AlertRule {
  id?: string
  organization_id: string
  name: string
  description?: string
  rule_type: 'telemetry' | 'offline'
  condition: {
    metric?: string
    operator?: string
    value?: number
    duration_minutes?: number
    offline_minutes?: number
    grace_period_hours?: number
  }
  device_scope: {
    type: 'all' | 'groups' | 'tags' | 'specific'
    values?: string[]
  }
  actions: Array<{
    type: 'email' | 'sms' | 'webhook'
    recipients?: string[]
    webhook_url?: string
    message_template?: string
  }>
  enabled: boolean
  cooldown_minutes: number
  created_by: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const ruleId = pathSegments[pathSegments.length - 1]

    // GET /alert-rules - List all rules for organization
    if (req.method === 'GET' && !ruleId) {
      const organizationId = url.searchParams.get('organization_id')
      const ruleType = url.searchParams.get('rule_type')
      const enabled = url.searchParams.get('enabled')

      if (!organizationId) {
        return new Response(
          JSON.stringify({ error: 'organization_id is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      let query = supabaseClient
        .from('alert_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })

      if (ruleType) {
        query = query.eq('rule_type', ruleType)
      }

      if (enabled !== null && enabled !== undefined) {
        query = query.eq('enabled', enabled === 'true')
      }

      const { data, error } = await query

      if (error) {
        console.error('[alert-rules] List error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // GET /alert-rules/:id - Get single rule
    if (req.method === 'GET' && ruleId && ruleId !== 'alert-rules') {
      const { data, error } = await supabaseClient
        .from('alert_rules')
        .select('*')
        .eq('id', ruleId)
        .single()

      if (error) {
        console.error('[alert-rules] Get error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /alert-rules - Create new rule
    if (req.method === 'POST') {
      const body: AlertRule = await req.json()

      // Validation
      if (!body.organization_id || !body.name || !body.rule_type) {
        return new Response(
          JSON.stringify({
            error: 'organization_id, name, and rule_type are required',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      if (!body.actions || body.actions.length === 0) {
        return new Response(
          JSON.stringify({ error: 'At least one action is required' }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        )
      }

      // Validate rule_type specific fields
      if (body.rule_type === 'telemetry') {
        if (
          !body.condition.metric ||
          !body.condition.operator ||
          body.condition.value === undefined
        ) {
          return new Response(
            JSON.stringify({
              error: 'Telemetry rules require metric, operator, and value',
            }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      } else if (body.rule_type === 'offline') {
        if (!body.condition.offline_minutes) {
          return new Response(
            JSON.stringify({ error: 'Offline rules require offline_minutes' }),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          )
        }
      }

      const { data, error } = await supabaseClient
        .from('alert_rules')
        .insert({
          ...body,
          created_by: user.id,
          enabled: body.enabled ?? true,
          cooldown_minutes: body.cooldown_minutes ?? 60,
        })
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Create error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PUT /alert-rules/:id - Update rule
    if (req.method === 'PUT' && ruleId) {
      const body: Partial<AlertRule> = await req.json()

      // Remove fields that shouldn't be updated
      delete body.id
      delete body.created_by
      delete body.organization_id

      const { data, error } = await supabaseClient
        .from('alert_rules')
        .update({
          ...body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ruleId)
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Update error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // DELETE /alert-rules/:id - Delete rule
    if (req.method === 'DELETE' && ruleId) {
      const { error } = await supabaseClient
        .from('alert_rules')
        .delete()
        .eq('id', ruleId)

      if (error) {
        console.error('[alert-rules] Delete error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PATCH /alert-rules/:id/toggle - Toggle enabled status
    if (req.method === 'PATCH' && ruleId && url.pathname.includes('/toggle')) {
      const { enabled } = await req.json()

      const { data, error } = await supabaseClient
        .from('alert_rules')
        .update({ enabled, updated_at: new Date().toISOString() })
        .eq('id', ruleId)
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Toggle error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // POST /alert-rules/:id/duplicate - Duplicate rule
    if (
      req.method === 'POST' &&
      ruleId &&
      url.pathname.includes('/duplicate')
    ) {
      const { data: original, error: fetchError } = await supabaseClient
        .from('alert_rules')
        .select('*')
        .eq('id', ruleId)
        .single()

      if (fetchError) {
        return new Response(JSON.stringify({ error: 'Rule not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await supabaseClient
        .from('alert_rules')
        .insert({
          ...original,
          id: undefined,
          name: `${original.name} (Copy)`,
          created_by: user.id,
          created_at: undefined,
          updated_at: undefined,
        })
        .select()
        .single()

      if (error) {
        console.error('[alert-rules] Duplicate error:', error)
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({ success: true, data }), {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[alert-rules] Unexpected error:', error)
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
