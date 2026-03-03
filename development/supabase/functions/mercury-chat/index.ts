// ============================================================================
// MERCURY CHAT — NetNeural AI Support Assistant (Epic #359)
// ============================================================================
// GPT-4o-mini powered chatbot with duty system, ticket creation, and
// cross-org access request integration.
//
// Actions (all POST with JSON body { action, ...params }):
//   get_status    — duty admin count, user's open session
//   get_messages  — messages for a session (pass sessionId)
//   chat          — send user message, get Mercury AI response
//   create_ticket — escalate to a support ticket
//   clock_in      — super admin: start duty shift
//   clock_out     — super admin: end duty shift
//   list_tickets  — user's support tickets
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MERCURY_SYSTEM_PROMPT = `You are Mercury, the AI support assistant for NetNeural — an enterprise IoT monitoring and management platform.

You help users with:
- Device management: adding sensors, configuring device types, troubleshooting connectivity
- Alert system: creating alert rules, managing thresholds, snooze and escalation
- Organization management: multi-tenant setup, member roles (owner/admin/member), sub-organizations
- Integrations: Golioth IoT cloud, MQTT brokers, Slack notifications, email/SMS alerts
- Billing: subscription plans, usage metering, Stripe portal access
- Hydra reseller program: sensor-tiered reseller tiers (Starter/Growth/Professional/Enterprise), commission payouts, partner invitations
- Reports: executive summaries, daily reports, assessment reports
- User accounts: password changes, MFA setup, profile management

Personality: Professional, concise, and helpful. You are named after the Roman messenger god — fast and reliable.

Rules:
- Respond in plain conversational text, no markdown or bullet points
- Keep responses under 150 words unless a detailed explanation is needed
- If you cannot resolve an issue, say: "I'm not able to fully resolve this one. I recommend creating a support ticket so a NetNeural engineer can assist you directly."
- Never make up feature details you're unsure about
- Do not answer questions unrelated to NetNeural`

function ok(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function err(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: { message } }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // ─── Auth ────────────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return err('Unauthorized', 401)

  const supabaseUrl  = Deno.env.get('SUPABASE_URL')!
  const serviceKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const openaiKey    = Deno.env.get('OPENAI_API_KEY')
  const anonKey      = Deno.env.get('SUPABASE_ANON_KEY')!

  // Verify JWT and get user
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return err('Unauthorized', 401)

  // Service-role client for DB operations
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if user is super admin
  const { data: profile } = await db
    .from('users')
    .select('is_super_admin, organization_id, full_name')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = profile?.is_super_admin === true
  const orgId = profile?.organization_id || null
  const displayName = profile?.full_name || user.email?.split('@')[0] || 'User'

  // ─── Parse action ────────────────────────────────────────────────
  let body: Record<string, any> = {}
  try { body = await req.json() } catch { /* defaults */ }
  const action = body.action || 'get_status'

  // ─── get_status ──────────────────────────────────────────────────
  if (action === 'get_status') {
    // Count admins currently on duty
    const { count: dutyCount } = await db
      .from('admin_support_shifts')
      .select('*', { count: 'exact', head: true })
      .is('clocked_out_at', null)

    // Get user's most recent active session
    const { data: session } = await db
      .from('support_chat_sessions')
      .select('id, status, created_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Open ticket count for user
    const { count: openTickets } = await db
      .from('support_tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['open', 'in_progress'])

    return ok({
      duty_admins_online: dutyCount ?? 0,
      active_session: session || null,
      open_ticket_count: openTickets ?? 0,
      is_super_admin: isSuperAdmin,
      user_name: displayName,
    })
  }

  // ─── get_messages ────────────────────────────────────────────────
  if (action === 'get_messages') {
    const { sessionId } = body
    if (!sessionId) return err('sessionId required')

    // Verify session belongs to user (or super admin can see all)
    const { data: session } = await db
      .from('support_chat_sessions')
      .select('user_id')
      .eq('id', sessionId)
      .single()

    if (!session) return err('Session not found', 404)
    if (!isSuperAdmin && session.user_id !== user.id) return err('Forbidden', 403)

    const { data: messages } = await db
      .from('support_chat_messages')
      .select('id, sender_type, sender_id, content, metadata, created_at')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    return ok({ messages: messages || [] })
  }

  // ─── chat ────────────────────────────────────────────────────────
  if (action === 'chat') {
    const { message, sessionId: existingSessionId } = body
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return err('message required')
    }
    const userMessage = message.trim().slice(0, 2000)

    // Get or create session
    let sessionId = existingSessionId
    if (!sessionId) {
      const { data: newSession, error: sessionErr } = await db
        .from('support_chat_sessions')
        .insert({ user_id: user.id, organization_id: orgId, status: 'active' })
        .select('id')
        .single()
      if (sessionErr) return err('Failed to create session')
      sessionId = newSession.id
    }

    // Insert user message
    await db.from('support_chat_messages').insert({
      session_id: sessionId,
      sender_type: 'user',
      sender_id: user.id,
      content: userMessage,
    })

    // Build conversation history for context (last 10 messages)
    const { data: history } = await db
      .from('support_chat_messages')
      .select('sender_type, content')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(11) // includes the one we just inserted

    const historyMessages = (history || [])
      .reverse()
      .slice(0, 10) // keep last 10
      .map((m: any) => ({
        role: m.sender_type === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))

    // Call OpenAI
    let mercuryResponse = ''
    if (openaiKey) {
      try {
        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: MERCURY_SYSTEM_PROMPT },
              ...historyMessages,
            ],
            temperature: 0.7,
            max_tokens: 400,
          }),
        })
        if (aiRes.ok) {
          const aiData = await aiRes.json()
          mercuryResponse = aiData.choices?.[0]?.message?.content?.trim() || ''
        } else {
          console.warn('[mercury-chat] OpenAI error:', aiRes.status, await aiRes.text())
        }
      } catch (e) {
        console.warn('[mercury-chat] OpenAI fetch error:', (e as Error).message)
      }
    }

    // Fallback if AI unavailable
    if (!mercuryResponse) {
      mercuryResponse = "I'm having trouble connecting to my AI engine right now. You can still create a support ticket and a NetNeural engineer will respond as soon as possible."
    }

    // Insert Mercury response
    const { data: mercuryMsg } = await db
      .from('support_chat_messages')
      .insert({
        session_id: sessionId,
        sender_type: 'mercury',
        content: mercuryResponse,
      })
      .select('id, created_at')
      .single()

    // Touch session updated_at
    await db.from('support_chat_sessions').update({ updated_at: new Date().toISOString() }).eq('id', sessionId)

    return ok({
      session_id: sessionId,
      user_message: { sender_type: 'user', content: userMessage },
      mercury_message: { id: mercuryMsg?.id, sender_type: 'mercury', content: mercuryResponse, created_at: mercuryMsg?.created_at },
    })
  }

  // ─── create_ticket ────────────────────────────────────────────────
  if (action === 'create_ticket') {
    const { subject, description, priority = 'normal', sessionId } = body
    if (!subject || !description) return err('subject and description required')

    const { data: ticket, error: ticketErr } = await db
      .from('support_tickets')
      .insert({
        session_id: sessionId || null,
        user_id: user.id,
        organization_id: orgId,
        subject: subject.trim().slice(0, 200),
        description: description.trim().slice(0, 5000),
        priority,
        status: 'open',
      })
      .select('id, status, created_at')
      .single()

    if (ticketErr) return err('Failed to create ticket')

    // Mark session as escalated if associated
    if (sessionId) {
      await db.from('support_chat_sessions').update({ status: 'escalated' }).eq('id', sessionId)

      // Insert system message in the chat
      await db.from('support_chat_messages').insert({
        session_id: sessionId,
        sender_type: 'system',
        content: `Support ticket #${ticket.id.slice(0, 8).toUpperCase()} created. A NetNeural engineer will review your issue and respond via email.`,
        metadata: { ticket_id: ticket.id },
      })
    }

    return ok({ ticket })
  }

  // ─── clock_in ─────────────────────────────────────────────────────
  if (action === 'clock_in') {
    if (!isSuperAdmin) return err('Super admin required', 403)

    // End any existing open shift for this admin
    await db
      .from('admin_support_shifts')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('admin_user_id', user.id)
      .is('clocked_out_at', null)

    const { data: shift } = await db
      .from('admin_support_shifts')
      .insert({ admin_user_id: user.id })
      .select('id, clocked_in_at')
      .single()

    return ok({ shift, message: `${displayName} is now on support duty` })
  }

  // ─── clock_out ────────────────────────────────────────────────────
  if (action === 'clock_out') {
    if (!isSuperAdmin) return err('Super admin required', 403)

    const { data: shift } = await db
      .from('admin_support_shifts')
      .update({ clocked_out_at: new Date().toISOString() })
      .eq('admin_user_id', user.id)
      .is('clocked_out_at', null)
      .select('id, clocked_in_at, clocked_out_at')
      .single()

    return ok({ shift, message: `${displayName} clocked out of support duty` })
  }

  // ─── list_tickets ─────────────────────────────────────────────────
  if (action === 'list_tickets') {
    let query = db
      .from('support_tickets')
      .select('id, subject, status, priority, created_at, updated_at, resolved_at')
      .order('created_at', { ascending: false })
      .limit(20)

    if (!isSuperAdmin) {
      query = query.eq('user_id', user.id)
    }

    const { data: tickets } = await query
    return ok({ tickets: tickets || [] })
  }

  return err(`Unknown action: ${action}`)
})
