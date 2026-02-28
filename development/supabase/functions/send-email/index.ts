// ============================================================================
// GENERAL PURPOSE EMAIL SENDER
// ============================================================================
// Sends emails via Resend API with optional attachments
// Used for platform communications, reports, and notifications
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: string // base64 encoded
  }>
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured')
    }

    const { to, subject, html, text, attachments } =
      (await req.json()) as EmailRequest

    if (!to || to.length === 0) {
      throw new Error('No recipients specified')
    }

    if (!subject || !html) {
      throw new Error('Subject and html are required')
    }

    console.log(
      `[send-email] Sending to ${to.length} recipients: ${to.join(', ')}`
    )
    console.log(`[send-email] Subject: ${subject}`)

    const resendBody: Record<string, unknown> = {
      from: 'NetNeural Platform <noreply@netneural.ai>',
      to,
      subject,
      html,
    }

    if (text) {
      resendBody.text = text
    }

    if (attachments && attachments.length > 0) {
      resendBody.attachments = attachments
      console.log(
        `[send-email] Attachments: ${attachments.map((a) => a.filename).join(', ')}`
      )
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendBody),
    })

    const result = await response.json()

    if (!response.ok) {
      console.error('[send-email] Resend API error:', JSON.stringify(result))
      throw new Error(
        `Resend API error: ${result.message || response.statusText}`
      )
    }

    console.log('[send-email] Email sent successfully:', JSON.stringify(result))

    return new Response(
      JSON.stringify({
        success: true,
        message: `Email sent to ${to.length} recipients`,
        id: result.id,
        recipients: to,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('[send-email] Error:', error.message)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
