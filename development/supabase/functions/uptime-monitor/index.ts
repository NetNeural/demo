// ===========================================================================
// Edge Function: uptime-monitor
// ===========================================================================
// SOC 2 A1.1 — Availability monitoring
//
// POST   { results: UptimeCheckResult[] }  — called by GitHub Actions workflow
//         authenticated with SUPABASE_SERVICE_ROLE_KEY in Authorization header
//         Inserts results into uptime_checks table; alerts on new downtime
//
// GET    — returns current status per service (last check per service)
//          authenticated: platform admin (super_admin or NetNeural org owner)
// ===========================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface UptimeCheckResult {
  service: string
  url: string
  status: 'up' | 'down' | 'degraded'
  http_code?: number
  response_ms?: number
  error_msg?: string
  checked_at?: string
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const authHeader = req.headers.get('Authorization') ?? ''

  // ── POST: record check results (service-role auth from GH Actions) ─────────
  if (req.method === 'POST') {
    // Accept service role key directly
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    if (token !== serviceKey) {
      // Also accept super_admin user token
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: { user }, error } = await userClient.auth.getUser()
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: profile } = await serviceClient
        .from('users')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()
      const isPlAdmin = profile?.role === 'super_admin' ||
        (profile?.role === 'org_owner' && profile?.organization_id === NETNEURAL_ORG_ID)
      if (!isPlAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let body: { results: UptimeCheckResult[] }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { results } = body
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(JSON.stringify({ error: 'results array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Insert check results
    const rows = results.map((r) => ({
      service: r.service,
      url: r.url,
      status: r.status,
      http_code: r.http_code ?? null,
      response_ms: r.response_ms ?? null,
      error_msg: r.error_msg ?? null,
      checked_at: r.checked_at ?? new Date().toISOString(),
    }))

    const { error: insertErr } = await serviceClient.from('uptime_checks').insert(rows)
    if (insertErr) {
      console.error('[uptime-monitor] insert error:', insertErr)
      return new Response(JSON.stringify({ error: 'Failed to store results' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Alert on downtime — check for newly-down services
    const downServices = results.filter((r) => r.status === 'down')
    if (downServices.length > 0) {
      console.log('[uptime-monitor] DOWNTIME detected:', downServices.map((s) => s.service).join(', '))

      // Get super_admin emails for notification
      const { data: admins } = await serviceClient
        .from('users')
        .select('email')
        .eq('role', 'super_admin')

      if (admins && admins.length > 0) {
        const serviceList = downServices
          .map((s) => `  - ${s.service} (${s.url}) — ${s.error_msg ?? `HTTP ${s.http_code}`}`)
          .join('\n')
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-alert-notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              type: 'downtime_alert',
              subject: `[NetNeural] Service downtime detected (${downServices.length} service${downServices.length > 1 ? 's' : ''})`,
              message: `The following services are reporting downtime:\n\n${serviceList}\n\nChecked at: ${new Date().toUTCString()}`,
              recipient_emails: admins.map((a: { email: string }) => a.email),
            }),
          })
        } catch (notifyErr) {
          console.error('[uptime-monitor] Failed to send downtime notification:', notifyErr)
        }
      }
    }

    // Cleanup old checks
    await serviceClient.rpc('cleanup_old_uptime_checks').catch(() => {})

    return new Response(
      JSON.stringify({ stored: rows.length, down: downServices.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ── GET: return current status (super_admin authenticated) ─────────────────
  if (req.method === 'GET') {
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profile } = await serviceClient.from('users').select('role, organization_id').eq('id', user.id).single()
    const isPlAdmin = profile?.role === 'super_admin' ||
      (profile?.role === 'org_owner' && profile?.organization_id === NETNEURAL_ORG_ID)
    if (!isPlAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Latest 200 checks across all services
    const { data: checks } = await serviceClient
      .from('uptime_checks')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(200)

    return new Response(JSON.stringify({ data: { checks: checks ?? [] } }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
