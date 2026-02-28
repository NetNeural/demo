// Email Broadcast Edge Function — Platform-wide email communications
// Super admin only: sends emails to all users filtered by subscription tier
// Supports: announcements, maintenance notices, newsletters, platform updates
// Also provides AI-powered email drafting via OpenAI

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface BroadcastRequest {
  subject: string
  html: string
  text?: string
  email_type: 'announcement' | 'maintenance' | 'newsletter' | 'update'
  target_tiers: string[] // ['all'] or ['starter', 'professional', 'enterprise']
}

interface AIDraftRequest {
  email_type: 'announcement' | 'maintenance' | 'newsletter' | 'update'
  topic: string
  key_points?: string
  tone?: 'formal' | 'friendly' | 'urgent'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Authenticate requesting user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    // Verify super admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Super admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'send'

    // --- AI Draft endpoint ---
    if (action === 'ai-draft' && req.method === 'POST') {
      return await handleAIDraft(await req.json())
    }

    // --- Preview: get recipient count ---
    if (action === 'preview' && req.method === 'POST') {
      const { target_tiers } = await req.json()
      const recipients = await getRecipientEmails(supabase, target_tiers)
      return new Response(
        JSON.stringify({
          recipient_count: recipients.length,
          tiers: target_tiers,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Send broadcast ---
    if (action === 'send' && req.method === 'POST') {
      const body: BroadcastRequest = await req.json()
      const { subject, html, text, email_type, target_tiers } = body

      if (!subject || !html) {
        throw new Error('Subject and HTML body are required')
      }

      // Get recipient emails
      const recipients = await getRecipientEmails(supabase, target_tiers)
      if (recipients.length === 0) {
        throw new Error('No recipients found for the selected tiers')
      }

      console.log(`📧 Broadcasting "${subject}" to ${recipients.length} recipients (tiers: ${target_tiers.join(', ')})`)

      // Send via Resend API in batches of 50
      const resendApiKey = Deno.env.get('RESEND_API_KEY')
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY not configured')
      }

      let successCount = 0
      let failCount = 0
      const batchSize = 50
      const resendIds: string[] = []

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize)

        try {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'NetNeural Platform <noreply@netneural.ai>',
              bcc: batch, // Use BCC for privacy
              subject,
              html,
              ...(text ? { text } : {}),
            }),
          })

          const result = await response.json()
          if (response.ok) {
            successCount += batch.length
            if (result.id) resendIds.push(result.id)
          } else {
            console.error(`Batch ${i / batchSize + 1} failed:`, result)
            failCount += batch.length
          }
        } catch (err) {
          console.error(`Batch ${i / batchSize + 1} error:`, err)
          failCount += batch.length
        }
      }

      // Log the broadcast
      await supabase.from('email_broadcasts').insert({
        subject,
        html_body: html,
        text_body: text || null,
        email_type,
        target_tiers,
        recipient_count: successCount,
        sent_by: user.id,
        status: failCount === 0 ? 'sent' : failCount === recipients.length ? 'failed' : 'sent',
        error_message: failCount > 0 ? `${failCount} of ${recipients.length} emails failed` : null,
        metadata: { resend_ids: resendIds, total_attempted: recipients.length },
      })

      console.log(`✅ Broadcast complete: ${successCount} sent, ${failCount} failed`)

      return new Response(
        JSON.stringify({
          success: true,
          sent: successCount,
          failed: failCount,
          total: recipients.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // --- Get broadcast history ---
    if (action === 'history' && req.method === 'GET') {
      const { data: history, error } = await supabase
        .from('email_broadcasts')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20)

      if (error) throw error
      return new Response(
        JSON.stringify({ data: history }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error(`Unsupported action: ${action}`)
  } catch (error) {
    console.error('[email-broadcast] Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// ---- Helper: Get recipient emails by tier ----
async function getRecipientEmails(
  supabase: ReturnType<typeof createClient>,
  targetTiers: string[]
): Promise<string[]> {
  const includeAll = targetTiers.includes('all')

  if (includeAll) {
    // All users with verified emails
    const { data: users } = await supabase
      .from('users')
      .select('email')
      .not('email', 'is', null)

    return (users || []).map((u: { email: string }) => u.email).filter(Boolean)
  }

  // Get orgs matching tiers
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id')
    .in('subscription_tier', targetTiers)

  if (!orgs || orgs.length === 0) return []

  const orgIds = orgs.map((o: { id: string }) => o.id)

  // Get active members of those orgs
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id')
    .in('organization_id', orgIds)
    .eq('status', 'active')

  if (!members || members.length === 0) return []

  const userIds = [...new Set(members.map((m: { user_id: string }) => m.user_id))]

  // Get emails
  const { data: users } = await supabase
    .from('users')
    .select('email')
    .in('id', userIds)
    .not('email', 'is', null)

  return (users || []).map((u: { email: string }) => u.email).filter(Boolean)
}

// ---- Helper: AI-powered email drafting ----
async function handleAIDraft(body: AIDraftRequest): Promise<Response> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiApiKey) {
    return new Response(
      JSON.stringify({ error: 'OpenAI API not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }

  const { email_type, topic, key_points, tone = 'friendly' } = body

  const typeDescriptions: Record<string, string> = {
    announcement: 'a platform announcement or new feature release',
    maintenance: 'a scheduled maintenance or downtime notification',
    newsletter: 'a monthly/quarterly newsletter with platform updates',
    update: 'a general platform update or improvement notice',
  }

  const prompt = `You are a professional email copywriter for NetNeural, an IoT food-safety monitoring platform used by grocery chains and food service businesses. Write a ${tone} ${typeDescriptions[email_type] || 'platform email'}.

Topic: ${topic}
${key_points ? `Key points to cover:\n${key_points}` : ''}

Requirements:
- Write the email in clean HTML suitable for email clients
- Include a greeting, body, and sign-off
- Sign off as "The NetNeural Team"
- Use a professional but ${tone} tone
- Keep it concise (150-300 words)
- Do NOT include <html>, <head>, or <body> tags — just the inner content
- Use inline styles for any formatting (email-safe)
- Include a brief plain-text subject line suggestion on the first line prefixed with "SUBJECT: "

Format your response as:
SUBJECT: [suggested subject line]
---
[HTML email body]`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a professional email copywriter. Output clean, email-safe HTML.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    })

    const result = await response.json()
    const content = result.choices?.[0]?.message?.content || ''

    // Parse subject and body
    const subjectMatch = content.match(/SUBJECT:\s*(.+)/i)
    const subject = subjectMatch ? subjectMatch[1].trim() : `NetNeural ${email_type.charAt(0).toUpperCase() + email_type.slice(1)}`

    const bodyStart = content.indexOf('---')
    const htmlBody = bodyStart >= 0
      ? content.substring(bodyStart + 3).trim()
      : content.replace(/SUBJECT:.+\n?/, '').trim()

    return new Response(
      JSON.stringify({ subject, html: htmlBody, ai_generated: true }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  } catch (err) {
    console.error('[email-broadcast] AI draft error:', err)
    return new Response(
      JSON.stringify({ error: 'Failed to generate AI draft' }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )
  }
}
