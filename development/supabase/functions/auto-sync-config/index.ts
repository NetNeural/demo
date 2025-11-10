import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const url = new URL(req.url)
    const params = new URLSearchParams(url.search)
    const integrationId = params.get('integration_id')
    const organizationId = params.get('organization_id')

    if (!integrationId || !organizationId) {
      throw new Error('Missing integration_id or organization_id')
    }

    // Verify user has access to organization
    const { data: orgUser, error: orgError } = await supabase
      .from('organization_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .single()

    if (orgError || !orgUser) {
      throw new Error('Unauthorized - not a member of this organization')
    }

    if (req.method === 'GET') {
      // Get auto-sync configuration
      const { data, error } = await supabase
        .from('auto_sync_schedules')
        .select('*')
        .eq('integration_id', integrationId)
        .single()

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = not found, which is OK for first-time setup
        throw error
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: data || {
            enabled: false,
            frequencyMinutes: 15,
            direction: 'bidirectional',
            conflictResolution: 'newest_wins',
            onlyOnline: true,
            timeWindowEnabled: false,
            deviceFilter: 'all',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'POST') {
      // Save auto-sync configuration
      const body = await req.json()
      const { config } = body

      const scheduleData = {
        integration_id: integrationId,
        organization_id: organizationId,
        enabled: config.enabled,
        frequency_minutes: config.frequencyMinutes,
        direction: config.direction,
        conflict_resolution: config.conflictResolution,
        only_online: config.onlyOnline,
        time_window_enabled: config.timeWindowEnabled,
        time_window_start: config.timeWindowStart,
        time_window_end: config.timeWindowEnd,
        device_filter: config.deviceFilter,
        device_tags: config.deviceTags,
        updated_by: user.id,
      }

      // Upsert the configuration
      const { data, error } = await supabase
        .from('auto_sync_schedules')
        .upsert(
          {
            ...scheduleData,
            created_by: user.id,
          },
          {
            onConflict: 'integration_id',
          }
        )
        .select()
        .single()

      if (error) {
        throw error
      }

      return new Response(
        JSON.stringify({
          success: true,
          data,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Auto-sync config error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
