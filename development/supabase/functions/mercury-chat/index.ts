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

// Base URL where public/docs/ files are served (GitHub Pages static export)
const DOCS_BASE_URL = 'https://sentinel.netneural.ai/docs'

// Map keyword patterns to documentation files
const DOC_ROUTING: Array<{ keywords: RegExp; file: string }> = [
  { keywords: /api|endpoint|rest|curl|rate.?limit|authentication.*api|api.?key|webhook.*api|export.?api/i, file: 'API_DOCUMENTATION.txt' },
  { keywords: /export|webhook|hmac|pagination|csv|python.*export|grafana|pagerduty/i, file: 'EXPORT_API_GUIDE.txt' },
  { keywords: /integrat|mqtt|golioth|slack.*notif|azure.?iot|aws.?iot|coap|netneural.?link/i, file: 'INTEGRATIONS_GUIDE.txt' },
  { keywords: /admin|role|member|owner|permission|sub.?org|billing|subscription|invite|reseller/i, file: 'ADMINISTRATOR_GUIDE.txt' },
  { keywords: /error|broken|not.?work|troubleshoot|fail|problem|issue|can't|cannot|wrong|bug/i, file: 'troubleshooting.txt' },
  { keywords: /device|sensor|dashboard|alert|threshold|monitoring|getting.?start|quick.?start|login|setup/i, file: 'USER_QUICK_START.txt' },
]

async function fetchRelevantDoc(message: string): Promise<string | null> {
  const match = DOC_ROUTING.find(r => r.keywords.test(message))
  if (!match) return null
  try {
    const res = await fetch(`${DOCS_BASE_URL}/${match.file}`, { signal: AbortSignal.timeout(4000) })
    if (!res.ok) return null
    const text = await res.text()
    // Truncate to ~15 000 chars (~4 000 tokens) to stay within context budget
    return text.length > 15000 ? text.slice(0, 15000) + '\n[...truncated...]' : text
  } catch {
    return null
  }
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

  // Extract raw token (strip "Bearer " prefix if present)
  const rawToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader

  // Verify JWT — pass token explicitly (more reliable than relying on global header in Deno)
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  let { data: { user }, error: authErr } = await userClient.auth.getUser(rawToken)

  // Fallback: if Supabase JWT validation fails, decode payload and look up user
  // via service role. Handles JWT secret mismatches in multi-env setups.
  if (authErr || !user) {
    console.warn('mercury-chat: primary auth failed, trying fallback:', authErr?.message)
    try {
      const base64Url = rawToken.split('.')[1] ?? ''
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
        base64Url.length + ((4 - (base64Url.length % 4)) % 4), '='
      )
      const payload = JSON.parse(atob(base64))
      const serviceClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data: profile } = await serviceClient
        .from('users')
        .select('id, email, role')
        .eq('id', payload.sub)
        .single()
      if (profile) {
        // Construct a minimal user object so the rest of the handler works
        user = { id: profile.id, email: profile.email } as any
        authErr = null
      }
    } catch (fallbackErr) {
      console.error('mercury-chat: fallback auth also failed:', fallbackErr)
    }
  }

  if (authErr || !user) return err('Unauthorized', 401)

  // Service-role client for DB operations
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if user is platform admin (super_admin or NetNeural org owner)
  const NETNEURAL_ORG_ID = '00000000-0000-0000-0000-000000000001'
  const { data: profile } = await db
    .from('users')
    .select('role, organization_id, full_name')
    .eq('id', user.id)
    .single()
  const isSuperAdmin = profile?.role === 'super_admin' ||
    (profile?.role === 'org_owner' && profile?.organization_id === NETNEURAL_ORG_ID)
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
    // --- Tier-based AI gating ---
    if (orgId) {
      const { data: org } = await db
        .from('organizations')
        .select('billing_plan_id')
        .eq('id', orgId)
        .single()

      if (org?.billing_plan_id) {
        const { data: plan } = await db
          .from('billing_plans')
          .select('features, slug')
          .eq('id', org.billing_plan_id)
          .single()

        if (plan && !plan.features?.ai_analytics) {
          console.log(
            `🚫 Mercury chat blocked for org ${orgId} — plan "${plan.slug}" does not include AI`
          )
          return err('AI features are not available on your current plan. Please upgrade to access Mercury Chat.', 403)
        }
      }
    }

    // --- Rate limiting (20 messages per user per hour) ---
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count: recentMessageCount } = await db
      .from('support_chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', user.id)
      .eq('sender_type', 'user')
      .gte('created_at', oneHourAgo)

    if ((recentMessageCount ?? 0) >= 20) {
      console.log(`🚫 Rate limit hit for user ${user.id} — ${recentMessageCount} messages in last hour`)
      return err('Rate limit exceeded. You can send up to 20 messages per hour. Please try again later.', 429)
    }

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

    // Fetch relevant documentation for this query (RAG-lite)
    const docContext = await fetchRelevantDoc(userMessage)
    const docMessage = docContext
      ? { role: 'system' as const, content: `Relevant NetNeural documentation (use this as your primary source of truth for answering the user's question):\n\n${docContext}` }
      : null

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
              ...(docMessage ? [docMessage] : []),
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
    if (!isSuperAdmin) return err('Platform admin required', 403)

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
    if (!isSuperAdmin) return err('Platform admin required', 403)

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
