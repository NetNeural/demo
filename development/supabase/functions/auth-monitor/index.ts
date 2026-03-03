// ===========================================================================
// Edge Function: auth-monitor
// ===========================================================================
// SOC 2 CC7.2 — Failed login anomaly detection and alerting.
//
// Called via:
//   1. Supabase Auth Hook webhook (LOGIN / LOGIN_FAILURE events)
//   2. Internal POST from admin UI for manual unlock
//
// POST body variants:
//   { event: 'LOGIN',         email, ip_address?, user_agent? }
//   { event: 'LOGIN_FAILURE', email, ip_address?, user_agent?, reason? }
//   { event: 'UNLOCK',        email }           ← super_admin only
//   { event: 'LIST_ATTEMPTS', email? }           ← super_admin only
// ===========================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FAILURE_WINDOW_MINUTES = 10
const MAX_FAILURES_BEFORE_LOCKOUT = 5
const LOCKOUT_DURATION_MINUTES = 30

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function ok(data: unknown) {
  return new Response(JSON.stringify({ data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // For admin events (UNLOCK, LIST_ATTEMPTS), require authenticated super_admin
  const authHeader = req.headers.get('Authorization')

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return err('Invalid JSON body')
  }

  const { event, email, ip_address, user_agent, reason } = body

  // ── ADMIN-ONLY EVENTS ──────────────────────────────────────────────────────
  if (event === 'UNLOCK' || event === 'LIST_ATTEMPTS') {
    if (!authHeader) return err('Unauthorized', 401)

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return err('Unauthorized', 401)

    const { data: profile } = await serviceClient
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') return err('Forbidden', 403)

    if (event === 'LIST_ATTEMPTS') {
      const query = serviceClient
        .from('login_attempts')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(200)
      if (email) (query as ReturnType<typeof serviceClient.from>).eq('user_email', email)

      const { data: attempts } = await query
      const { data: lockouts } = await serviceClient
        .from('account_lockouts')
        .select('*')
        .order('locked_at', { ascending: false })
        .limit(50)

      return ok({ attempts: attempts ?? [], lockouts: lockouts ?? [] })
    }

    if (event === 'UNLOCK') {
      if (!email) return err('email required for UNLOCK')
      const { error: unlockErr } = await serviceClient
        .from('account_lockouts')
        .update({ unlocked_at: new Date().toISOString(), unlocked_by: user.id })
        .eq('user_email', email)
        .is('unlocked_at', null)

      if (unlockErr) return err('Failed to unlock account', 500)

      await serviceClient.from('user_audit_log').insert({
        user_id: user.id,
        user_email: user.email ?? '',
        action_category: 'auth',
        action_type: 'account_unlocked',
        resource_type: 'account_lockout',
        resource_name: email,
        method: 'POST',
        endpoint: '/auth-monitor',
        status: 'success',
        changes: { unlocked_email: email },
      })

      return ok({ message: `Account ${email} unlocked` })
    }
  }

  // ── AUTH WEBHOOK EVENTS ────────────────────────────────────────────────────
  if (!email) return err('email is required')

  if (event === 'LOGIN') {
    // Successful login — record attempt
    await serviceClient.from('login_attempts').insert({
      user_email: email,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      success: true,
    })
    return ok({ status: 'recorded' })
  }

  if (event === 'LOGIN_FAILURE') {
    // Record failure
    await serviceClient.from('login_attempts').insert({
      user_email: email,
      ip_address: ip_address ?? null,
      user_agent: user_agent ?? null,
      success: false,
      failure_reason: reason ?? 'invalid_credentials',
    })

    // Count recent failures
    const { data: failCount } = await serviceClient.rpc('count_recent_failures', {
      p_email: email,
      p_minutes: FAILURE_WINDOW_MINUTES,
    })

    const failures = (failCount as number) ?? 0
    console.log(`[auth-monitor] ${email} has ${failures} failures in last ${FAILURE_WINDOW_MINUTES}m`)

    if (failures >= MAX_FAILURES_BEFORE_LOCKOUT) {
      // Check if already locked
      const { data: alreadyLocked } = await serviceClient.rpc('is_account_locked', {
        p_email: email,
      })

      if (!alreadyLocked) {
        const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000)

        await serviceClient.from('account_lockouts').insert({
          user_email: email,
          locked_until: lockedUntil.toISOString(),
          reason: 'too_many_failures',
          attempt_count: failures,
        })

        // Alert super_admins
        const { data: superAdmins } = await serviceClient
          .from('users')
          .select('id, email')
          .eq('role', 'super_admin')

        if (superAdmins && superAdmins.length > 0) {
          console.log(
            `[auth-monitor] LOCKOUT: ${email} locked until ${lockedUntil.toISOString()}. Alerting ${superAdmins.length} super_admins.`
          )
          // Dispatch alert via existing notification infrastructure
          try {
            const notifyUrl = `${supabaseUrl}/functions/v1/send-alert-notifications`
            await fetch(notifyUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                type: 'security_lockout',
                subject: `[NetNeural Security] Account locked: ${email}`,
                message: `Account ${email} has been temporarily locked due to ${failures} failed login attempts in ${FAILURE_WINDOW_MINUTES} minutes. Locked until ${lockedUntil.toUTCString()}.\n\nIP: ${ip_address ?? 'unknown'}\nUser Agent: ${user_agent ?? 'unknown'}`,
                recipient_emails: superAdmins.map((a: { email: string }) => a.email),
              }),
            })
          } catch (notifyErr) {
            console.error('[auth-monitor] Failed to send lockout notification:', notifyErr)
          }
        }
      }
    }

    return ok({ status: 'recorded', failures })
  }

  return err(`Unknown event: ${event}`)
})
